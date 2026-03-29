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
  | 'ATTENDANCE_REGISTERED'
  | 'MINISTRY_TASK_TEMPLATE_CREATED'
  | 'MINISTRY_TASK_OCCURRENCE_CREATED'
  | 'MINISTRY_TASK_ASSIGNED'
  | 'MINISTRY_TASK_REASSIGNED'
  | 'MINISTRY_TASK_REALLOCATION_REQUESTED'
  | 'MINISTRY_TASK_REALLOCATED_AUTOMATICALLY'
  | 'MINISTRY_TASK_REALLOCATED_MANUALLY'
  | 'MINISTRY_TASK_UNASSIGNED_AFTER_SCALE_CHANGE'
  | 'MINISTRY_TASK_ASSIGNEE_ADDED'
  | 'MINISTRY_TASK_ASSIGNEE_REMOVED'
  | 'MINISTRY_TASK_OVERDUE'
  | 'MINISTRY_TASK_RECURRING_GENERATED'
  | 'MINISTRY_TASK_DUE_SOON'
  | 'MINISTRY_TASK_PROGRESS_UPDATED'
  | 'MINISTRY_TASK_COMPLETED'
  | 'MINISTRY_TASK_CANCELLED';

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
