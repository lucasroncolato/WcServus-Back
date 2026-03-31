import {
  ANALYTICS_POLICY,
  getAnalyticsCacheTtl,
  isMetricVisibleForView,
  resolveAnalyticsWindow,
  shouldUseSnapshot,
  usesAttendancePolicy,
} from './analytics-policy';

describe('ANALYTICS_POLICY', () => {
  it('contains visibility and ttl for each metric key', () => {
    const keys = Object.keys(ANALYTICS_POLICY);
    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      const metric = ANALYTICS_POLICY[key as keyof typeof ANALYTICS_POLICY];
      expect(metric.views.length).toBeGreaterThan(0);
      expect(metric.windows.length).toBeGreaterThan(0);
      expect(metric.cacheTtlSec).toBeGreaterThan(0);
    }
  });

  it('resolves windows with safe fallback', () => {
    expect(resolveAnalyticsWindow('7d')).toBe('7d');
    expect(resolveAnalyticsWindow('invalid')).toBe('30d');
  });

  it('returns metric helpers consistently', () => {
    expect(isMetricVisibleForView('attendance_present_rate', 'church')).toBe(true);
    expect(usesAttendancePolicy('attendance_present_rate')).toBe(true);
    expect(shouldUseSnapshot('attendance_present_rate')).toBe(false);
    expect(getAnalyticsCacheTtl('attendance_present_rate')).toBeGreaterThan(0);
  });
});
