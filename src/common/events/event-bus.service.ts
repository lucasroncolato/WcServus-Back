import { Injectable } from '@nestjs/common';
import { LogService } from '../log/log.service';
import { DomainEvent, DomainEventHandler, DomainEventName } from './domain-event';

@Injectable()
export class EventBusService {
  private readonly handlers = new Map<DomainEventName, DomainEventHandler[]>();

  constructor(private readonly logService: LogService) {}

  on<TPayload extends Record<string, unknown>>(
    eventName: DomainEventName,
    handler: DomainEventHandler<TPayload>,
  ) {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler as DomainEventHandler);
    this.handlers.set(eventName, list);
  }

  async emit<TPayload extends Record<string, unknown>>(event: DomainEvent<TPayload>) {
    const handlers = this.handlers.get(event.name) ?? [];

    this.logService.log('Domain event emitted', EventBusService.name, {
      event: event.name,
      handlerCount: handlers.length,
      actorUserId: event.actorUserId ?? null,
      churchId: event.churchId ?? null,
    });

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logService.error('Domain event handler failure', String(error), EventBusService.name, {
          event: event.name,
        });
      }
    }
  }
}

