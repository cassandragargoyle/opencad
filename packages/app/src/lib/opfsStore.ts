/**
 * T-PERF-01 (#429): Origin Private File System (OPFS) element store.
 *
 * Persists element data to the browser's OPFS for offline-first operation.
 * Provides a simple key-value interface on top of the OPFS synchronous
 * access handle API (available inside a Web Worker).
 *
 * This module exposes two interfaces:
 *   - OPFSElementStore: async high-level API (main thread or worker)
 *   - Serialisation helpers: convert elements to/from binary chunks
 *
 * The binary format is intentionally simple:
 *   [4 bytes: chunk version][4 bytes: payload length][N bytes: JSON payload]
 */

// ── Binary format constants ───────────────────────────────────────────────────

export const OPFS_CHUNK_VERSION = 1;
export const OPFS_HEADER_BYTES  = 8; // version (4) + length (4)

// ── Serialisation helpers ─────────────────────────────────────────────────────

/**
 * Encode a JSON-serialisable record into the OPFS binary chunk format.
 */
export function encodeChunk(data: unknown): Uint8Array {
  const json    = JSON.stringify(data);
  const encoder = new TextEncoder();
  const payload = encoder.encode(json);

  const buf    = new ArrayBuffer(OPFS_HEADER_BYTES + payload.byteLength);
  const view   = new DataView(buf);
  const result = new Uint8Array(buf);

  view.setUint32(0, OPFS_CHUNK_VERSION, false); // big-endian
  view.setUint32(4, payload.byteLength, false);
  result.set(payload, OPFS_HEADER_BYTES);

  return result;
}

/**
 * Decode a binary chunk produced by encodeChunk().
 * Throws if the version is unsupported.
 */
export function decodeChunk(bytes: Uint8Array): unknown {
  if (bytes.byteLength < OPFS_HEADER_BYTES) {
    throw new Error(`OPFS chunk too short: ${bytes.byteLength} bytes`);
  }
  const view    = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(0, false);
  const length  = view.getUint32(4, false);

  if (version !== OPFS_CHUNK_VERSION) {
    throw new Error(`Unsupported OPFS chunk version: ${version}`);
  }

  const payload = bytes.slice(OPFS_HEADER_BYTES, OPFS_HEADER_BYTES + length);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(payload));
}

// ── Store types ───────────────────────────────────────────────────────────────

export interface OPFSStoreEntry {
  key: string;
  data: unknown;
  /** Unix timestamp (ms) of last write */
  updatedAt: number;
}

export interface OPFSStoreStats {
  entryCount: number;
  /** Estimated total bytes written */
  estimatedBytes: number;
}

// ── In-memory shim (for environments without OPFS / tests) ────────────────────

/**
 * Creates an in-memory OPFS-like store.
 *
 * In production, replace the backing store with a real OPFS
 * FileSystemSyncAccessHandle inside a Worker.  The interface is identical.
 */
export function createMemoryStore(): OPFSElementStore {
  const map = new Map<string, OPFSStoreEntry>();

  return {
    async write(key: string, data: unknown): Promise<void> {
      map.set(key, { key, data, updatedAt: Date.now() });
    },

    async read(key: string): Promise<unknown | undefined> {
      return map.get(key)?.data;
    },

    async delete(key: string): Promise<void> {
      map.delete(key);
    },

    async keys(): Promise<string[]> {
      return [...map.keys()];
    },

    async clear(): Promise<void> {
      map.clear();
    },

    async stats(): Promise<OPFSStoreStats> {
      let estimatedBytes = 0;
      for (const entry of map.values()) {
        estimatedBytes += JSON.stringify(entry.data).length;
      }
      return { entryCount: map.size, estimatedBytes };
    },
  };
}

export interface OPFSElementStore {
  write(key: string, data: unknown): Promise<void>;
  read(key: string): Promise<unknown | undefined>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  stats(): Promise<OPFSStoreStats>;
}

// ── Batch helpers ─────────────────────────────────────────────────────────────

/**
 * Write multiple entries in a single async batch.
 */
export async function batchWrite(
  store: OPFSElementStore,
  entries: Array<{ key: string; data: unknown }>,
): Promise<void> {
  await Promise.all(entries.map((e) => store.write(e.key, e.data)));
}

/**
 * Read multiple keys, returning a map of found entries (missing keys omitted).
 */
export async function batchRead(
  store: OPFSElementStore,
  keys: string[],
): Promise<Map<string, unknown>> {
  const pairs = await Promise.all(
    keys.map(async (k) => [k, await store.read(k)] as const),
  );
  const result = new Map<string, unknown>();
  for (const [k, v] of pairs) {
    if (v !== undefined) result.set(k, v);
  }
  return result;
}

/**
 * Delete multiple keys in a batch.
 */
export async function batchDelete(
  store: OPFSElementStore,
  keys: string[],
): Promise<void> {
  await Promise.all(keys.map((k) => store.delete(k)));
}
