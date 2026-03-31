import { AttendanceStatus } from '@prisma/client';
import { ATTENDANCE_POLICY } from './attendance-policy';

describe('attendance-policy', () => {
  it('defines policy for all AttendanceStatus values', () => {
    const statuses = Object.values(AttendanceStatus);
    expect(Object.keys(ATTENDANCE_POLICY)).toHaveLength(statuses.length);
    for (const status of statuses) {
      expect(ATTENDANCE_POLICY[status]).toBeDefined();
    }
  });

  it('keeps UNKNOWN and CANCELLED_SERVICE neutral for analytics and scoring', () => {
    expect(ATTENDANCE_POLICY[AttendanceStatus.UNKNOWN].includedInAnalytics).toBe(false);
    expect(ATTENDANCE_POLICY[AttendanceStatus.CANCELLED_SERVICE].includedInAnalytics).toBe(false);
    expect(ATTENDANCE_POLICY[AttendanceStatus.UNKNOWN].eligibilityImpact).toBe(0);
    expect(ATTENDANCE_POLICY[AttendanceStatus.CANCELLED_SERVICE].eligibilityImpact).toBe(0);
  });
});

