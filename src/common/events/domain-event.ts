export type DomainEventName =
  | 'SERVANT_CREATED'
  | 'SERVANT_UPDATED'
  | 'TRAINING_COMPLETED'
  | 'PASTORAL_PENDING_OPENED'
  | 'PASTORAL_PENDING_RESOLVED'
  | 'SCHEDULE_GENERATED'
  | 'SLOT_ASSIGNED'
  | 'SLOT_CONFIRMED'
  | 'SLOT_DECLINED'
  | 'ATTENDANCE_REGISTERED';

export type DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  name: DomainEventName;
  payload: TPayload;
  occurredAt: Date;
  actorUserId?: string;
  churchId?: string | null;
};

export type DomainEventHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (
  event: DomainEvent<TPayload>,
) => Promise<void> | void;

