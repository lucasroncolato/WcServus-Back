import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextState = {
  requestId: string;
  churchId?: string | null;
  userId?: string | null;
  method?: string;
  route?: string;
};

@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContextState>();

  run<T>(state: RequestContextState, callback: () => T): T {
    return this.als.run(state, callback);
  }

  get(): RequestContextState | undefined {
    return this.als.getStore();
  }

  requestId(): string | undefined {
    return this.get()?.requestId;
  }
}
