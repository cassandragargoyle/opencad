/**
 * T-SITE-V2-06: CDN streaming + IndexedDB cache.
 * Provides an AssetCache interface and a pure in-memory implementation for testing.
 */

export interface AssetEntry {
  id: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  /** Unix timestamp (ms) when the entry was added to cache. */
  cachedAt: number;
  /** Unix timestamp (ms) of last access. */
  lastUsed: number;
}

export interface AssetCacheConfig {
  maxSizeBytes: number;
  maxAgeMs: number;
  baseUrl: string;
}

export const DEFAULT_ASSET_CACHE_CONFIG: AssetCacheConfig = {
  maxSizeBytes: 256 * 1024 * 1024, // 256 MiB
  maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  baseUrl: 'https://cdn.opencad.archi/assets',
};

// ── AssetCache interface ──────────────────────────────────────────────────────

export interface AssetCache {
  /** Store or overwrite an asset entry. */
  put(entry: AssetEntry): Promise<void>;
  /** Retrieve an asset entry by id. Returns undefined if not found. */
  get(id: string): Promise<AssetEntry | undefined>;
  /** Remove an asset entry by id. No-op if not found. */
  evict(id: string): Promise<void>;
  /** List all stored entries. */
  listEntries(): Promise<AssetEntry[]>;
  /** Return the total size in bytes of all stored entries. */
  totalSize(): Promise<number>;
  /**
   * Remove all entries older than `maxAgeMs` (defaults to DEFAULT_ASSET_CACHE_CONFIG.maxAgeMs).
   * Returns the number of entries pruned.
   */
  pruneExpired(now?: number): Promise<number>;
}

// ── In-memory implementation (for tests / non-IndexedDB environments) ─────────

class MemoryAssetCache implements AssetCache {
  private readonly _store = new Map<string, AssetEntry>();

  async put(entry: AssetEntry): Promise<void> {
    this._store.set(entry.id, { ...entry });
  }

  async get(id: string): Promise<AssetEntry | undefined> {
    const entry = this._store.get(id);
    if (entry) {
      // Update lastUsed on access
      const updated = { ...entry, lastUsed: Date.now() };
      this._store.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async evict(id: string): Promise<void> {
    this._store.delete(id);
  }

  async listEntries(): Promise<AssetEntry[]> {
    return [...this._store.values()];
  }

  async totalSize(): Promise<number> {
    let total = 0;
    for (const entry of this._store.values()) {
      total += entry.sizeBytes;
    }
    return total;
  }

  async pruneExpired(now?: number): Promise<number> {
    const ts = now ?? Date.now();
    const maxAge = DEFAULT_ASSET_CACHE_CONFIG.maxAgeMs;
    let pruned = 0;
    for (const [id, entry] of this._store.entries()) {
      if (isCacheStale(entry, ts, maxAge)) {
        this._store.delete(id);
        pruned++;
      }
    }
    return pruned;
  }
}

/**
 * Create an in-memory asset cache (no IndexedDB / DOM dependency).
 */
export function createMemoryAssetCache(): AssetCache {
  return new MemoryAssetCache();
}

// ── Pure utility functions ────────────────────────────────────────────────────

/**
 * Determine which entries should be evicted to bring total size under `maxBytes`.
 * Evicts least-recently-used entries first.
 * Returns the subset of entries to evict.
 */
export function pruneByLRU(entries: AssetEntry[], maxBytes: number): AssetEntry[] {
  const totalBytes = entries.reduce((acc, e) => acc + e.sizeBytes, 0);
  if (totalBytes <= maxBytes) return [];

  // Sort by lastUsed ascending (oldest first = evict first)
  const sorted = [...entries].sort((a, b) => a.lastUsed - b.lastUsed);
  let freed = 0;
  const toEvict: AssetEntry[] = [];
  const excess = totalBytes - maxBytes;

  for (const entry of sorted) {
    if (freed >= excess) break;
    toEvict.push(entry);
    freed += entry.sizeBytes;
  }

  return toEvict;
}

/**
 * Build a CDN URL by joining baseUrl with the asset ID.
 */
export function buildCdnUrl(assetId: string, config: AssetCacheConfig): string {
  return `${config.baseUrl}/${assetId}`;
}

/**
 * Return true if the cache entry is older than `maxAgeMs` relative to `now`.
 */
export function isCacheStale(entry: AssetEntry, now: number, maxAgeMs: number): boolean {
  return now - entry.cachedAt > maxAgeMs;
}
