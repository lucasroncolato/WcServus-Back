import { Injectable } from '@nestjs/common';
import { AppCacheService } from 'src/common/cache/cache.service';

@Injectable()
export class AnalyticsCacheFacade {
  constructor(private readonly cache: AppCacheService) {}

  async getOrSet<T>(
    keyParts: Array<string | number | undefined | null>,
    ttlSec: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const key = keyParts
      .filter((part) => part !== undefined && part !== null && String(part).length > 0)
      .join(':');
    return this.cache.getOrSet(key, factory, ttlSec * 1000);
  }
}
