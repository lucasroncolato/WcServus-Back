export const AUTOMATION_TRIGGER_CATALOG = [
  'attendance.recorded',
  'schedule.slot_assigned',
  'schedule.slot_confirmed',
  'schedule.slot_declined',
  'schedule.slot_no_response',
  'journey.constancy_drop',
  'pastoral.alert_created',
  'task.completed',
  'daily',
  'weekly',
  'every_n_hours',
  'before_service_start',
  'after_service_end',
  'threshold.absence_count',
  'threshold.no_show_count',
  'threshold.decline_count',
  'threshold.followup_pending_count',
] as const;

export type AutomationTriggerKey = (typeof AUTOMATION_TRIGGER_CATALOG)[number];

export function isAutomationTriggerKey(value: string): value is AutomationTriggerKey {
  return (AUTOMATION_TRIGGER_CATALOG as readonly string[]).includes(value);
}
