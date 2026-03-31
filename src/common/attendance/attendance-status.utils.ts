import { AttendanceStatus } from '@prisma/client';
import { ATTENDANCE_POLICY, AttendanceSeverity } from './attendance-policy';

const ALL_STATUSES = Object.values(AttendanceStatus) as AttendanceStatus[];
const POSITIVE_STATUSES = ALL_STATUSES.filter((status) => ATTENDANCE_POLICY[status].countsAsPresence);
const ABSENCE_STATUSES = ALL_STATUSES.filter((status) => ATTENDANCE_POLICY[status].countsAsAbsence);
const JUSTIFIED_ABSENCE_STATUSES = ABSENCE_STATUSES.filter((status) => ATTENDANCE_POLICY[status].isJustifiedAbsence);
const UNJUSTIFIED_ABSENCE_STATUSES = ABSENCE_STATUSES.filter((status) => !ATTENDANCE_POLICY[status].isJustifiedAbsence);

function toAttendanceStatus(status: AttendanceStatus | string): AttendanceStatus | null {
  if (typeof status !== 'string') {
    return status;
  }
  return ALL_STATUSES.includes(status as AttendanceStatus) ? (status as AttendanceStatus) : null;
}

export function allAttendanceStatuses() {
  return [...ALL_STATUSES];
}

export function attendancePositiveStatuses() {
  return [...POSITIVE_STATUSES] as AttendanceStatus[];
}

export function attendanceAbsenceStatuses() {
  return [...ABSENCE_STATUSES] as AttendanceStatus[];
}

export function attendanceUnjustifiedAbsenceStatuses() {
  return [...UNJUSTIFIED_ABSENCE_STATUSES] as AttendanceStatus[];
}

export function attendanceJustifiedAbsenceStatuses() {
  return [...JUSTIFIED_ABSENCE_STATUSES] as AttendanceStatus[];
}

export function isPositiveAttendanceStatus(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].countsAsPresence : false;
}

export function isAbsenceAttendanceStatus(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].countsAsAbsence : false;
}

export function isJustifiedAbsenceAttendanceStatus(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].isJustifiedAbsence : false;
}

export function getReliabilityImpact(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].reliabilityImpact : 0;
}

export function getEngagementImpact(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].engagementImpact : 0;
}

export function getEligibilityImpact(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].eligibilityImpact : 0;
}

export function shouldTriggerJourney(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].triggersJourneyEvent : false;
}

export function shouldTriggerPastoral(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].pastoralAlert : false;
}

export function shouldIncludeInAnalytics(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].includedInAnalytics : false;
}

export function shouldIncludeInDashboard(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].includedInDashboard : false;
}

export function shouldIncludeInReports(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].includedInReports : false;
}

export function shouldGenerateTimeline(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].generatesTimeline : false;
}

export function shouldTriggerAutomation(status: AttendanceStatus | string) {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].triggersAutomation : false;
}

export function getAttendanceSeverity(status: AttendanceStatus | string): AttendanceSeverity {
  const resolved = toAttendanceStatus(status);
  return resolved ? ATTENDANCE_POLICY[resolved].severity : 'NEUTRAL';
}
