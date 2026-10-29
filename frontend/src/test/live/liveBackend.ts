import fs from 'node:fs';
import crypto from 'node:crypto';

export interface LiveInfo {
  url: string;
  users: Record<'admin' | 'artist' | 'mfa', { email: string; password: string }>;
  mfa: { secret: string; recovery_codes: string[] };
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
