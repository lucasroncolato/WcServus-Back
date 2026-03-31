import { JourneyLogType } from '@prisma/client';
import { getAttendanceSeverity, shouldTriggerJourney } from '../attendance/attendance-status.utils';

export type JourneyTone = 'POSITIVE' | 'NEUTRAL' | 'ATTENTION';

export type JourneyEventProjection = {
  type: JourneyLogType;
  title: string;
  description: string;
  tone: JourneyTone;
};

export function classifyJourneyLogTone(logType: JourneyLogType): JourneyTone {
  if (logType === 'MILESTONE') return 'POSITIVE';
  if (logType === 'SERVICE' || logType === 'SUBSTITUTE' || logType === 'HELP') return 'POSITIVE';
  return 'NEUTRAL';
}

export function mapAttendanceToJourneyProjection(status: string): JourneyEventProjection | null {
  if (!shouldTriggerJourney(status)) return null;
  const severity = getAttendanceSeverity(status);
  const isAttention = severity === 'HIGH';

  return {
    type: JourneyLogType.SERVICE,
    title: isAttention ? 'Registro de ausencia no culto' : 'Registro de presenca no culto',
    description: isAttention ? 'Houve um registro de no-show. Reforce sua disponibilidade.' : 'Sua presenca foi registrada na jornada.',
    tone: isAttention ? 'ATTENTION' : 'POSITIVE',
  };
}

