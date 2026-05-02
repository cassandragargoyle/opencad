/**
 * T-LIB-V2-02: Marketplace utilities for OpenCAD object marketplace.
 */

import type { ObjectCategory } from './objectLibrary';

export type { ObjectCategory };

export interface MarketplaceItem {
  id: string;
  name: string;
  authorId: string;
  price: number;
  currency: 'USD';
  category: ObjectCategory;
  downloads: number;
  rating: number;
  tags: string[];
}

export interface MarketplaceListing {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchOptions {
  category?: ObjectCategory;
  maxPrice?: number;
  minRating?: number;
  page?: number;
  pageSize?: number;
}

export const PLATFORM_FEE_FRACTION: number = 0.3;

// Sample marketplace items for testing / seed data
const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'mkt-door-premium-1',
    name: 'Premium Pivot Door Collection',
    authorId: 'author-1',
    price: 29.99,
    currency: 'USD',
    category: 'doors',
    downloads: 1250,
    rating: 4.8,
    tags: ['door', 'pivot', 'premium', 'modern'],
  },
  {
    id: 'mkt-door-free-1',
    name: 'Basic Door Pack (Free)',
    authorId: 'author-2',
    price: 0,
    currency: 'USD',
    category: 'doors',
    downloads: 8900,
    rating: 4.2,
    tags: ['door', 'basic', 'free'],
  },
  {
    id: 'mkt-window-1',
    name: 'Modern Window System',
    authorId: 'author-1',
    price: 49.99,
    currency: 'USD',
    category: 'windows',
    downloads: 3400,
    rating: 4.9,
    tags: ['window', 'modern', 'aluminium'],
  },
  {
    id: 'mkt-window-2',
    name: 'Heritage Sash Windows',
    authorId: 'author-3',
    price: 19.99,
    currency: 'USD',
    category: 'windows',
    downloads: 670,
    rating: 4.5,
    tags: ['window', 'heritage', 'sash', 'timber'],
  },
  {
    id: 'mkt-fixture-1',
    name: 'Luxury Bathroom Suite',
    authorId: 'author-4',
    price: 89.99,
    currency: 'USD',
    category: 'fixtures',
    downloads: 540,
    rating: 4.7,
    tags: ['bathroom', 'luxury', 'suite'],
  },
  {
    id: 'mkt-furniture-1',
    name: 'Scandinavian Living Set',
    authorId: 'author-5',
    price: 39.99,
    currency: 'USD',
    category: 'furniture',
    downloads: 2200,
    rating: 4.6,
    tags: ['furniture', 'scandinavian', 'living'],
  },
  {
    id: 'mkt-equipment-1',
    name: 'Commercial Kitchen Equipment Pack',
    authorId: 'author-6',
    price: 99.99,
    currency: 'USD',
    category: 'equipment',
    downloads: 310,
    rating: 4.3,
    tags: ['kitchen', 'commercial', 'equipment'],
  },
  {
    id: 'mkt-lighting-1',
    name: 'Architectural Lighting Collection',
    authorId: 'author-7',
    price: 24.99,
    currency: 'USD',
    category: 'lighting',
    downloads: 4100,
    rating: 4.8,
    tags: ['lighting', 'architectural', 'led'],
  },
  {
    id: 'mkt-landscape-1',
    name: 'Urban Landscape Pack',
    authorId: 'author-8',
    price: 14.99,
    currency: 'USD',
    category: 'landscape',
    downloads: 1800,
    rating: 4.4,
    tags: ['landscape', 'urban', 'trees', 'planting'],
  },
  {
    id: 'mkt-furniture-free',
    name: 'Office Furniture Basics',
    authorId: 'author-2',
    price: 0,
    currency: 'USD',
    category: 'furniture',
    downloads: 12000,
    rating: 3.9,
    tags: ['furniture', 'office', 'free', 'basic'],
  },
];

export function searchMarketplace(
  query: string,
  opts?: SearchOptions,
): MarketplaceListing {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 20;
  const lower = query.toLowerCase();

  const filtered = MARKETPLACE_ITEMS.filter((item) => {
    if (opts?.category && item.category !== opts.category) return false;
    if (opts?.maxPrice !== undefined && item.price > opts.maxPrice) return false;
    if (opts?.minRating !== undefined && item.rating < opts.minRating) return false;
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(lower) ||
      item.tags.some((t) => t.toLowerCase().includes(lower))
    );
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, total, page, pageSize };
}

export function sortMarketplaceItems(
  items: MarketplaceItem[],
  by: 'price' | 'rating' | 'downloads' | 'name',
): MarketplaceItem[] {
  return [...items].sort((a, b) => {
    switch (by) {
      case 'price':
        return a.price - b.price;
      case 'rating':
        return b.rating - a.rating;
      case 'downloads':
        return b.downloads - a.downloads;
      case 'name':
        return a.name.localeCompare(b.name);
    }
  });
}

export function computeRevenueShare(
  price: number,
  platformFeeFraction: number = PLATFORM_FEE_FRACTION,
): { authorShare: number; platformShare: number } {
  const platformShare = price * platformFeeFraction;
  const authorShare = price - platformShare;
  return {
    authorShare: Math.round(authorShare * 100) / 100,
    platformShare: Math.round(platformShare * 100) / 100,
  };
}
