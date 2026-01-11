import { describe, it, expect } from 'vitest';
import {
  calculateAge,
  formatThaiDate,
  formatGender,
} from '@/lib/api/hooks/use-profile';

describe('use-profile helpers', () => {
  describe('calculateAge', () => {
    it('returns null for undefined birthDate', () => {
      expect(calculateAge(undefined)).toBeNull();
    });

    it('calculates age correctly', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 30;
      const birthDate = `${birthYear}-01-01`;
      const age = calculateAge(birthDate);

      // Age should be approximately 30 (depending on current date)
      expect(age).toBeGreaterThanOrEqual(29);
      expect(age).toBeLessThanOrEqual(31);
    });

    it('handles birthday not yet passed this year', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 25;
      // Set birth month to December (if current month is not December)
      const birthDate = `${birthYear}-12-31`;
      const age = calculateAge(birthDate);

      // If today is before Dec 31, age should be 24, otherwise 25
      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(25);
    });
  });

  describe('formatThaiDate', () => {
    it('returns dash for undefined date', () => {
      expect(formatThaiDate(undefined)).toBe('-');
    });

    it('formats date in Thai format with Buddhist era year', () => {
      const result = formatThaiDate('2024-01-15');
      // Should include Buddhist era year (2024 + 543 = 2567)
      expect(result).toContain('2567');
      expect(result).toContain('15');
      expect(result).toContain('ม.ค.');
    });

    it('formats different months correctly', () => {
      expect(formatThaiDate('2024-06-01')).toContain('มิ.ย.');
      expect(formatThaiDate('2024-12-25')).toContain('ธ.ค.');
    });
  });

  describe('formatGender', () => {
    it('returns dash for undefined gender', () => {
      expect(formatGender(undefined)).toBe('-');
    });

    it('formats male as ชาย', () => {
      expect(formatGender('male')).toBe('ชาย');
    });

    it('formats female as หญิง', () => {
      expect(formatGender('female')).toBe('หญิง');
    });

    it('formats other as อื่นๆ', () => {
      expect(formatGender('other')).toBe('อื่นๆ');
    });

    it('returns original value for unknown gender', () => {
      expect(formatGender('custom')).toBe('custom');
    });
  });
});
