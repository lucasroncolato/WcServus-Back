import { JourneyNextStepPriority } from '@prisma/client';

export type JourneyNextStepCatalogItem = {
  type: string;
  priority: JourneyNextStepPriority;
  title: string;
  description: string;
  source: string;
};

export const JOURNEY_NEXT_STEP_CATALOG: Record<string, JourneyNextStepCatalogItem> = {
  COMPLETE_TRAINING: {
    type: 'COMPLETE_TRAINING',
    priority: JourneyNextStepPriority.HIGH,
    title: 'Concluir treinamento pendente',
    description: 'Avance no proximo treinamento para servir com mais seguranca.',
    source: 'JOURNEY_RULES',
  },
  IMPROVE_RESPONSE: {
    type: 'IMPROVE_RESPONSE',
    priority: JourneyNextStepPriority.MEDIUM,
    title: 'Responder escalas com antecedencia',
    description: 'Confirmar a escala mais cedo ajuda seu ministerio a se organizar.',
    source: 'JOURNEY_RULES',
  },
  RETAKE_CONSTANCY: {
    type: 'RETAKE_CONSTANCY',
    priority: JourneyNextStepPriority.HIGH,
    title: 'Retomar constancia',
    description: 'Procure manter presenca regular nas proximas semanas.',
    source: 'JOURNEY_RULES',
  },
  IMPROVE_PUNCTUALITY: {
    type: 'IMPROVE_PUNCTUALITY',
    priority: JourneyNextStepPriority.MEDIUM,
    title: 'Reforcar pontualidade',
    description: 'Chegar no horario fortalece seu compromisso com a equipe.',
    source: 'JOURNEY_RULES',
  },
  TALK_TO_LEADERSHIP: {
    type: 'TALK_TO_LEADERSHIP',
    priority: JourneyNextStepPriority.LOW,
    title: 'Conversar com sua lideranca',
    description: 'Se precisar, converse com sua lideranca para planejar o proximo passo.',
    source: 'JOURNEY_RULES',
  },
};

