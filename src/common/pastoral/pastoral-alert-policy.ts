import { PastoralAlertSeverity, PastoralAlertSource } from '@prisma/client';

export type PastoralAlertType =
  | 'NO_SHOW_IMMEDIATE'
  | 'RECURRENT_ABSENCE'
  | 'RECURRENT_LATE'
  | 'PROLONGED_INACTIVITY'
  | 'EXCUSED_ABSENCE_PATTERN'
  | 'REPEATED_DECLINE'
  | 'NO_RESPONSE_TO_SCHEDULE'
  | 'UNCONFIRMED_PATTERN'
  | 'FREQUENT_SUBSTITUTION_NEEDED'
  | 'CONSTANCY_DROP'
  | 'RETURN_AFTER_GAP'
  | 'LOW_READINESS_SIGNAL';

export type PastoralAlertDedupeStrategy = 'BY_SERVICE' | 'BY_SLOT' | 'BY_WINDOW' | 'BY_SERVANT';

export type PastoralAlertPolicyRule = {
  severity: PastoralAlertSeverity;
  source: PastoralAlertSource;
  reopenWhenResolved: boolean;
  dedupeStrategy: PastoralAlertDedupeStrategy;
  windowDays?: number;
  threshold?: number;
  createFollowUp: boolean;
  defaultMessage: string;
};

export const PASTORAL_ALERT_POLICY: Record<PastoralAlertType, PastoralAlertPolicyRule> = {
  NO_SHOW_IMMEDIATE: {
    severity: PastoralAlertSeverity.HIGH,
    source: PastoralAlertSource.ATTENDANCE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_SERVICE',
    createFollowUp: true,
    defaultMessage:
      'No-show registrado. Recomendado acompanhamento pastoral imediato com foco em cuidado.',
  },
  RECURRENT_ABSENCE: {
    severity: PastoralAlertSeverity.MEDIUM,
    source: PastoralAlertSource.ATTENDANCE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 3,
    createFollowUp: false,
    defaultMessage:
      'Padrao de faltas recorrentes identificado. Recomenda-se acompanhamento pastoral.',
  },
  RECURRENT_LATE: {
    severity: PastoralAlertSeverity.LOW,
    source: PastoralAlertSource.ATTENDANCE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 3,
    createFollowUp: false,
    defaultMessage:
      'Padrao de atrasos recorrentes identificado. Sugere-se acompanhamento leve de apoio.',
  },
  PROLONGED_INACTIVITY: {
    severity: PastoralAlertSeverity.MEDIUM,
    source: PastoralAlertSource.ATTENDANCE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 45,
    threshold: 1,
    createFollowUp: true,
    defaultMessage:
      'Periodo prolongado sem registro de servico. Recomenda-se contato pastoral de acolhimento.',
  },
  EXCUSED_ABSENCE_PATTERN: {
    severity: PastoralAlertSeverity.LOW,
    source: PastoralAlertSource.ATTENDANCE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 45,
    threshold: 4,
    createFollowUp: false,
    defaultMessage:
      'Faltas justificadas recorrentes identificadas. Sugere-se acompanhamento leve de cuidado.',
  },
  REPEATED_DECLINE: {
    severity: PastoralAlertSeverity.MEDIUM,
    source: PastoralAlertSource.SCHEDULE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 3,
    createFollowUp: false,
    defaultMessage:
      'Recusas recorrentes de escala identificadas. Recomenda-se conversa pastoral com acolhimento.',
  },
  NO_RESPONSE_TO_SCHEDULE: {
    severity: PastoralAlertSeverity.MEDIUM,
    source: PastoralAlertSource.SCHEDULE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_SLOT',
    createFollowUp: false,
    defaultMessage:
      'Escala pendente sem resposta no prazo esperado. Recomenda-se contato da lideranca.',
  },
  UNCONFIRMED_PATTERN: {
    severity: PastoralAlertSeverity.LOW,
    source: PastoralAlertSource.SCHEDULE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 3,
    createFollowUp: false,
    defaultMessage:
      'Padrao recorrente de nao confirmacao detectado. Recomenda-se acompanhamento de rotina.',
  },
  FREQUENT_SUBSTITUTION_NEEDED: {
    severity: PastoralAlertSeverity.LOW,
    source: PastoralAlertSource.SCHEDULE,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 3,
    createFollowUp: false,
    defaultMessage:
      'Substituicoes frequentes identificadas. Sugerido acompanhamento de disponibilidade.',
  },
  CONSTANCY_DROP: {
    severity: PastoralAlertSeverity.MEDIUM,
    source: PastoralAlertSource.JOURNEY,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 1,
    createFollowUp: false,
    defaultMessage:
      'Queda de constancia ministerial identificada. Recomenda-se cuidado pastoral proativo.',
  },
  RETURN_AFTER_GAP: {
    severity: PastoralAlertSeverity.LOW,
    source: PastoralAlertSource.JOURNEY,
    reopenWhenResolved: false,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 1,
    createFollowUp: false,
    defaultMessage:
      'Retorno apos periodo de afastamento identificado. Sugere-se acolhimento pastoral.',
  },
  LOW_READINESS_SIGNAL: {
    severity: PastoralAlertSeverity.MEDIUM,
    source: PastoralAlertSource.JOURNEY,
    reopenWhenResolved: true,
    dedupeStrategy: 'BY_WINDOW',
    windowDays: 30,
    threshold: 1,
    createFollowUp: false,
    defaultMessage:
      'Sinal de prontidao ministerial baixa identificado. Recomenda-se acompanhamento.',
  },
};

export function getPastoralAlertPolicy(type: PastoralAlertType) {
  return PASTORAL_ALERT_POLICY[type];
}
