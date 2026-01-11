import { describe, it, expect } from 'vitest';
import {
  getDateRange,
  getBpStatus,
  getBpStatusLabel,
  getMedsStatusLabel,
  getWaterStatusLabel,
  getActivityTypeLabel,
} from '@/lib/api/hooks/use-reports';
import { subDays } from 'date-fns';

describe('use-reports helpers', () => {
  describe('getDateRange', () => {
    it('returns 7-day range for 7d', () => {
      const { startDate, endDate } = getDateRange('7d');
      const expectedStart = subDays(new Date(), 6);

      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
      expect(endDate.toDateString()).toBe(new Date().toDateString());
    });

    it('returns 30-day range for 30d', () => {
      const { startDate } = getDateRange('30d');
      const expectedStart = subDays(new Date(), 29);

      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
    });

    it('returns 90-day range for 90d', () => {
      const { startDate } = getDateRange('90d');
      const expectedStart = subDays(new Date(), 89);

      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
    });
  });

  describe('getBpStatus', () => {
    it('returns normal for BP < 130/80', () => {
      expect(getBpStatus(120, 75)).toBe('normal');
      expect(getBpStatus(125, 78)).toBe('normal');
    });

    it('returns elevated for BP >= 130/80 but < 140/90', () => {
      expect(getBpStatus(135, 82)).toBe('elevated');
      expect(getBpStatus(130, 80)).toBe('elevated');
    });

    it('returns high for BP >= 140/90 but < 180/120', () => {
      expect(getBpStatus(150, 95)).toBe('high');
      expect(getBpStatus(140, 90)).toBe('high');
    });

    it('returns crisis for BP >= 180/120', () => {
      expect(getBpStatus(185, 125)).toBe('crisis');
      expect(getBpStatus(180, 120)).toBe('crisis');
    });
  });

  describe('getBpStatusLabel', () => {
    it('returns Thai labels for BP status', () => {
      expect(getBpStatusLabel('normal')).toBe('ปกติ');
      expect(getBpStatusLabel('elevated')).toBe('สูงเล็กน้อย');
      expect(getBpStatusLabel('high')).toBe('สูง');
      expect(getBpStatusLabel('crisis')).toBe('สูงมาก');
    });
  });

  describe('getMedsStatusLabel', () => {
    it('returns Thai labels for meds status', () => {
      expect(getMedsStatusLabel('good')).toBe('ดีมาก');
      expect(getMedsStatusLabel('fair')).toBe('พอใช้');
      expect(getMedsStatusLabel('poor')).toBe('ต้องปรับปรุง');
    });
  });

  describe('getWaterStatusLabel', () => {
    it('returns Thai labels for water status', () => {
      expect(getWaterStatusLabel('good')).toBe('เพียงพอ');
      expect(getWaterStatusLabel('fair')).toBe('พอใช้');
      expect(getWaterStatusLabel('poor')).toBe('น้อยเกินไป');
    });
  });

  describe('getActivityTypeLabel', () => {
    it('returns Thai labels for activity types', () => {
      expect(getActivityTypeLabel('medication')).toBe('กินยา');
      expect(getActivityTypeLabel('vitals')).toBe('วัดความดัน');
      expect(getActivityTypeLabel('water')).toBe('ดื่มน้ำ');
      expect(getActivityTypeLabel('symptom')).toBe('อาการ');
      expect(getActivityTypeLabel('sleep')).toBe('การนอน');
      expect(getActivityTypeLabel('exercise')).toBe('ออกกำลังกาย');
    });

    it('returns original type for unknown types', () => {
      expect(getActivityTypeLabel('unknown')).toBe('unknown');
    });
  });
});
