import { ObjectId } from 'mongodb';

interface CacheItem {
  value: any;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheItem>();

  public get(key: string): any {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  public set(key: string, value: any, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  public del(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

class RedisClient {
  private memoryFallback = new MemoryCache();
  private redisClient: any = null;
  private isRedisEnabled = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    // Attempt to load ioredis dynamically to keep this library robust if ioredis isn't installed
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        console.log('ℹ️ Redis URL not configured. Using in-memory fallback cache.');
        return;
      }
      
      const { default: Redis } = await import('ioredis');
      this.redisClient = new Redis(redisUrl);
      
      this.redisClient.on('error', (err: any) => {
        console.error('❌ Redis connection error:', err.message);
        this.isRedisEnabled = false;
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Redis connected successfully.');
        this.isRedisEnabled = true;
      });
    } catch (e) {
      // Dynamic import failed, fallback quietly to in-memory
      this.isRedisEnabled = false;
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error('⚠️ Redis GET failed, falling back to memory:', err);
      }
    }
    return this.memoryFallback.get(key) as T | null;
  }

  public async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (err) {
        console.error('⚠️ Redis SET failed, falling back to memory:', err);
      }
    }
    this.memoryFallback.set(key, value, ttlSeconds);
  }

  public async del(key: string): Promise<void> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err) {
        console.error('⚠️ Redis DEL failed, falling back to memory:', err);
      }
    }
    this.memoryFallback.del(key);
  }

  public async invalidatePattern(pattern: string): Promise<void> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
        return;
      } catch (err) {
        console.error('⚠️ Redis invalidation failed:', err);
      }
    }
    // Simple memory clear pattern
    this.memoryFallback.clear();
  }
}

export const redis = new RedisClient();
