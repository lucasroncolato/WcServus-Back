export type JourneyMilestoneCatalogItem = {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  repeatable: boolean;
};

export const JOURNEY_MILESTONE_CATALOG: JourneyMilestoneCatalogItem[] = [
  {
    code: 'FIRST_ASSIGNMENT_ACCEPTED',
    name: 'Primeira escala aceita',
    description: 'Confirmou a primeira escala para servir.',
    icon: 'check',
    category: 'ESCALA',
    repeatable: false,
  },
  {
    code: 'FIRST_PRESENCE_CONFIRMED',
    name: 'Primeira presenca confirmada',
    description: 'Registrou sua primeira presenca no culto.',
    icon: 'sparkles',
    category: 'PRESENCA',
    repeatable: false,
  },
  {
    code: 'FOUR_CONSECUTIVE_PRESENCES',
    name: '4 presencas seguidas',
    description: 'Manteve quatro servicos com presenca positiva em sequencia.',
    icon: 'calendar-check',
    category: 'CONSTANCIA',
    repeatable: true,
  },
  {
    code: 'TRAINING_COMPLETED',
    name: 'Treinamento concluido',
    description: 'Concluiu treinamento ministerial.',
    icon: 'graduation-cap',
    category: 'TREINAMENTO',
    repeatable: true,
  },
  {
    code: 'NEW_MINISTRY_SERVICE',
    name: 'Servico em novo ministerio',
    description: 'Serviu pela primeira vez em um novo ministerio.',
    icon: 'route',
    category: 'EXPANSAO',
    repeatable: true,
  },
  {
    code: 'RETURN_AFTER_GAP',
    name: 'Retorno apos afastamento',
    description: 'Retornou para servir apos um periodo sem atividade.',
    icon: 'refresh-cw',
    category: 'RETORNO',
    repeatable: true,
  },
  {
    code: 'CONSISTENCY_30_DAYS',
    name: 'Constancia 30 dias',
    description: 'Manteve constancia de servico no ultimo mes.',
    icon: 'calendar',
    category: 'CONSTANCIA',
    repeatable: true,
  },
  {
    code: 'CONSISTENCY_90_DAYS',
    name: 'Constancia 90 dias',
    description: 'Manteve constancia de servico por tres meses.',
    icon: 'calendar-heart',
    category: 'CONSTANCIA',
    repeatable: true,
  },
  {
    code: 'EXTRA_SERVICE_HELP',
    name: 'Servico extra',
    description: 'Serviu fora da escala para apoiar a equipe.',
    icon: 'heart-handshake',
    category: 'APOIO',
    repeatable: true,
  },
  {
    code: 'SUBSTITUTION_SUPPORT',
    name: 'Suporte em substituicao',
    description: 'Assumiu uma substituicao para manter o culto organizado.',
    icon: 'repeat',
    category: 'APOIO',
    repeatable: true,
  },
];

