import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

// Types
export interface TrendDataPoint {
  day: string;
  date: string;
  // Heart/Vitals
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  // Vitals AM/PM
  sys_am?: number | null;
  dia_am?: number | null;
  pulse_am?: number | null;
  sys_pm?: number | null;
  dia_pm?: number | null;
  pulse_pm?: number | null;
  // Sleep
  hours?: number | null;
  // Meds
  target?: number;
  done?: number;
  percent?: number;
  // Exercise
  duration?: number | null; // minutes
  exerciseType?: string;
  // Mood
  mood?: string | null;
  moodScore?: number | null;
  stressLevel?: number | null;
  // Water
  glasses?: number | null;
  ml?: number | null;
  // Glucose
  glucose?: number | null;
  mealContext?: string | null;
  glucoseReadings?: { glucose: number; mealContext: string | null; time: string }[];
  // Common
  note?: string;
  event?: string;
}

export interface TrendSummary {
  avg: string;
  label1: string;
  count: string;
  label2: string;
}

export interface TrendData {
  data: TrendDataPoint[];
  summary: TrendSummary;
  insight: string;
}

export type TimeRange = '7d' | '15d' | '30d' | 'custom';
export type TrendCategory = 'heart' | 'meds' | 'sleep' | 'exercise' | 'mood' | 'water' | 'glucose' | 'lab_results';

export interface CustomDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}


// Query keys
export const trendKeys = {
  all: ['trends'] as const,
  vitals: (patientId: string, range: TimeRange) =>
    [...trendKeys.all, 'vitals', patientId, range] as const,
  meds: (patientId: string, range: TimeRange) =>
    [...trendKeys.all, 'meds', patientId, range] as const,
  sleep: (patientId: string, range: TimeRange) =>
    [...trendKeys.all, 'sleep', patientId, range] as const,
  exercise: (patientId: string, range: TimeRange) =>
    [...trendKeys.all, 'exercise', patientId, range] as const,
  mood: (patientId: string, range: TimeRange) =>
    [...trendKeys.all, 'mood', patientId, range] as const,
  water: (patientId: string, range: TimeRange) =>
    [...trendKeys.all, 'water', patientId, range] as const,
  glucose: (patientId: string, range: TimeRange) =>
    [...trendKeys.all, 'glucose', patientId, range] as const,
};

// Vitals Trends Hook
export function useVitalsTrend(patientId: string | null, range: TimeRange, customRange?: CustomDateRange) {
  const queryKey = patientId
    ? range === 'custom' && customRange
      ? [...trendKeys.vitals(patientId, range), customRange.startDate, customRange.endDate]
      : trendKeys.vitals(patientId, range)
    : ['trends', 'vitals', 'none'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getEmptyTrendData();
      try {
        let url = `/trends/vitals/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Vitals trend API not available');
        return getEmptyTrendData();
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Medication Trends Hook
export function useMedsTrend(patientId: string | null, range: TimeRange, customRange?: CustomDateRange) {
  const queryKey = patientId
    ? range === 'custom' && customRange
      ? [...trendKeys.meds(patientId, range), customRange.startDate, customRange.endDate]
      : trendKeys.meds(patientId, range)
    : ['trends', 'meds', 'none'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getEmptyTrendData();
      try {
        let url = `/trends/meds/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Meds trend API not available');
        return getEmptyTrendData();
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Sleep Trends Hook
export function useSleepTrend(patientId: string | null, range: TimeRange, customRange?: CustomDateRange) {
  const queryKey = patientId
    ? range === 'custom' && customRange
      ? [...trendKeys.sleep(patientId, range), customRange.startDate, customRange.endDate]
      : trendKeys.sleep(patientId, range)
    : ['trends', 'sleep', 'none'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getEmptyTrendData();
      try {
        let url = `/trends/sleep/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Sleep trend API not available');
        return getEmptyTrendData();
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}


// Empty data for when no patient or no data exists
export function getEmptyTrendData(): TrendData {
  return {
    data: [],
    summary: {
      avg: '-',
      label1: '',
      count: '-',
      label2: '',
    },
    insight: '',
  };
}

// Exercise Trends Hook
export function useExerciseTrend(patientId: string | null, range: TimeRange, customRange?: CustomDateRange) {
  const queryKey = patientId
    ? range === 'custom' && customRange
      ? [...trendKeys.exercise(patientId, range), customRange.startDate, customRange.endDate]
      : trendKeys.exercise(patientId, range)
    : ['trends', 'exercise', 'none'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getEmptyTrendData();
      try {
        let url = `/trends/exercise/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Exercise trend API not available');
        return getEmptyTrendData();
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Mood Trends Hook
export function useMoodTrend(patientId: string | null, range: TimeRange, customRange?: CustomDateRange) {
  const queryKey = patientId
    ? range === 'custom' && customRange
      ? [...trendKeys.mood(patientId, range), customRange.startDate, customRange.endDate]
      : trendKeys.mood(patientId, range)
    : ['trends', 'mood', 'none'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getEmptyTrendData();
      try {
        let url = `/trends/mood/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Mood trend API not available');
        return getEmptyTrendData();
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Water Trends Hook
export function useWaterTrend(patientId: string | null, range: TimeRange, customRange?: CustomDateRange) {
  const queryKey = patientId
    ? range === 'custom' && customRange
      ? [...trendKeys.water(patientId, range), customRange.startDate, customRange.endDate]
      : trendKeys.water(patientId, range)
    : ['trends', 'water', 'none'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getEmptyTrendData();
      try {
        let url = `/trends/water/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Water trend API not available');
        return getEmptyTrendData();
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Glucose Trends Hook
export function useGlucoseTrend(patientId: string | null, range: TimeRange, customRange?: CustomDateRange) {
  const queryKey = patientId
    ? range === 'custom' && customRange
      ? [...trendKeys.glucose(patientId, range), customRange.startDate, customRange.endDate]
      : trendKeys.glucose(patientId, range)
    : ['trends', 'glucose', 'none'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getEmptyTrendData();
      try {
        let url = `/trends/glucose/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Glucose trend API not available');
        return getEmptyTrendData();
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

