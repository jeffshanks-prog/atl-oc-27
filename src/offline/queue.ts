// Offline write queue. Every user-data write is a plain upsert/delete so it can be
// replayed later. Game results recorded with no signal are kept on-device and
// synced automatically when the connection returns.
import { get, set } from 'idb-keyval';
import { supabase } from '@/lib/supabase';

export interface Op {
  id: string;
  table: string;
  kind: 'upsert' | 'delete';
  rows?: Record<string, unknown>[];
  match?: Record<string, unknown>;
  onConflict?: string;
}

const KEY = 'atloc27:queue';
let flushing = false;
const listeners = new Set<(n: number) => void>();

export function onQueueChange(fn: (n: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
async function readQueue(): Promise<Op[]> { return ((await get(KEY)) as Op[] | undefined) ?? []; }
async function writeQueue(q: Op[]): Promise<void> {
  await set(KEY, q);
  listeners.forEach((l) => l(q.length));
}
export async function queueSize(): Promise<number> { return (await readQueue()).length; }

class NetworkError extends Error {}

async function runOp(op: Op): Promise<void> {
  let res;
  if (op.kind === 'upsert') {
    res = await supabase.from(op.table).upsert(op.rows ?? [], op.onConflict ? { onConflict: op.onConflict } : undefined);
  } else {
    let q = supabase.from(op.table).delete();
    for (const [k, v] of Object.entries(op.match ?? {})) q = q.eq(k, v as string);
    res = await q;
  }
  if (res.error) {
    const msg = res.error.message ?? '';
    if (/fetch|network|Failed to|timeout/i.test(msg)) throw new NetworkError(msg);
    throw new Error(`${op.table}: ${msg}`);
  }
}

/** Run now if online; otherwise (or on network failure) queue for later. */
export async function write(op: Omit<Op, 'id'>): Promise<void> {
  const full: Op = { ...op, id: crypto.randomUUID() };
  const q = await readQueue();
  if (q.length || !navigator.onLine) {
    await writeQueue([...q, full]); // keep ordering behind anything already queued
    return;
  }
  try {
    await runOp(full);
  } catch (e) {
    if (e instanceof NetworkError || !navigator.onLine) await writeQueue([...(await readQueue()), full]);
    else console.error(e);
  }
}

export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return queueSize();
  flushing = true;
  try {
    let q = await readQueue();
    while (q.length) {
      try {
        await runOp(q[0]);
      } catch (e) {
        if (e instanceof NetworkError) break;
        console.error('Dropping op that the server rejected', q[0], e);
      }
      q = q.slice(1);
      await writeQueue(q);
    }
    return q.length;
  } finally {
    flushing = false;
  }
}

export function startQueueSync(): void {
  window.addEventListener('online', () => { void flushQueue(); });
  void flushQueue();
  setInterval(() => { void flushQueue(); }, 30_000);
}
