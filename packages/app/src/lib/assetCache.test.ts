/**
 * T-SITE-V2-06: Unit tests for assetCache.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMemoryAssetCache,
  pruneByLRU,
  buildCdnUrl,
  isCacheStale,
  DEFAULT_ASSET_CACHE_CONFIG,
  type AssetEntry,
  type AssetCache,
} from './assetCache';

function makeEntry(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: 'asset-1',
    url: 'https://cdn.example.com/asset-1.glb',
    sizeBytes: 1024,
    mimeType: 'model/gltf-binary',
    cachedAt: 1000000,
    lastUsed: 1000000,
    ...overrides,
  };
}

describe('T-SITE-V2-06: assetCache', () => {
  // ── DEFAULT_ASSET_CACHE_CONFIG ───────────────────────────────────────────────

  it('DEFAULT_ASSET_CACHE_CONFIG has required keys', () => {
    expect(DEFAULT_ASSET_CACHE_CONFIG).toHaveProperty('maxSizeBytes');
    expect(DEFAULT_ASSET_CACHE_CONFIG).toHaveProperty('maxAgeMs');
    expect(DEFAULT_ASSET_CACHE_CONFIG).toHaveProperty('baseUrl');
  });

  it('DEFAULT maxSizeBytes is positive', () => {
    expect(DEFAULT_ASSET_CACHE_CONFIG.maxSizeBytes).toBeGreaterThan(0);
  });

  // ── createMemoryAssetCache ──────────────────────────────────────────────────

  let cache: AssetCache;
  beforeEach(() => {
    cache = createMemoryAssetCache();
  });

  it('put and get round-trips an entry', async () => {
    const entry = makeEntry();
    await cache.put(entry);
    const retrieved = await cache.get('asset-1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('asset-1');
    expect(retrieved!.sizeBytes).toBe(1024);
  });

  it('get returns undefined for missing id', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('evict removes an entry', async () => {
    await cache.put(makeEntry());
    await cache.evict('asset-1');
    expect(await cache.get('asset-1')).toBeUndefined();
  });

  it('evict is a no-op for missing entry', async () => {
    await expect(cache.evict('missing')).resolves.not.toThrow();
  });

  it('listEntries returns all stored entries', async () => {
    await cache.put(makeEntry({ id: 'a' }));
    await cache.put(makeEntry({ id: 'b' }));
    const list = await cache.listEntries();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('listEntries returns empty array when cache is empty', async () => {
    expect(await cache.listEntries()).toHaveLength(0);
  });

  it('totalSize sums all entry sizes', async () => {
    await cache.put(makeEntry({ id: 'a', sizeBytes: 500 }));
    await cache.put(makeEntry({ id: 'b', sizeBytes: 300 }));
    expect(await cache.totalSize()).toBe(800);
  });

  it('totalSize is 0 for empty cache', async () => {
    expect(await cache.totalSize()).toBe(0);
  });

  it('put overwrites an existing entry', async () => {
    await cache.put(makeEntry({ sizeBytes: 100 }));
    await cache.put(makeEntry({ sizeBytes: 999 }));
    const retrieved = await cache.get('asset-1');
    expect(retrieved!.sizeBytes).toBe(999);
    expect(await cache.totalSize()).toBe(999);
  });

  it('pruneExpired removes stale entries and returns count', async () => {
    const now = 2_000_000;
    const maxAge = DEFAULT_ASSET_CACHE_CONFIG.maxAgeMs;
    // Stale: cachedAt is older than maxAge
    await cache.put(makeEntry({ id: 'stale', cachedAt: now - maxAge - 1 }));
    // Fresh: cachedAt is within maxAge
    await cache.put(makeEntry({ id: 'fresh', cachedAt: now - 1000 }));
    const pruned = await cache.pruneExpired(now);
    expect(pruned).toBe(1);
    expect(await cache.get('stale')).toBeUndefined();
    expect(await cache.get('fresh')).toBeDefined();
  });

  it('pruneExpired returns 0 when nothing is stale', async () => {
    await cache.put(makeEntry({ id: 'new', cachedAt: Date.now() }));
    expect(await cache.pruneExpired(Date.now())).toBe(0);
  });

  // ── pruneByLRU ───────────────────────────────────────────────────────────────

  it('returns empty when total size is under limit', () => {
    const entries = [makeEntry({ sizeBytes: 100 })];
    expect(pruneByLRU(entries, 200)).toHaveLength(0);
  });

  it('evicts oldest LRU entry when over limit', () => {
    const old = makeEntry({ id: 'old', sizeBytes: 500, lastUsed: 100 });
    const recent = makeEntry({ id: 'new', sizeBytes: 500, lastUsed: 9999 });
    const toEvict = pruneByLRU([old, recent], 600);
    expect(toEvict.map((e) => e.id)).toContain('old');
    expect(toEvict.map((e) => e.id)).not.toContain('new');
  });

  it('evicts enough entries to meet the maxBytes target', () => {
    const entries = [
      makeEntry({ id: 'a', sizeBytes: 300, lastUsed: 1 }),
      makeEntry({ id: 'b', sizeBytes: 300, lastUsed: 2 }),
      makeEntry({ id: 'c', sizeBytes: 300, lastUsed: 3 }),
    ];
    const toEvict = pruneByLRU(entries, 400);
    const evictedBytes = toEvict.reduce((acc, e) => acc + e.sizeBytes, 0);
    expect(evictedBytes).toBeGreaterThanOrEqual(900 - 400);
  });

  it('does not mutate the input array', () => {
    const entries = [makeEntry({ id: 'a', sizeBytes: 1000, lastUsed: 1 })];
    pruneByLRU(entries, 100);
    expect(entries).toHaveLength(1);
  });

  // ── buildCdnUrl ──────────────────────────────────────────────────────────────

  it('builds url as baseUrl/assetId', () => {
    const url = buildCdnUrl('tree-oak.glb', DEFAULT_ASSET_CACHE_CONFIG);
    expect(url).toBe(`${DEFAULT_ASSET_CACHE_CONFIG.baseUrl}/tree-oak.glb`);
  });

  it('handles custom baseUrl', () => {
    const cfg = { ...DEFAULT_ASSET_CACHE_CONFIG, baseUrl: 'https://example.com/cdn' };
    expect(buildCdnUrl('foo.png', cfg)).toBe('https://example.com/cdn/foo.png');
  });

  // ── isCacheStale ─────────────────────────────────────────────────────────────

  it('returns false for fresh entry', () => {
    const entry = makeEntry({ cachedAt: 5000 });
    expect(isCacheStale(entry, 6000, 2000)).toBe(false);
  });

  it('returns true for stale entry', () => {
    const entry = makeEntry({ cachedAt: 1000 });
    expect(isCacheStale(entry, 10000, 2000)).toBe(true);
  });

  it('boundary: exactly equal to maxAgeMs is NOT stale', () => {
    const entry = makeEntry({ cachedAt: 0 });
    // now - cachedAt = maxAgeMs → not stale (strict >)
    expect(isCacheStale(entry, 2000, 2000)).toBe(false);
  });

  it('boundary: one ms past maxAgeMs is stale', () => {
    const entry = makeEntry({ cachedAt: 0 });
    expect(isCacheStale(entry, 2001, 2000)).toBe(true);
  });
});
