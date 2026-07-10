import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  doc, 
  getDoc,
  QueryConstraint,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  FirestoreError
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { apiCache, userDataCache, staticDataCache } from './cacheService';

/**
 * 优化的 Firestore 服务 - 提供缓存、分页和查询优化
 * Optimized Firestore Service - Provides caching, pagination, and query optimization
 */

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

export interface QueryOptions {
  useCache?: boolean;
  cacheTTL?: number;
  cacheType?: 'api' | 'user' | 'static';
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc?: QueryDocumentSnapshot;
  hasMore: boolean;
  total?: number;
}

class OptimizedFirestoreService {
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly MAX_PAGE_SIZE = 100;

  /**
   * 获取单个文档（带缓存）
   * Get single document (with caching)
   */
  async getDocument<T>(
    collectionName: string, 
    docId: string, 
    options: QueryOptions = {}
  ): Promise<T | null> {
    const { useCache = true, cacheTTL, cacheType = 'api' } = options;
    const cacheKey = `doc_${collectionName}_${docId}`;

    // Try cache first
    if (useCache) {
      const cache = this.getCache(cacheType);
      const cached = cache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      const data = { id: docSnap.id, ...docSnap.data() } as T;

      // Cache the result
      if (useCache) {
        const cache = this.getCache(cacheType);
        cache.set(cacheKey, data, cacheTTL);
      }

      return data;
    } catch (error) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * 获取集合数据（带缓存和分页）
   * Get collection data (with caching and pagination)
   */
  async getCollection<T>(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    pagination: PaginationOptions = {},
    options: QueryOptions = {}
  ): Promise<PaginatedResult<T>> {
    const { pageSize = this.DEFAULT_PAGE_SIZE, lastDoc } = pagination;
    const { useCache = true, cacheTTL, cacheType = 'api' } = options;
    
    // Limit page size for performance
    const limitedPageSize = Math.min(pageSize, this.MAX_PAGE_SIZE);
    
    // Create cache key based on query parameters
    const cacheKey = this.createQueryCacheKey(collectionName, constraints, pagination);

    // Try cache first (only for first page without lastDoc)
    if (useCache && !lastDoc) {
      const cache = this.getCache(cacheType);
      const cached = cache.get<PaginatedResult<T>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Build query
      let queryConstraints = [...constraints];
      
      // Add pagination
      if (lastDoc) {
        queryConstraints.push(startAfter(lastDoc));
      }
      queryConstraints.push(limit(limitedPageSize + 1)); // +1 to check if there are more

      const q = query(collection(db, collectionName), ...queryConstraints);
      const querySnapshot = await getDocs(q);

      const docs = querySnapshot.docs;
      const hasMore = docs.length > limitedPageSize;
      
      // Remove the extra document if exists
      if (hasMore) {
        docs.pop();
      }

      const data = docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];

      const result: PaginatedResult<T> = {
        data,
        lastDoc: docs.length > 0 ? docs[docs.length - 1] : undefined,
        hasMore
      };

      // Cache the result (only first page)
      if (useCache && !lastDoc) {
        const cache = this.getCache(cacheType);
        cache.set(cacheKey, result, cacheTTL);
      }

      return result;
    } catch (error) {
      console.error(`Error getting collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * 搜索文档（优化的全文搜索）
   * Search documents (optimized full-text search)
   */
  async searchDocuments<T>(
    collectionName: string,
    searchField: string,
    searchTerm: string,
    additionalConstraints: QueryConstraint[] = [],
    pagination: PaginationOptions = {},
    options: QueryOptions = {}
  ): Promise<PaginatedResult<T>> {
    // For Firestore, we need to implement prefix search
    // This is a simplified version - in production, you might want to use Algolia or similar
    const searchConstraints = [
      where(searchField, '>=', searchTerm),
      where(searchField, '<=', searchTerm + '\uf8ff'),
      ...additionalConstraints
    ];

    return this.getCollection<T>(collectionName, searchConstraints, pagination, options);
  }

  /**
   * 获取用户相关数据（使用用户缓存）
   * Get user-related data (using user cache)
   */
  async getUserData<T>(
    collectionName: string,
    userId: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    const userConstraints = [
      where('userId', '==', userId),
      ...constraints
    ];

    const result = await this.getCollection<T>(
      collectionName, 
      userConstraints, 
      { pageSize: 50 }, 
      { cacheType: 'user', cacheTTL: 15 * 60 * 1000 }
    );

    return result.data;
  }

  /**
   * 获取静态数据（使用静态缓存，长期缓存）
   * Get static data (using static cache, long-term caching)
   */
  async getStaticData<T>(
    collectionName: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    const result = await this.getCollection<T>(
      collectionName, 
      constraints, 
      { pageSize: 100 }, 
      { cacheType: 'static', cacheTTL: 60 * 60 * 1000 }
    );

    return result.data;
  }

  /**
   * 批量获取文档（优化的批量查询）
   * Batch get documents (optimized batch query)
   */
  async batchGetDocuments<T>(
    collectionName: string,
    docIds: string[],
    options: QueryOptions = {}
  ): Promise<(T | null)[]> {
    const { useCache = true, cacheType = 'api' } = options;
    const results: (T | null)[] = [];
    const uncachedIds: string[] = [];

    // Check cache first
    if (useCache) {
      const cache = this.getCache(cacheType);
      for (const docId of docIds) {
        const cacheKey = `doc_${collectionName}_${docId}`;
        const cached = cache.get<T>(cacheKey);
        if (cached) {
          results.push(cached);
        } else {
          results.push(null);
          uncachedIds.push(docId);
        }
      }
    } else {
      uncachedIds.push(...docIds);
      results.push(...new Array(docIds.length).fill(null));
    }

    // Fetch uncached documents
    if (uncachedIds.length > 0) {
      // Firestore 'in' queries are limited to 10 items
      const chunks = this.chunkArray(uncachedIds, 10);
      
      for (const chunk of chunks) {
        const q = query(
          collection(db, collectionName),
          where('__name__', 'in', chunk.map(id => doc(db, collectionName, id)))
        );
        
        const querySnapshot = await getDocs(q);
        
        querySnapshot.docs.forEach(docSnap => {
          const data = { id: docSnap.id, ...docSnap.data() } as T;
          const originalIndex = docIds.indexOf(docSnap.id);
          results[originalIndex] = data;

          // Cache the result
          if (useCache) {
            const cache = this.getCache(cacheType);
            const cacheKey = `doc_${collectionName}_${docSnap.id}`;
            cache.set(cacheKey, data);
          }
        });
      }
    }

    return results;
  }

  /**
   * 清除特定集合的缓存
   * Clear cache for specific collection
   */
  clearCollectionCache(collectionName: string): void {
    [apiCache, userDataCache, staticDataCache].forEach(cache => {
      const stats = cache.getStats();
      // This is a simplified approach - in a real implementation,
      // you'd want to track cache keys more systematically
      cache.clear();
    });
  }

  /**
   * 获取缓存统计信息
   * Get cache statistics
   */
  getCacheStats() {
    return {
      api: apiCache.getStats(),
      user: userDataCache.getStats(),
      static: staticDataCache.getStats()
    };
  }

  private getCache(type: 'api' | 'user' | 'static') {
    switch (type) {
      case 'user':
        return userDataCache;
      case 'static':
        return staticDataCache;
      default:
        return apiCache;
    }
  }

  private createQueryCacheKey(
    collectionName: string, 
    constraints: QueryConstraint[], 
    pagination: PaginationOptions
  ): string {
    // Create a deterministic cache key based on query parameters
    const constraintStr = constraints.map(c => c.toString()).join('_');
    const paginationStr = `${pagination.pageSize || this.DEFAULT_PAGE_SIZE}`;
    return `query_${collectionName}_${constraintStr}_${paginationStr}`;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Create singleton instance
export const optimizedFirestore = new OptimizedFirestoreService();

// Convenience functions
export const getDocument = <T>(
  collectionName: string, 
  docId: string, 
  options?: QueryOptions
) => optimizedFirestore.getDocument<T>(collectionName, docId, options);

export const getCollection = <T>(
  collectionName: string,
  constraints?: QueryConstraint[],
  pagination?: PaginationOptions,
  options?: QueryOptions
) => optimizedFirestore.getCollection<T>(collectionName, constraints, pagination, options);

export const getUserData = <T>(
  collectionName: string,
  userId: string,
  constraints?: QueryConstraint[]
) => optimizedFirestore.getUserData<T>(collectionName, userId, constraints);

export const getStaticData = <T>(
  collectionName: string,
  constraints?: QueryConstraint[]
) => optimizedFirestore.getStaticData<T>(collectionName, constraints);

export default optimizedFirestore;