export const DEFAULT_WHATSAPP_TEMPLATES = [
  {
    eventKey: 'SCHEDULE_ASSIGNED',
    name: 'Nova Escala',
    content: 'Ola {{userName}}, voce recebeu uma nova escala: {{message}}',
  },
  {
    eventKey: 'SCHEDULE_SWAPPED',
    name: 'Alteracao de Escala',
    content: 'Sua escala foi alterada: {{message}}',
  },
  {
    eventKey: 'WORSHIP_SERVICE_REMINDER',
    name: 'Lembrete de Culto',
    content: 'Lembrete: {{message}}',
  },
  {
    eventKey: 'USER_ACCESS_CREATED',
    name: 'Criacao de Acesso',
    content: 'Seu acesso foi criado. {{message}}',
  },
  {
    eventKey: 'USER_PASSWORD_RESET',
    name: 'Reset de Senha',
    content: 'Sua senha foi redefinida. {{message}}',
  },
  {
    eventKey: 'PASTORAL_VISIT_CREATED',
    name: 'Convocacao Pastoral',
    content: 'Convocacao pastoral: {{message}}',
  },
  {
    eventKey: 'TRAINING_COMPLETED',
    name: 'Treinamento',
    content: 'Atualizacao de treinamento: {{message}}',
  },
] as const;
