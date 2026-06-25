/**
 * 缓存服务 - 提供内存缓存和本地存储缓存功能
 * Cache Service - Provides in-memory and localStorage caching capabilities
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface CacheOptions {
  ttl?: number; // Default TTL in milliseconds (default: 5 minutes)
  maxSize?: number; // Maximum number of entries (default: 100)
  useLocalStorage?: boolean; // Whether to persist to localStorage
}

class CacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxSize = 100;
  private useLocalStorage = false;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || this.defaultTTL;
    this.maxSize = options.maxSize || this.maxSize;
    this.useLocalStorage = options.useLocalStorage || false;
  }

  /**
   * 设置缓存项
   * Set cache item
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    // Add to memory cache
    this.memoryCache.set(key, entry);

    // Enforce max size
    if (this.memoryCache.size > this.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
      if (this.useLocalStorage) {
        this.removeFromLocalStorage(firstKey);
      }
    }

    // Add to localStorage if enabled
    if (this.useLocalStorage) {
      this.saveToLocalStorage(key, entry);
    }
  }

  /**
   * 获取缓存项
   * Get cache item
   */
  get<T>(key: string): T | null {
    // Try memory cache first
    let entry = this.memoryCache.get(key);

    // If not in memory and localStorage is enabled, try localStorage
    if (!entry && this.useLocalStorage) {
      entry = this.loadFromLocalStorage(key);
      if (entry) {
        // Restore to memory cache
        this.memoryCache.set(key, entry);
      }
    }

    if (!entry) {
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 删除缓存项
   * Delete cache item
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    if (this.useLocalStorage) {
      this.removeFromLocalStorage(key);
    }
  }

  /**
   * 清空所有缓存
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    if (this.useLocalStorage) {
      this.clearLocalStorage();
    }
  }

  /**
   * 检查缓存项是否存在且未过期
   * Check if cache item exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 获取或设置缓存项（如果不存在则调用工厂函数）
   * Get or set cache item (call factory function if not exists)
   */
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * 获取缓存统计信息
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    localStorageSize: number;
    totalEntries: number;
    expiredEntries: number;
  } {
    const expiredEntries = Array.from(this.memoryCache.values())
      .filter(entry => this.isExpired(entry)).length;

    return {
      memorySize: this.memoryCache.size,
      localStorageSize: this.useLocalStorage ? this.getLocalStorageSize() : 0,
      totalEntries: this.memoryCache.size,
      expiredEntries
    };
  }

  /**
   * 清理过期的缓存项
   * Clean up expired cache items
   */
  cleanup(): void {
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private saveToLocalStorage(key: string, entry: CacheEntry<any>): void {
    try {
      const cacheKey = `cache_${key}`;
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private loadFromLocalStorage(key: string): CacheEntry<any> | null {
    try {
      const cacheKey = `cache_${key}`;
      const stored = localStorage.getItem(cacheKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }

  private removeFromLocalStorage(key: string): void {
    try {
      const cacheKey = `cache_${key}`;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  private clearLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }

  private getLocalStorageSize(): number {
    try {
      const keys = Object.keys(localStorage);
      return keys.filter(key => key.startsWith('cache_')).length;
    } catch (error) {
      return 0;
    }
  }
}

// Create different cache instances for different use cases
export const apiCache = new CacheService({
  ttl: 5 * 60 * 1000, // 5 minutes for API responses
  maxSize: 50,
  useLocalStorage: false
});

export const userDataCache = new CacheService({
  ttl: 15 * 60 * 1000, // 15 minutes for user data
  maxSize: 20,
  useLocalStorage: true
});

export const staticDataCache = new CacheService({
  ttl: 60 * 60 * 1000, // 1 hour for static data
  maxSize: 30,
  useLocalStorage: true
});

// Auto cleanup every 10 minutes
setInterval(() => {
  apiCache.cleanup();
  userDataCache.cleanup();
  staticDataCache.cleanup();
}, 10 * 60 * 1000);

export { CacheService };
export default CacheService;