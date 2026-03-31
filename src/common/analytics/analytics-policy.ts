export type AnalyticsView = 'church' | 'ministry' | 'team' | 'servant' | 'timeline';
export type AnalyticsWindowKey = '7d' | '30d' | '60d' | '90d' | 'month' | 'quarter';
export type AnalyticsTrendGroupBy = 'day' | 'week' | 'month';

export type AnalyticsMetricPolicy = {
  category: 'operational' | 'attendance' | 'schedule' | 'journey' | 'pastoral' | 'capacity';
  label: string;
  usesAttendancePolicy: boolean;
  views: AnalyticsView[];
  windows: AnalyticsWindowKey[];
  supportsTrend: boolean;
  useSnapshot: boolean;
  cacheTtlSec: number;
};

export const ANALYTICS_POLICY = {
  slot_fill_rate: {
    category: 'operational',
    label: 'Taxa de preenchimento de slots',
    usesAttendancePolicy: false,
    views: ['church', 'ministry', 'team'],
    windows: ['7d', '30d', '60d', '90d', 'month', 'quarter'],
    supportsTrend: true,
    useSnapshot: false,
    cacheTtlSec: 120,
  },
  attendance_present_rate: {
    category: 'attendance',
    label: 'Taxa de presenca efetiva',
    usesAttendancePolicy: true,
    views: ['church', 'ministry', 'team', 'servant'],
    windows: ['7d', '30d', '60d', '90d', 'month', 'quarter'],
    supportsTrend: true,
    useSnapshot: false,
    cacheTtlSec: 120,
  },
  no_show_rate: {
    category: 'attendance',
    label: 'Taxa de no-show',
    usesAttendancePolicy: true,
    views: ['church', 'ministry', 'team', 'servant'],
    windows: ['30d', '60d', '90d', 'month', 'quarter'],
    supportsTrend: true,
    useSnapshot: false,
    cacheTtlSec: 180,
  },
  schedule_decline_rate: {
    category: 'schedule',
    label: 'Taxa de recusa de escala',
    usesAttendancePolicy: false,
    views: ['church', 'ministry', 'team', 'servant'],
    windows: ['7d', '30d', '60d', '90d', 'month', 'quarter'],
    supportsTrend: true,
    useSnapshot: false,
    cacheTtlSec: 120,
  },
  avg_constancy_score: {
    category: 'journey',
    label: 'Constancia agregada',
    usesAttendancePolicy: false,
    views: ['church', 'ministry', 'team'],
    windows: ['30d', '60d', '90d', 'month', 'quarter'],
    supportsTrend: true,
    useSnapshot: false,
    cacheTtlSec: 300,
  },
  pastoral_open_alerts: {
    category: 'pastoral',
    label: 'Alertas pastorais abertos',
    usesAttendancePolicy: false,
    views: ['church', 'ministry', 'team', 'servant'],
    windows: ['7d', '30d', '60d', '90d', 'month', 'quarter'],
    supportsTrend: false,
    useSnapshot: false,
    cacheTtlSec: 120,
  },
} as const;

export type AnalyticsMetricKey = keyof typeof ANALYTICS_POLICY;

export function resolveAnalyticsWindow(window?: string | null): AnalyticsWindowKey {
  const normalized = String(window ?? '').trim().toLowerCase();
  const valid: AnalyticsWindowKey[] = ['7d', '30d', '60d', '90d', 'month', 'quarter'];
  return valid.includes(normalized as AnalyticsWindowKey) ? (normalized as AnalyticsWindowKey) : '30d';
}

export function isMetricVisibleForView(metricKey: AnalyticsMetricKey, view: AnalyticsView) {
  return (ANALYTICS_POLICY[metricKey].views as readonly AnalyticsView[]).includes(view);
}

export function shouldUseSnapshot(metricKey: AnalyticsMetricKey) {
  return ANALYTICS_POLICY[metricKey].useSnapshot;
}

export function usesAttendancePolicy(metricKey: AnalyticsMetricKey) {
  return ANALYTICS_POLICY[metricKey].usesAttendancePolicy;
}

export function getAnalyticsCacheTtl(metricKey: AnalyticsMetricKey) {
  return ANALYTICS_POLICY[metricKey].cacheTtlSec;
}
