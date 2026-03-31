export const TIMELINE_EVENT_TYPES = [
  'TIMELINE_SCHEDULE_ASSIGNED',
  'TIMELINE_SCHEDULE_CONFIRMED',
  'TIMELINE_SCHEDULE_DECLINED',
  'TIMELINE_SCHEDULE_SUBSTITUTE_REQUESTED',
  'TIMELINE_SCHEDULE_SUBSTITUTED',
  'TIMELINE_SCHEDULE_CLOSED',
  'TIMELINE_SCHEDULE_AUTO_FILLED',
  'TIMELINE_ATTENDANCE_RECORDED',
  'TIMELINE_ATTENDANCE_NO_SHOW',
  'TIMELINE_ATTENDANCE_LATE_PATTERN',
  'TIMELINE_ATTENDANCE_EXTRA_SERVICE',
  'TIMELINE_JOURNEY_RETURN_AFTER_GAP',
  'TIMELINE_JOURNEY_TRAINING_COMPLETED',
  'TIMELINE_JOURNEY_NEW_MINISTRY_SERVICE',
  'TIMELINE_PASTORAL_ALERT_CREATED',
  'TIMELINE_PASTORAL_CASE_OPENED',
  'TIMELINE_PASTORAL_FOLLOWUP_CREATED',
  'TIMELINE_PASTORAL_ALERT_RESOLVED',
  'TIMELINE_AUTOMATION_RULE_EXECUTED',
  'TIMELINE_AUTOMATION_RULE_SKIPPED',
  'TIMELINE_AUTOMATION_CREATED_ALERT',
  'TIMELINE_TRAINING_COMPLETED',
  'TIMELINE_TASK_COMPLETED',
  'TIMELINE_MINISTRY_ROLE_CHANGED',
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export type TimelineCategory =
  | 'SCHEDULE'
  | 'ATTENDANCE'
  | 'JOURNEY'
  | 'PASTORAL'
  | 'AUTOMATION'
  | 'TRAINING'
  | 'TASK'
  | 'SYSTEM';

export type TimelineSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type TimelinePolicyItem = {
  category: TimelineCategory;
  severity: TimelineSeverity;
  include: boolean;
  dedupe: boolean;
  aggregatable: boolean;
  aggregationWindowMinutes?: number;
  title: string;
  message: string;
};

export type TimelineTemplateInput = {
  actorName?: string | null;
  servantName?: string | null;
  ministryName?: string | null;
  serviceName?: string | null;
  ruleName?: string | null;
  count?: number;
};

export const TIMELINE_POLICY: Record<TimelineEventType, TimelinePolicyItem> = {
  TIMELINE_SCHEDULE_ASSIGNED: {
    category: 'SCHEDULE',
    severity: 'INFO',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Escala atribuida',
    message: 'Uma escala foi atribuida para servico.',
  },
  TIMELINE_SCHEDULE_CONFIRMED: {
    category: 'SCHEDULE',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Escala confirmada',
    message: 'A escala foi confirmada pelo servo.',
  },
  TIMELINE_SCHEDULE_DECLINED: {
    category: 'SCHEDULE',
    severity: 'WARNING',
    include: true,
    dedupe: true,
    aggregatable: false,
    title: 'Escala recusada',
    message: 'A escala foi recusada e requer acompanhamento.',
  },
  TIMELINE_SCHEDULE_SUBSTITUTE_REQUESTED: {
    category: 'SCHEDULE',
    severity: 'WARNING',
    include: true,
    dedupe: true,
    aggregatable: false,
    title: 'Substituto solicitado',
    message: 'Foi solicitada substituicao para um slot.',
  },
  TIMELINE_SCHEDULE_SUBSTITUTED: {
    category: 'SCHEDULE',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Substituicao concluida',
    message: 'Um slot foi preenchido por substituicao.',
  },
  TIMELINE_SCHEDULE_CLOSED: {
    category: 'SCHEDULE',
    severity: 'INFO',
    include: true,
    dedupe: true,
    aggregatable: false,
    title: 'Escala encerrada',
    message: 'A ocorrencia foi encerrada para operacao.',
  },
  TIMELINE_SCHEDULE_AUTO_FILLED: {
    category: 'SCHEDULE',
    severity: 'INFO',
    include: true,
    dedupe: true,
    aggregatable: true,
    aggregationWindowMinutes: 30,
    title: 'Auto-preenchimento aplicado',
    message: 'Slots foram auto-preenchidos automaticamente.',
  },
  TIMELINE_ATTENDANCE_RECORDED: {
    category: 'ATTENDANCE',
    severity: 'INFO',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Presenca registrada',
    message: 'Uma presenca foi registrada no culto.',
  },
  TIMELINE_ATTENDANCE_NO_SHOW: {
    category: 'ATTENDANCE',
    severity: 'CRITICAL',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'No-show registrado',
    message: 'Foi registrado no-show em escala confirmada.',
  },
  TIMELINE_ATTENDANCE_LATE_PATTERN: {
    category: 'ATTENDANCE',
    severity: 'WARNING',
    include: true,
    dedupe: true,
    aggregatable: true,
    aggregationWindowMinutes: 60,
    title: 'Padrao de atraso detectado',
    message: 'Foi identificado padrao recorrente de atraso.',
  },
  TIMELINE_ATTENDANCE_EXTRA_SERVICE: {
    category: 'ATTENDANCE',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Servico extra registrado',
    message: 'O servo atuou em servico extra fora da escala.',
  },
  TIMELINE_JOURNEY_RETURN_AFTER_GAP: {
    category: 'JOURNEY',
    severity: 'INFO',
    include: true,
    dedupe: true,
    aggregatable: false,
    title: 'Retorno apos periodo sem servir',
    message: 'Foi detectado retorno apos intervalo de inatividade.',
  },
  TIMELINE_JOURNEY_TRAINING_COMPLETED: {
    category: 'JOURNEY',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Treinamento concluido',
    message: 'Um treinamento ministerial foi concluido.',
  },
  TIMELINE_JOURNEY_NEW_MINISTRY_SERVICE: {
    category: 'JOURNEY',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Novo ministerio atendido',
    message: 'O servo serviu em um novo contexto ministerial.',
  },
  TIMELINE_PASTORAL_ALERT_CREATED: {
    category: 'PASTORAL',
    severity: 'WARNING',
    include: true,
    dedupe: true,
    aggregatable: false,
    title: 'Alerta pastoral criado',
    message: 'Um alerta pastoral foi criado para acompanhamento.',
  },
  TIMELINE_PASTORAL_CASE_OPENED: {
    category: 'PASTORAL',
    severity: 'WARNING',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Caso pastoral aberto',
    message: 'Um caso pastoral foi aberto para cuidado.',
  },
  TIMELINE_PASTORAL_FOLLOWUP_CREATED: {
    category: 'PASTORAL',
    severity: 'INFO',
    include: true,
    dedupe: true,
    aggregatable: false,
    title: 'Follow-up pastoral agendado',
    message: 'Um follow-up pastoral foi agendado.',
  },
  TIMELINE_PASTORAL_ALERT_RESOLVED: {
    category: 'PASTORAL',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Alerta pastoral resolvido',
    message: 'Um alerta pastoral foi resolvido pela lideranca.',
  },
  TIMELINE_AUTOMATION_RULE_EXECUTED: {
    category: 'AUTOMATION',
    severity: 'INFO',
    include: true,
    dedupe: true,
    aggregatable: true,
    aggregationWindowMinutes: 15,
    title: 'Automacao executada',
    message: 'Uma regra de automacao foi executada.',
  },
  TIMELINE_AUTOMATION_RULE_SKIPPED: {
    category: 'AUTOMATION',
    severity: 'INFO',
    include: true,
    dedupe: true,
    aggregatable: true,
    aggregationWindowMinutes: 15,
    title: 'Automacao ignorada',
    message: 'Uma regra de automacao foi ignorada por dedupe/cooldown.',
  },
  TIMELINE_AUTOMATION_CREATED_ALERT: {
    category: 'AUTOMATION',
    severity: 'WARNING',
    include: true,
    dedupe: true,
    aggregatable: true,
    aggregationWindowMinutes: 15,
    title: 'Automacao gerou alerta',
    message: 'Uma automacao gerou alerta para acompanhamento.',
  },
  TIMELINE_TRAINING_COMPLETED: {
    category: 'TRAINING',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: false,
    title: 'Treinamento concluido',
    message: 'Treinamento concluido com sucesso.',
  },
  TIMELINE_TASK_COMPLETED: {
    category: 'TASK',
    severity: 'SUCCESS',
    include: true,
    dedupe: false,
    aggregatable: true,
    aggregationWindowMinutes: 30,
    title: 'Tarefa concluida',
    message: 'Uma tarefa ministerial foi concluida.',
  },
  TIMELINE_MINISTRY_ROLE_CHANGED: {
    category: 'SYSTEM',
    severity: 'INFO',
    include: true,
    dedupe: true,
    aggregatable: false,
    title: 'Vinculo ministerial atualizado',
    message: 'O vinculo ministerial do servo foi atualizado.',
  },
};

export function isTimelineEventType(value: string): value is TimelineEventType {
  return (TIMELINE_EVENT_TYPES as readonly string[]).includes(value);
}

export function shouldPublishTimelineEvent(eventType: string) {
  return isTimelineEventType(eventType) ? TIMELINE_POLICY[eventType].include : false;
}

export function getTimelineCategory(eventType: TimelineEventType): TimelineCategory {
  return TIMELINE_POLICY[eventType].category;
}

export function getTimelineSeverity(eventType: TimelineEventType): TimelineSeverity {
  return TIMELINE_POLICY[eventType].severity;
}

export function isTimelineEventAggregatable(eventType: TimelineEventType) {
  return TIMELINE_POLICY[eventType].aggregatable;
}

export function buildTimelineTitle(eventType: TimelineEventType, fallback?: string) {
  return fallback?.trim() || TIMELINE_POLICY[eventType].title;
}

export function buildTimelineMessage(eventType: TimelineEventType, fallback?: string) {
  return fallback?.trim() || TIMELINE_POLICY[eventType].message;
}

export function sanitizeTimelineMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) return undefined;

  const blockedKeys = new Set([
    'journeyNextSteps',
    'journeySymbolicState',
    'journeyPrivateLog',
    'pastoralNotes',
    'pastoralNote',
    'privateNarrative',
  ]);

  const entries = Object.entries(metadata).filter(([key]) => !blockedKeys.has(key));
  return Object.fromEntries(entries);
}
