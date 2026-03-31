import { AutomationDedupeStrategy } from '@prisma/client';
import {
  buildAutomationDedupeKey,
  shouldSkipByCooldown,
  validateAutomationRuleShape,
} from './automation-policy';

describe('automation-policy', () => {
  it('validates a canonical rule shape', () => {
    expect(() =>
      validateAutomationRuleShape({
        triggerKey: 'daily',
        actionConfig: [{ action: 'write_timeline_entry' }],
        cooldownMinutes: 5,
      }),
    ).not.toThrow();
  });

  it('rejects invalid trigger key', () => {
    expect(() =>
      validateAutomationRuleShape({
        triggerKey: 'invalid.trigger',
        actionConfig: [{ action: 'write_timeline_entry' }],
      }),
    ).toThrow('Invalid trigger key');
  });

  it('builds dedupe key by entity window', () => {
    const key = buildAutomationDedupeKey({
      strategy: AutomationDedupeStrategy.BY_ENTITY_WINDOW,
      ruleId: 'rule-1',
      churchId: 'church-1',
      triggerKey: 'threshold.absence_count',
      servantId: 'serv-1',
      windowBucket: '30d:2026-03-31',
    });

    expect(key).toBe('threshold.absence_count:rule-1:church-1:serv-1:30d:2026-03-31');
  });

  it('applies cooldown window correctly', () => {
    const recent = new Date(Date.now() - 2 * 60 * 1000);
    const old = new Date(Date.now() - 20 * 60 * 1000);

    expect(shouldSkipByCooldown(recent, 5)).toBe(true);
    expect(shouldSkipByCooldown(old, 5)).toBe(false);
    expect(shouldSkipByCooldown(null, 5)).toBe(false);
  });
});
