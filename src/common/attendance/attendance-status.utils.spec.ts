import { AttendanceStatus } from '@prisma/client';
import {
  allAttendanceStatuses,
  attendanceAbsenceStatuses,
  attendanceJustifiedAbsenceStatuses,
  attendancePositiveStatuses,
  attendanceUnjustifiedAbsenceStatuses,
  getAttendanceSeverity,
  getEligibilityImpact,
  getEngagementImpact,
  getReliabilityImpact,
  isAbsenceAttendanceStatus,
  isJustifiedAbsenceAttendanceStatus,
  isPositiveAttendanceStatus,
  shouldIncludeInAnalytics,
  shouldTriggerJourney,
  shouldTriggerPastoral,
} from './attendance-status.utils';

describe('attendance-status.utils', () => {
  it('exposes all enum statuses', () => {
    expect(allAttendanceStatuses()).toEqual(expect.arrayContaining(Object.values(AttendanceStatus)));
  });

  it('classifies positive statuses correctly', () => {
    const positive = attendancePositiveStatuses();
    expect(positive).toEqual(
      expect.arrayContaining([
        AttendanceStatus.PRESENTE,
        AttendanceStatus.LATE,
        AttendanceStatus.LEFT_EARLY,
        AttendanceStatus.SUBSTITUTED,
        AttendanceStatus.EXTRA_SERVICE,
      ]),
    );
    expect(isPositiveAttendanceStatus(AttendanceStatus.LATE)).toBe(true);
    expect(isPositiveAttendanceStatus(AttendanceStatus.NO_SHOW)).toBe(false);
  });

  it('classifies absence statuses correctly', () => {
    expect(attendanceAbsenceStatuses()).toEqual(
      expect.arrayContaining([
        AttendanceStatus.FALTA,
        AttendanceStatus.NO_SHOW,
        AttendanceStatus.FALTA_JUSTIFICADA,
        AttendanceStatus.EXCUSED_ABSENCE,
      ]),
    );
    expect(isAbsenceAttendanceStatus(AttendanceStatus.NO_SHOW)).toBe(true);
    expect(isAbsenceAttendanceStatus(AttendanceStatus.PRESENTE)).toBe(false);
  });

  it('separates justified and unjustified absences', () => {
    expect(attendanceJustifiedAbsenceStatuses()).toEqual(
      expect.arrayContaining([AttendanceStatus.FALTA_JUSTIFICADA, AttendanceStatus.EXCUSED_ABSENCE]),
    );
    expect(attendanceUnjustifiedAbsenceStatuses()).toEqual(
      expect.arrayContaining([AttendanceStatus.FALTA, AttendanceStatus.NO_SHOW]),
    );
    expect(isJustifiedAbsenceAttendanceStatus(AttendanceStatus.FALTA_JUSTIFICADA)).toBe(true);
    expect(isJustifiedAbsenceAttendanceStatus(AttendanceStatus.FALTA)).toBe(false);
  });

  it('keeps UNKNOWN and CANCELLED_SERVICE neutral', () => {
    expect(isPositiveAttendanceStatus(AttendanceStatus.UNKNOWN)).toBe(false);
    expect(isAbsenceAttendanceStatus(AttendanceStatus.UNKNOWN)).toBe(false);
    expect(isPositiveAttendanceStatus(AttendanceStatus.CANCELLED_SERVICE)).toBe(false);
    expect(isAbsenceAttendanceStatus(AttendanceStatus.CANCELLED_SERVICE)).toBe(false);
  });

  it('exposes policy-based impacts and flags through helpers', () => {
    expect(getReliabilityImpact(AttendanceStatus.PRESENTE)).toBeGreaterThan(0);
    expect(getEngagementImpact(AttendanceStatus.NO_SHOW)).toBeLessThan(0);
    expect(getEligibilityImpact(AttendanceStatus.NO_SHOW)).toBeLessThan(0);
    expect(getAttendanceSeverity(AttendanceStatus.NO_SHOW)).toBe('HIGH');
    expect(shouldTriggerPastoral(AttendanceStatus.NO_SHOW)).toBe(true);
    expect(shouldTriggerJourney(AttendanceStatus.EXCUSED_ABSENCE)).toBe(true);
    expect(shouldIncludeInAnalytics(AttendanceStatus.CANCELLED_SERVICE)).toBe(false);
  });
});
