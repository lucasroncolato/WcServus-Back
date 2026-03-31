export const AUTOMATION_CONDITION_CATALOG = [
  'field_equals',
  'field_in',
  'count_in_window_gte',
  'score_below_threshold',
  'has_open_pastoral_case_eq',
  'service_locked_eq',
  'module_enabled_eq',
  'within_scope_eq',
  'not_alerted_in_window_eq',
  'no_active_followup_eq',
  'and',
  'or',
  'not',
] as const;

export type AutomationConditionKey = (typeof AUTOMATION_CONDITION_CATALOG)[number];

export function isAutomationConditionKey(value: string): value is AutomationConditionKey {
  return (AUTOMATION_CONDITION_CATALOG as readonly string[]).includes(value);
}
