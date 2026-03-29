import { Injectable } from '@nestjs/common';
import { AppMetricsService } from '../observability/app-metrics.service';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class AppCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  constructor(private readonly metrics: AppMetricsService) {}

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) {
      this.metrics.recordCacheMiss(key);
      return null;
    }
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      this.metrics.recordCacheMiss(key);
      this.metrics.recordCacheEviction(key);
      return null;
    }
    this.metrics.recordCacheHit(key);
    return item.value as T;
  }

  set<T>(key: string, value: T, ttlMs = 30_000) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    this.metrics.recordCacheSet(key);
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs = 30_000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  del(pattern: string) {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        this.metrics.recordCacheEviction(key);
      }
    }
  }
}
