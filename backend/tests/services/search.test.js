/**
 * Tests for advancedSearch.service.js
 * Mocks Supabase DB queries.
 */

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  textSearch: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
};

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: {
    from: jest.fn(() => mockQuery),
  },
}));

import {
  fullTextSearch,
  getSuggestions,
  recordClickThrough,
  getSearchAnalytics,
} from '../../services/advancedSearch.service.js';

describe('Advanced Search Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock chain
    Object.keys(mockQuery).forEach((k) => {
      mockQuery[k].mockReturnThis();
    });
  });

  describe('fullTextSearch', () => {
    it('should return products for a valid search query', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [
          { id: 'p1', title: 'Test Product', price: 10 },
          { id: 'p2', title: 'Another Product', price: 20 },
        ],
        count: 2,
        error: null,
      });

      const result = await fullTextSearch('test', {}, 1, 20);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should apply category filter', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [{ id: 'p1', title: 'Phone', category_id: 'cat-1' }],
        count: 1,
        error: null,
      });

      const result = await fullTextSearch('phone', { category_id: 'cat-1' });

      expect(mockQuery.eq).toHaveBeenCalledWith('category_id', 'cat-1');
      expect(result.data).toHaveLength(1);
    });

    it('should apply price range filter', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [{ id: 'p1', price: 50 }],
        count: 1,
        error: null,
      });

      const result = await fullTextSearch('item', { minPrice: 10, maxPrice: 100 });

      expect(mockQuery.gte).toHaveBeenCalledWith('price', 10);
      expect(mockQuery.lte).toHaveBeenCalledWith('price', 100);
      expect(result).toBeDefined();
    });

    it('should apply minimum rating filter', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [{ id: 'p1', average_rating: 4.5 }],
        count: 1,
        error: null,
      });

      const result = await fullTextSearch('quality', { minRating: 4 });

      expect(mockQuery.gte).toHaveBeenCalledWith('average_rating', 4);
      expect(result).toBeDefined();
    });

    it('should apply supplier filter', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [{ id: 'p1', supplier_id: 'sup-1' }],
        count: 1,
        error: null,
      });

      const result = await fullTextSearch('', { supplierId: 'sup-1' });

      expect(mockQuery.eq).toHaveBeenCalledWith('supplier_id', 'sup-1');
      expect(result).toBeDefined();
    });

    it('should handle empty search results', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });

      const result = await fullTextSearch('nonexistentproduct12345');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return spelling suggestion for zero results', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });

      const result = await fullTextSearch('proddduct');

      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).not.toBeNull();
    });

    it('should paginate correctly', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [{ id: 'p21' }, { id: 'p22' }],
        count: 50,
        error: null,
      });

      const result = await fullTextSearch('products', {}, 2, 20);

      expect(mockQuery.range).toHaveBeenCalledWith(20, 39);
      expect(result.page).toBe(2);
    });

    it('should throw on database error', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: null,
        count: null,
        error: { message: 'DB connection failed' },
      });

      await expect(fullTextSearch('error')).rejects.toThrow();
    });

    it('should handle search with no query string (browse all)', async () => {
      mockQuery.range = jest.fn().mockResolvedValue({
        data: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        count: 3,
        error: null,
      });

      const result = await fullTextSearch('');

      expect(result.data).toBeDefined();
      expect(mockQuery.textSearch).not.toHaveBeenCalled();
    });
  });

  describe('getSuggestions', () => {
    it('should return autocomplete suggestions', async () => {
      const mockSupabase = require('../../config/supabase.js').default;
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ title: 'iPhone 15' }, { title: 'iPhone 14' }],
          error: null,
        }),
      });

      const result = await getSuggestions('iphone');

      expect(result).toBeDefined();
    });

    it('should return empty array for short queries', async () => {
      const result = await getSuggestions('ab');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('recordClickThrough', () => {
    it('should record a click-through event without throwing', async () => {
      await expect(recordClickThrough('test query', 'product-123')).resolves.not.toThrow();
    });
  });

  describe('getSearchAnalytics', () => {
    it('should return analytics object', () => {
      const analytics = getSearchAnalytics();
      expect(analytics).toBeDefined();
      expect(typeof analytics).toBe('object');
    });
  });
});
