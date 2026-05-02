/**
 * T-PERF-01 (#429): OPFS element store tests.
 */
import { describe, it, expect } from 'vitest';
import {
  encodeChunk,
  decodeChunk,
  createMemoryStore,
  batchWrite,
  batchRead,
  batchDelete,
  OPFS_CHUNK_VERSION,
  OPFS_HEADER_BYTES,
} from './opfsStore';

describe('T-PERF-01: encodeChunk() / decodeChunk()', () => {
  it('round-trips a plain object', () => {
    const original = { id: 'el-1', type: 'wall', x: 100, y: 200 };
    const bytes    = encodeChunk(original);
    const decoded  = decodeChunk(bytes);
    expect(decoded).toEqual(original);
  });

  it('round-trips a nested object', () => {
    const original = { layers: [{ id: 'a' }, { id: 'b' }], meta: { v: 1 } };
    expect(decodeChunk(encodeChunk(original))).toEqual(original);
  });

  it('encoded bytes start with correct version', () => {
    const bytes = encodeChunk({ x: 1 });
    const view  = new DataView(bytes.buffer);
    expect(view.getUint32(0, false)).toBe(OPFS_CHUNK_VERSION);
  });

  it('header is OPFS_HEADER_BYTES long', () => {
    expect(OPFS_HEADER_BYTES).toBe(8);
    const bytes   = encodeChunk({});
    const view    = new DataView(bytes.buffer);
    const payLen  = view.getUint32(4, false);
    expect(bytes.byteLength).toBe(OPFS_HEADER_BYTES + payLen);
  });

  it('throws on truncated bytes', () => {
    expect(() => decodeChunk(new Uint8Array(2))).toThrow();
  });

  it('throws on unsupported version', () => {
    const bytes = encodeChunk({ x: 1 });
    const bad   = new Uint8Array(bytes);
    new DataView(bad.buffer).setUint32(0, 99, false);
    expect(() => decodeChunk(bad)).toThrow(/version/i);
  });
});

describe('T-PERF-01: createMemoryStore()', () => {
  it('write then read returns same data', async () => {
    const store = createMemoryStore();
    await store.write('k1', { value: 42 });
    const v = await store.read('k1');
    expect(v).toEqual({ value: 42 });
  });

  it('read of unknown key returns undefined', async () => {
    const store = createMemoryStore();
    expect(await store.read('missing')).toBeUndefined();
  });

  it('delete removes the entry', async () => {
    const store = createMemoryStore();
    await store.write('k1', 'hello');
    await store.delete('k1');
    expect(await store.read('k1')).toBeUndefined();
  });

  it('keys() returns all written keys', async () => {
    const store = createMemoryStore();
    await store.write('a', 1);
    await store.write('b', 2);
    const keys = await store.keys();
    expect(keys).toContain('a');
    expect(keys).toContain('b');
  });

  it('clear() removes all entries', async () => {
    const store = createMemoryStore();
    await store.write('x', 1);
    await store.clear();
    expect((await store.keys()).length).toBe(0);
  });

  it('stats() returns entry count', async () => {
    const store = createMemoryStore();
    await store.write('a', 1);
    await store.write('b', 2);
    const stats = await store.stats();
    expect(stats.entryCount).toBe(2);
    expect(stats.estimatedBytes).toBeGreaterThan(0);
  });
});

describe('T-PERF-01: batchWrite / batchRead / batchDelete', () => {
  it('batchWrite writes all entries', async () => {
    const store = createMemoryStore();
    await batchWrite(store, [
      { key: 'a', data: 1 },
      { key: 'b', data: 2 },
    ]);
    expect(await store.read('a')).toBe(1);
    expect(await store.read('b')).toBe(2);
  });

  it('batchRead returns found keys only', async () => {
    const store = createMemoryStore();
    await store.write('x', 'hello');
    const map = await batchRead(store, ['x', 'missing']);
    expect(map.get('x')).toBe('hello');
    expect(map.has('missing')).toBe(false);
  });

  it('batchDelete removes specified keys', async () => {
    const store = createMemoryStore();
    await store.write('a', 1);
    await store.write('b', 2);
    await store.write('c', 3);
    await batchDelete(store, ['a', 'b']);
    expect(await store.read('a')).toBeUndefined();
    expect(await store.read('b')).toBeUndefined();
    expect(await store.read('c')).toBe(3);
  });
});
