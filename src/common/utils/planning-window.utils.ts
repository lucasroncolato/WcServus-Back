export type WindowMode = 'day' | 'week' | 'month' | 'rolling30' | 'rolling60' | 'rolling90';

export type PlanningWindowInput = {
  windowMode?: WindowMode;
  startDate?: string;
  endDate?: string;
};

const SAO_PAULO_OFFSET = '-03:00';

export function parseSaoPauloDateStart(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00${SAO_PAULO_OFFSET}`);
}

export function parseSaoPauloDateEnd(dateOnly: string): Date {
  return new Date(`${dateOnly}T23:59:59.999${SAO_PAULO_OFFSET}`);
}

export function formatDateOnlyInSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getSaoPauloWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(date);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday] ?? 0;
}

export function resolvePlanningWindow(input: PlanningWindowInput): { start?: Date; end?: Date } {
  if (!input.windowMode) {
    return {
      start: input.startDate ? parseSaoPauloDateStart(input.startDate) : undefined,
      end: input.endDate ? parseSaoPauloDateEnd(input.endDate) : undefined,
    };
  }

  const startDate = input.startDate as string;
  const start = parseSaoPauloDateStart(startDate);

  if (input.windowMode === 'day') {
    return { start, end: parseSaoPauloDateEnd(startDate) };
  }

  if (input.windowMode === 'week') {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { start, end: parseSaoPauloDateEnd(formatDateOnlyInSaoPaulo(end)) };
  }

  if (input.windowMode === 'month') {
    const [year, month] = startDate.split('-').map(Number);
    const monthStart = parseSaoPauloDateStart(`${year}-${String(month).padStart(2, '0')}-01`);
    const monthEnd = parseSaoPauloDateEnd(
      `${year}-${String(month).padStart(2, '0')}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`,
    );
    return { start: monthStart, end: monthEnd };
  }

  const rollingDays =
    input.windowMode === 'rolling30' ? 30 : input.windowMode === 'rolling60' ? 60 : 90;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (rollingDays - 1));
  return { start, end: parseSaoPauloDateEnd(formatDateOnlyInSaoPaulo(end)) };
}
