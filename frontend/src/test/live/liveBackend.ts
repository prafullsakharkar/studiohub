import fs from 'node:fs';
import crypto from 'node:crypto';

export interface LiveInfo {
  url: string;
  users: Record<'admin' | 'enroll' | 'manager' | 'artist' | 'mfa' | 'pwdue' | 'delegate' | 'selfmfa' | 'lead' | 'supervisor', { email: string; password: string }>;
  mfa: { secret: string; recovery_codes: string[] };
  manager: { secret: string };
}

export const live: LiveInfo = JSON.parse(fs.readFileSync(process.env.SYNC_LIVE_INFO as string, 'utf8'));

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), the same algorithm authenticator apps use. */
export function totp(secretBase32: string, atMs = Date.now()): string {
  let bits = '';
  for (const ch of secretBase32.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));
  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/**
 * A TOTP code the backend has not seen yet. The backend accepts each 30 s step once per user
 * (replay protection), so a code reused in the same step, by another test file or by a re-run
 * against the same server, is rejected. The last step used per secret is kept next to live.json.
 */
export async function freshTotp(secret: string): Promise<string> {
  const stateFile = `${process.env.SYNC_LIVE_INFO}.totp.json`;
  const step = () => Math.floor(Date.now() / 30_000);
  for (;;) {
    let used: Record<string, number> = {};
    try {
      used = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      // first use
    }
    // The harness seeds MFA with a code from its own start-up step, which the server then refuses as a replay.
    const seedStep = Math.floor(fs.statSync(process.env.SYNC_LIVE_INFO as string).mtimeMs / 30_000);
    if (used[secret] !== step() && step() > seedStep) {
      used[secret] = step();
      fs.writeFileSync(stateFile, JSON.stringify(used));
      return totp(secret);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function rawPost(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${live.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/** Fresh module graph = one browser tab (memory is per-tab, localStorage is shared). */
export async function openTab() {
  const { vi } = await import('vitest');
  vi.resetModules();
  const { tokenStorage } = await import('@/core/auth/tokenStorage');
  const { ApiClient } = await import('@/api/client/ApiClient');
  const { authService } = await import('@/modules/auth/services/AuthService');
  return { tokenStorage, client: new ApiClient(), authService };
}
