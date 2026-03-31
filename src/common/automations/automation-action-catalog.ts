export const AUTOMATION_ACTION_CATALOG = [
  'create_pastoral_alert',
  'open_pastoral_record',
  'create_pastoral_followup',
  'notify_leader',
  'notify_pastor',
  'notify_servant',
  'resend_schedule_notification',
  'suggest_substitute',
  'flag_slot_attention',
  'write_timeline_entry',
  'write_audit_log',
  'create_task',
  'assign_task_to_leader',
] as const;

export type AutomationActionKey = (typeof AUTOMATION_ACTION_CATALOG)[number];

export function isAutomationActionKey(value: string): value is AutomationActionKey {
  return (AUTOMATION_ACTION_CATALOG as readonly string[]).includes(value);
}
