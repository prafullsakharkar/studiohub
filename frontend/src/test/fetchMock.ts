import { vi } from 'vitest';

export interface MockCall {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}

export type MockReply = { status?: number; body?: unknown; headers?: Record<string, string>; delayMs?: number } | Error;

/**
 * Installs a `fetch` stub that answers by calling `handler`; returns the recorded calls.
 * Reply bodies should come from docs/sync/samples (see ./samples.ts).
 */
export function mockFetch(handler: (call: MockCall, index: number) => MockReply | Promise<MockReply>) {
  const calls: MockCall[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input as string, init);
    const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      // keep raw text
    }
    const call: MockCall = { url: request.url, method: request.method, headers: request.headers, body };
    calls.push(call);
    const reply = await handler(call, calls.length - 1);
    if (reply instanceof Error) throw reply;
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    const status = reply.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json', ...reply.headers },
    });
  });
  vi.stubGlobal('fetch', stub);
  return { calls, stub };
}
