import { buildTimelineMessage, getTimelineCategory, getTimelineSeverity, sanitizeTimelineMetadata, shouldPublishTimelineEvent } from './timeline-policy';

describe('timeline-policy', () => {
  it('resolves category and severity for known event', () => {
    expect(getTimelineCategory('TIMELINE_ATTENDANCE_NO_SHOW')).toBe('ATTENDANCE');
    expect(getTimelineSeverity('TIMELINE_ATTENDANCE_NO_SHOW')).toBe('CRITICAL');
    expect(shouldPublishTimelineEvent('TIMELINE_ATTENDANCE_NO_SHOW')).toBe(true);
  });

  it('sanitizes private metadata keys', () => {
    const sanitized = sanitizeTimelineMetadata({
      pastoralNotes: 'secret',
      journeyNextSteps: ['x'],
      safe: 'ok',
    });

    expect(sanitized).toEqual({ safe: 'ok' });
  });

  it('uses default message when fallback is empty', () => {
    expect(buildTimelineMessage('TIMELINE_TASK_COMPLETED', '')).toBe('Uma tarefa ministerial foi concluida.');
  });
});
