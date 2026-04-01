import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type LockContext = {
  key: string;
  pgLockId: bigint;
};

@Injectable()
export class SchedulerLockService {
  private readonly localLocks = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async withLock<T>(
    lockName: string,
    execute: () => Promise<T>,
    options?: { scope?: string | null },
  ): Promise<{ acquired: boolean; result?: T }> {
    const context = this.buildContext(lockName, options?.scope ?? null);
    const acquired = await this.acquire(context);
    if (!acquired) {
      return { acquired: false };
    }

    try {
      const result = await execute();
      return { acquired: true, result };
    } finally {
      await this.release(context);
    }
  }

  private buildContext(lockName: string, scope: string | null): LockContext {
    const key = `${lockName}:${scope ?? 'global'}`;
    return {
      key,
      pgLockId: this.hashToBigInt(key),
    };
  }

  private async acquire(context: LockContext) {
    if (this.localLocks.has(context.key)) {
      return false;
    }

    this.localLocks.add(context.key);
    const shouldTryPgLock = (process.env.DATABASE_URL ?? '').includes('postgres');

    if (!shouldTryPgLock) {
      return true;
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ locked: boolean }>>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        context.pgLockId.toString(),
      );
      const locked = Boolean(rows?.[0]?.locked);
      if (!locked) {
        this.localLocks.delete(context.key);
      }
      return locked;
    } catch {
      // Fallback seguro para ambientes sem suporte ao advisory lock.
      return true;
    }
  }

  private async release(context: LockContext) {
    const shouldTryPgLock = (process.env.DATABASE_URL ?? '').includes('postgres');
    if (shouldTryPgLock) {
      try {
        await this.prisma.$queryRawUnsafe(
          'SELECT pg_advisory_unlock($1)',
          context.pgLockId.toString(),
        );
      } catch {
        // no-op
      }
    }
    this.localLocks.delete(context.key);
  }

  private hashToBigInt(input: string) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    const signed = hash | 0;
    return BigInt(signed);
  }
}

