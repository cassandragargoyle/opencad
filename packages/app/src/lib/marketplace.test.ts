/**
 * T-LIB-V2-02: Marketplace tests
 */
import { describe, it, expect } from 'vitest';
import {
  searchMarketplace,
  sortMarketplaceItems,
  computeRevenueShare,
  PLATFORM_FEE_FRACTION,
  type MarketplaceItem,
} from './marketplace';

describe('PLATFORM_FEE_FRACTION', () => {
  it('is 0.3', () => {
    expect(PLATFORM_FEE_FRACTION).toBe(0.3);
  });
});

describe('searchMarketplace', () => {
  it('returns all items for empty query', () => {
    const result = searchMarketplace('');
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('returns correct pagination fields', () => {
    const result = searchMarketplace('', { page: 1, pageSize: 5 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  it('paginates results', () => {
    const page1 = searchMarketplace('', { page: 1, pageSize: 3 });
    const page2 = searchMarketplace('', { page: 2, pageSize: 3 });
    if (page1.total > 3) {
      expect(page2.items.length).toBeGreaterThan(0);
      expect(page1.items[0].id).not.toBe(page2.items[0]?.id);
    }
  });

  it('filters by category', () => {
    const result = searchMarketplace('', { category: 'doors' });
    result.items.forEach((item) => expect(item.category).toBe('doors'));
  });

  it('filters by maxPrice', () => {
    const result = searchMarketplace('', { maxPrice: 0 });
    result.items.forEach((item) => expect(item.price).toBe(0));
  });

  it('filters by minRating', () => {
    const result = searchMarketplace('', { minRating: 4.8 });
    result.items.forEach((item) => expect(item.rating).toBeGreaterThanOrEqual(4.8));
  });

  it('filters by query text', () => {
    const result = searchMarketplace('door');
    expect(result.total).toBeGreaterThan(0);
    result.items.forEach((item) => {
      const match =
        item.name.toLowerCase().includes('door') ||
        item.tags.some((t) => t.toLowerCase().includes('door'));
      expect(match).toBe(true);
    });
  });

  it('returns empty when no items match', () => {
    const result = searchMarketplace('xyznotmatchinganything123');
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('combines filters', () => {
    const result = searchMarketplace('', { category: 'windows', maxPrice: 30 });
    result.items.forEach((item) => {
      expect(item.category).toBe('windows');
      expect(item.price).toBeLessThanOrEqual(30);
    });
  });
});

describe('sortMarketplaceItems', () => {
  const items: MarketplaceItem[] = [
    { id: 'a', name: 'Zebra Item', authorId: 'u1', price: 50, currency: 'USD', category: 'doors', downloads: 100, rating: 3.5, tags: [] },
    { id: 'b', name: 'Alpha Item', authorId: 'u2', price: 10, currency: 'USD', category: 'doors', downloads: 5000, rating: 4.9, tags: [] },
    { id: 'c', name: 'Middle Item', authorId: 'u3', price: 25, currency: 'USD', category: 'windows', downloads: 750, rating: 4.2, tags: [] },
  ];

  it('sorts by price ascending', () => {
    const sorted = sortMarketplaceItems(items, 'price');
    expect(sorted[0].price).toBe(10);
    expect(sorted[2].price).toBe(50);
  });

  it('sorts by rating descending', () => {
    const sorted = sortMarketplaceItems(items, 'rating');
    expect(sorted[0].rating).toBe(4.9);
    expect(sorted[2].rating).toBe(3.5);
  });

  it('sorts by downloads descending', () => {
    const sorted = sortMarketplaceItems(items, 'downloads');
    expect(sorted[0].downloads).toBe(5000);
    expect(sorted[2].downloads).toBe(100);
  });

  it('sorts by name alphabetically', () => {
    const sorted = sortMarketplaceItems(items, 'name');
    expect(sorted[0].name).toBe('Alpha Item');
    expect(sorted[2].name).toBe('Zebra Item');
  });

  it('does not mutate original array', () => {
    const original = [...items];
    sortMarketplaceItems(items, 'price');
    expect(items[0].id).toBe(original[0].id);
  });
});

describe('computeRevenueShare', () => {
  it('splits revenue with default 30% platform fee', () => {
    const { authorShare, platformShare } = computeRevenueShare(100);
    expect(authorShare).toBe(70);
    expect(platformShare).toBe(30);
  });

  it('splits revenue with custom platform fee', () => {
    const { authorShare, platformShare } = computeRevenueShare(100, 0.2);
    expect(authorShare).toBe(80);
    expect(platformShare).toBe(20);
  });

  it('handles zero price', () => {
    const { authorShare, platformShare } = computeRevenueShare(0);
    expect(authorShare).toBe(0);
    expect(platformShare).toBe(0);
  });

  it('shares sum to original price', () => {
    const price = 49.99;
    const { authorShare, platformShare } = computeRevenueShare(price);
    expect(authorShare + platformShare).toBeCloseTo(price, 2);
  });

  it('rounds to 2 decimal places', () => {
    const { authorShare, platformShare } = computeRevenueShare(29.99);
    expect(authorShare.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    expect(platformShare.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});
