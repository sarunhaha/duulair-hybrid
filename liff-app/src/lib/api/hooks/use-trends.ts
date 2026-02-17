import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { subDays, format } from 'date-fns';
import { th } from 'date-fns/locale';

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
export type TrendCategory = 'heart' | 'meds' | 'sleep' | 'exercise' | 'mood' | 'water' | 'glucose';

export interface CustomDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

// Helper functions
export function getLastNDays(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(today, n - 1 - i);
    return format(d, 'd MMM', { locale: th });
  });
}

export function getLastNDates(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(today, n - 1 - i);
    return format(d, 'yyyy-MM-dd');
  });
}

const DAYS_MAP: Record<string, number> = {
  '7d': 7,
  '15d': 15,
  '30d': 30,
  'custom': 0, // Will be calculated from custom dates
};

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
      if (!patientId) return getMockVitalsData(range, customRange);
      try {
        let url = `/trends/vitals/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Vitals trend API not available, using mock data');
        return getMockVitalsData(range, customRange);
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
      if (!patientId) return getMockMedsData(range, customRange);
      try {
        let url = `/trends/meds/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Meds trend API not available, using mock data');
        return getMockMedsData(range, customRange);
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
      if (!patientId) return getMockSleepData(range, customRange);
      try {
        let url = `/trends/sleep/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Sleep trend API not available, using mock data');
        return getMockSleepData(range, customRange);
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Helper to get days between dates
function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// Helper to get date range from custom dates
function getCustomDateRange(startDate: string, endDate: string): { dates: string[]; labels: string[] } {
  const days = getDaysBetween(startDate, endDate);
  const start = new Date(startDate);
  const dates: string[] = [];
  const labels: string[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(format(d, 'yyyy-MM-dd'));
    labels.push(format(d, 'd MMM', { locale: th }));
  }

  return { dates, labels };
}

// Mock Data Generators
function getMockVitalsData(range: TimeRange, customRange?: CustomDateRange): TrendData {
  let days: number;
  let labels: string[];
  let dates: string[];

  if (range === 'custom' && customRange) {
    days = getDaysBetween(customRange.startDate, customRange.endDate);
    const customDates = getCustomDateRange(customRange.startDate, customRange.endDate);
    labels = customDates.labels;
    dates = customDates.dates;
  } else {
    days = DAYS_MAP[range] || 7;
    labels = getLastNDays(days);
    dates = getLastNDates(days);
  }

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const sys_am = 118 + Math.floor(Math.random() * 25);
    const dia_am = 73 + Math.floor(Math.random() * 15);
    const pulse_am = 68 + Math.floor(Math.random() * 18);
    const sys_pm = 122 + Math.floor(Math.random() * 25);
    const dia_pm = 76 + Math.floor(Math.random() * 15);
    const pulse_pm = 72 + Math.floor(Math.random() * 20);
    // Overall = latest (PM if available, else AM)
    const sys = sys_pm;
    const dia = dia_pm;
    const hr = pulse_pm;
    const isHigh = sys >= 140 || dia >= 90;

    return {
      day,
      date: dates[i],
      systolic: sys,
      diastolic: dia,
      pulse: hr,
      sys_am, dia_am, pulse_am,
      sys_pm, dia_pm, pulse_pm,
      event: isHigh ? 'สูง' : undefined,
      note: isHigh && Math.random() > 0.5 ? 'ความดันสูงกว่าปกติ' : undefined,
    };
  });

  // Calculate averages
  const avgSys = Math.round(data.reduce((sum, d) => sum + (d.systolic || 0), 0) / data.length);
  const avgDia = Math.round(data.reduce((sum, d) => sum + (d.diastolic || 0), 0) / data.length);
  const measuredDays = data.filter((d) => d.systolic !== null).length;

  return {
    data,
    summary: {
      avg: `${avgSys}/${avgDia}`,
      label1: 'ค่าเฉลี่ย',
      count: `วัดแล้ว ${measuredDays}/${days} วัน`,
      label2: 'วันที่มีการวัด',
    },
    insight: getVitalsInsight(avgSys, avgDia, range),
  };
}

function getMockMedsData(range: TimeRange, customRange?: CustomDateRange): TrendData {
  let days: number;
  let labels: string[];
  let dates: string[];

  if (range === 'custom' && customRange) {
    days = getDaysBetween(customRange.startDate, customRange.endDate);
    const customDates = getCustomDateRange(customRange.startDate, customRange.endDate);
    labels = customDates.labels;
    dates = customDates.dates;
  } else {
    days = DAYS_MAP[range] || 7;
    labels = getLastNDays(days);
    dates = getLastNDates(days);
  }

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const target = 2;
    const done = Math.random() > 0.2 ? 2 : Math.random() > 0.5 ? 1 : 0;
    const percent = Math.round((done / target) * 100);

    return {
      day,
      date: dates[i],
      target,
      done,
      percent,
      event: done === 0 ? 'ลืม' : done < target ? 'พลาด' : undefined,
      note: done < target ? (done === 0 ? 'ลืมทั้งวัน' : 'พลาดบางมื้อ') : undefined,
    };
  });

  // Calculate stats
  const totalPercent = Math.round(data.reduce((sum, d) => sum + (d.percent || 0), 0) / data.length);
  const completeDays = data.filter((d) => d.percent === 100).length;

  return {
    data,
    summary: {
      avg: `${totalPercent}%`,
      label1: '% กินยาครบ',
      count: `กินครบ ${completeDays}/${days} วัน`,
      label2: 'วันกินครบ',
    },
    insight: getMedsInsight(totalPercent, completeDays, days),
  };
}

function getMockSleepData(range: TimeRange, customRange?: CustomDateRange): TrendData {
  let days: number;
  let labels: string[];
  let dates: string[];

  if (range === 'custom' && customRange) {
    days = getDaysBetween(customRange.startDate, customRange.endDate);
    const customDates = getCustomDateRange(customRange.startDate, customRange.endDate);
    labels = customDates.labels;
    dates = customDates.dates;
  } else {
    days = DAYS_MAP[range] || 7;
    labels = getLastNDays(days);
    dates = getLastNDates(days);
  }

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const hours = parseFloat((5 + Math.random() * 3.5).toFixed(1));
    const isLow = hours < 6;

    return {
      day,
      date: dates[i],
      hours,
      event: isLow ? 'น้อย' : undefined,
      note: isLow ? 'นอนน้อยกว่าเกณฑ์' : undefined,
    };
  });

  // Calculate stats
  const avgHours = (data.reduce((sum, d) => sum + (d.hours || 0), 0) / data.length).toFixed(1);
  const recordedNights = data.filter((d) => d.hours !== null).length;

  return {
    data,
    summary: {
      avg: `${avgHours} ชม.`,
      label1: 'ชม.นอนเฉลี่ย',
      count: `บันทึก ${recordedNights}/${days} คืน`,
      label2: 'คืนที่บันทึก',
    },
    insight: getSleepInsight(parseFloat(avgHours), days),
  };
}

// Insight generators
function getVitalsInsight(avgSys: number, avgDia: number, range: TimeRange): string {
  if (avgSys >= 140 || avgDia >= 90) {
    return 'ความดันโดยเฉลี่ยสูงกว่าปกติ ควรปรึกษาแพทย์เพื่อปรับยา';
  } else if (avgSys >= 130 || avgDia >= 80) {
    return 'ความดันอยู่ในระดับสูงกว่าปกติเล็กน้อย ควรระวังเรื่องอาหารเค็มและพักผ่อนให้เพียงพอ';
  }
  const daysText = range === '7d' ? 'สัปดาห์นี้' : range === '15d' ? '15 วันที่ผ่านมา' : 'เดือนนี้';
  return `ความดัน${daysText}อยู่ในเกณฑ์ดี ควบคุมได้ต่อเนื่อง`;
}

function getMedsInsight(percent: number, _completeDays: number, _totalDays: number): string {
  if (percent >= 95) {
    return 'กินยาครบถ้วนมาก สุดยอดครับ!';
  } else if (percent >= 80) {
    return 'กินยาได้ดี แต่ยังพลาดบ้าง ลองตั้งเตือนเพิ่มไหมครับ';
  } else if (percent >= 60) {
    return 'ช่วงนี้พลาดกินยาบ่อย ลองหาวิธีจดจำที่เหมาะกับคุณนะครับ';
  }
  return 'ต้องปรับปรุงการกินยา ลองตั้งนาฬิกาเตือนหรือบอกคนใกล้ชิดให้ช่วยเตือน';
}

function getSleepInsight(avgHours: number, _totalDays: number): string {
  if (avgHours >= 7) {
    return 'พักผ่อนเพียงพอ สุขภาพโดยรวมจะดีครับ';
  } else if (avgHours >= 6) {
    return 'นอนได้พอประมาณ ลองเข้านอนเร็วขึ้นอีกสัก 30 นาทีจะดีมากครับ';
  }
  return 'นอนน้อยกว่าเกณฑ์ ลองพักงีบช่วงบ่าย และเข้านอนเร็วขึ้นนะครับ';
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
      if (!patientId) return getMockExerciseData(range, customRange);
      try {
        let url = `/trends/exercise/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Exercise trend API not available, using mock data');
        return getMockExerciseData(range, customRange);
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
      if (!patientId) return getMockMoodData(range, customRange);
      try {
        let url = `/trends/mood/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Mood trend API not available, using mock data');
        return getMockMoodData(range, customRange);
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
      if (!patientId) return getMockWaterData(range, customRange);
      try {
        let url = `/trends/water/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Water trend API not available, using mock data');
        return getMockWaterData(range, customRange);
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Mock Data for Exercise
function getMockExerciseData(range: TimeRange, customRange?: CustomDateRange): TrendData {
  let days: number;
  let labels: string[];
  let dates: string[];

  if (range === 'custom' && customRange) {
    days = getDaysBetween(customRange.startDate, customRange.endDate);
    const customDates = getCustomDateRange(customRange.startDate, customRange.endDate);
    labels = customDates.labels;
    dates = customDates.dates;
  } else {
    days = DAYS_MAP[range] || 7;
    labels = getLastNDays(days);
    dates = getLastNDates(days);
  }

  const exerciseTypes = ['เดิน', 'วิ่ง', 'ว่ายน้ำ', 'ปั่นจักรยาน', 'โยคะ'];

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const hasExercise = Math.random() > 0.3;
    const duration = hasExercise ? Math.floor(15 + Math.random() * 45) : null;
    const exerciseType = hasExercise ? exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)] : undefined;

    return {
      day,
      date: dates[i],
      duration,
      exerciseType,
      event: duration && duration >= 30 ? 'ดี' : undefined,
      note: exerciseType,
    };
  });

  const exerciseDays = data.filter((d) => d.duration !== null).length;
  const avgDuration = exerciseDays > 0
    ? Math.round(data.reduce((sum, d) => sum + (d.duration || 0), 0) / exerciseDays)
    : 0;

  return {
    data,
    summary: {
      avg: exerciseDays > 0 ? `${avgDuration} นาที` : '-',
      label1: 'เวลาเฉลี่ย',
      count: `ออกกำลังกาย ${exerciseDays}/${days} วัน`,
      label2: 'วันที่ออกกำลังกาย',
    },
    insight: getExerciseInsight(exerciseDays, days, avgDuration),
  };
}

function getExerciseInsight(exerciseDays: number, totalDays: number, avgDuration: number): string {
  const ratio = exerciseDays / totalDays;
  if (ratio >= 0.7 && avgDuration >= 30) {
    return 'ออกกำลังกายสม่ำเสมอมาก สุขภาพแข็งแรงแน่นอนครับ!';
  } else if (ratio >= 0.5) {
    return 'ออกกำลังกายได้ดี ลองเพิ่มเวลาออกกำลังกายอีกนิดจะยิ่งดีครับ';
  } else if (ratio >= 0.3) {
    return 'ออกกำลังกายบ้าง ลองตั้งเป้าอย่างน้อยวันละ 30 นาที 5 วัน/สัปดาห์นะครับ';
  }
  return 'ช่วงนี้ออกกำลังกายน้อย ลองเริ่มจากเดินวันละ 15-20 นาทีก่อนนะครับ';
}

// Mock Data for Mood
function getMockMoodData(range: TimeRange, customRange?: CustomDateRange): TrendData {
  let days: number;
  let labels: string[];
  let dates: string[];

  if (range === 'custom' && customRange) {
    days = getDaysBetween(customRange.startDate, customRange.endDate);
    const customDates = getCustomDateRange(customRange.startDate, customRange.endDate);
    labels = customDates.labels;
    dates = customDates.dates;
  } else {
    days = DAYS_MAP[range] || 7;
    labels = getLastNDays(days);
    dates = getLastNDates(days);
  }

  const moods = ['happy', 'calm', 'neutral', 'sad', 'anxious'];
  const moodLabels: Record<string, string> = {
    happy: 'มีความสุข',
    calm: 'สงบ',
    neutral: 'เฉยๆ',
    sad: 'เศร้า',
    anxious: 'กังวล',
  };
  const moodScores: Record<string, number> = {
    happy: 5,
    calm: 4,
    neutral: 3,
    sad: 2,
    anxious: 1,
  };

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const hasMood = Math.random() > 0.2;
    const mood = hasMood ? moods[Math.floor(Math.random() * moods.length)] : null;
    const moodScore = mood ? moodScores[mood] : null;
    const stressLevel = hasMood ? Math.floor(1 + Math.random() * 5) : null;

    return {
      day,
      date: dates[i],
      mood,
      moodScore,
      stressLevel,
      event: moodScore && moodScore <= 2 ? 'ต่ำ' : undefined,
      note: mood ? moodLabels[mood] : undefined,
    };
  });

  const recordedDays = data.filter((d) => d.moodScore !== null).length;
  const avgMood = recordedDays > 0
    ? (data.reduce((sum, d) => sum + (d.moodScore || 0), 0) / recordedDays).toFixed(1)
    : '0';

  return {
    data,
    summary: {
      avg: recordedDays > 0 ? `${avgMood}/5` : '-',
      label1: 'คะแนนอารมณ์เฉลี่ย',
      count: `บันทึก ${recordedDays}/${days} วัน`,
      label2: 'วันที่บันทึก',
    },
    insight: getMoodInsight(parseFloat(avgMood), recordedDays, days),
  };
}

function getMoodInsight(avgMood: number, recordedDays: number, totalDays: number): string {
  if (recordedDays === 0) {
    return 'ยังไม่มีการบันทึกอารมณ์ ลองบันทึกทุกวันเพื่อติดตามสุขภาพจิตนะครับ';
  }
  if (avgMood >= 4) {
    return 'อารมณ์ดีสม่ำเสมอ ยอดเยี่ยมครับ! รักษาความสุขนี้ไว้นะครับ';
  } else if (avgMood >= 3) {
    return 'อารมณ์โดยรวมปกติดี ลองหากิจกรรมที่ชอบทำเพื่อเพิ่มความสุขนะครับ';
  } else if (avgMood >= 2) {
    return 'ช่วงนี้อารมณ์อาจไม่ค่อยดี ลองพูดคุยกับคนใกล้ชิดหรือทำกิจกรรมผ่อนคลายนะครับ';
  }
  return 'ดูเหมือนช่วงนี้อารมณ์ไม่ค่อยดี หากรู้สึกหนักใจ ลองปรึกษาผู้เชี่ยวชาญนะครับ';
}

// Mock Data for Water
function getMockWaterData(range: TimeRange, customRange?: CustomDateRange): TrendData {
  let days: number;
  let labels: string[];
  let dates: string[];

  if (range === 'custom' && customRange) {
    days = getDaysBetween(customRange.startDate, customRange.endDate);
    const customDates = getCustomDateRange(customRange.startDate, customRange.endDate);
    labels = customDates.labels;
    dates = customDates.dates;
  } else {
    days = DAYS_MAP[range] || 7;
    labels = getLastNDays(days);
    dates = getLastNDates(days);
  }

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const glasses = Math.floor(4 + Math.random() * 6);
    const ml = glasses * 250;
    const isLow = glasses < 6;

    return {
      day,
      date: dates[i],
      glasses,
      ml,
      event: isLow ? 'น้อย' : glasses >= 8 ? 'ดี' : undefined,
      note: isLow ? 'ดื่มน้ำน้อย' : glasses >= 8 ? 'ดื่มน้ำได้ดี' : undefined,
    };
  });

  const avgGlasses = Math.round(data.reduce((sum, d) => sum + (d.glasses || 0), 0) / data.length);
  const goodDays = data.filter((d) => (d.glasses || 0) >= 8).length;

  return {
    data,
    summary: {
      avg: `${avgGlasses} แก้ว`,
      label1: 'เฉลี่ย/วัน',
      count: `ดื่มครบ ${goodDays}/${days} วัน`,
      label2: 'วันดื่มครบ 8 แก้ว',
    },
    insight: getWaterInsight(avgGlasses, goodDays, days),
  };
}

function getWaterInsight(avgGlasses: number, goodDays: number, totalDays: number): string {
  if (avgGlasses >= 8) {
    return 'ดื่มน้ำได้ตามเป้าหมาย สุขภาพดีแน่นอนครับ!';
  } else if (avgGlasses >= 6) {
    return 'ดื่มน้ำได้ดี ลองเพิ่มอีก 2-3 แก้วต่อวันจะยิ่งดีครับ';
  } else if (avgGlasses >= 4) {
    return 'ดื่มน้ำน้อยไป ลองพกขวดน้ำติดตัวเพื่อเตือนให้ดื่มบ่อยขึ้นนะครับ';
  }
  return 'ดื่มน้ำน้อยมาก ร่างกายต้องการน้ำอย่างน้อย 8 แก้ว/วันนะครับ';
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
      if (!patientId) return getMockGlucoseData(range, customRange);
      try {
        let url = `/trends/glucose/${patientId}?range=${range}`;
        if (range === 'custom' && customRange) {
          url += `&startDate=${customRange.startDate}&endDate=${customRange.endDate}`;
        }
        const data = await apiClient.get<TrendData>(url);
        return data;
      } catch {
        console.warn('Glucose trend API not available, using mock data');
        return getMockGlucoseData(range, customRange);
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Mock Data for Glucose
function getMockGlucoseData(range: TimeRange, customRange?: CustomDateRange): TrendData {
  let days: number;
  let labels: string[];
  let dates: string[];

  if (range === 'custom' && customRange) {
    days = getDaysBetween(customRange.startDate, customRange.endDate);
    const customDates = getCustomDateRange(customRange.startDate, customRange.endDate);
    labels = customDates.labels;
    dates = customDates.dates;
  } else {
    days = DAYS_MAP[range] || 7;
    labels = getLastNDays(days);
    dates = getLastNDates(days);
  }

  const mealContexts = ['fasting', 'post_meal_1h', 'post_meal_2h', 'before_bed'];

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const glucose = 85 + Math.floor(Math.random() * 55);
    const mealContext = mealContexts[Math.floor(Math.random() * mealContexts.length)];
    const isFasting = mealContext === 'fasting' || mealContext === 'before_bed';
    const isHigh = isFasting ? glucose >= 126 : glucose >= 200;
    const isPreDiabetic = !isHigh && (isFasting ? glucose >= 100 : glucose >= 140);

    return {
      day,
      date: dates[i],
      glucose,
      mealContext,
      event: isHigh ? 'สูง' : isPreDiabetic ? 'เสี่ยง' : undefined,
      note: isHigh ? 'น้ำตาลสูงกว่าปกติ' : isPreDiabetic ? 'น้ำตาลสูงกว่าเกณฑ์เล็กน้อย' : undefined,
    };
  });

  const avgGlucose = Math.round(data.reduce((sum, d) => sum + (d.glucose || 0), 0) / data.length);
  const recordedDays = data.filter((d) => d.glucose !== null).length;

  return {
    data,
    summary: {
      avg: `${avgGlucose} mg/dL`,
      label1: 'ค่าเฉลี่ย',
      count: `วัดแล้ว ${recordedDays}/${days} วัน`,
      label2: 'วันที่มีการวัด',
    },
    insight: getGlucoseInsight(avgGlucose, recordedDays),
  };
}

function getGlucoseInsight(avgGlucose: number, recordedDays: number): string {
  if (recordedDays === 0) {
    return 'ยังไม่มีข้อมูลน้ำตาลในช่วงนี้ ลองวัดระดับน้ำตาลเพื่อติดตามสุขภาพนะครับ';
  }
  if (avgGlucose >= 126) {
    return 'ระดับน้ำตาลเฉลี่ยสูงกว่าปกติ ควรปรึกษาแพทย์เพื่อปรับยาหรือพฤติกรรม';
  } else if (avgGlucose >= 100) {
    return 'ระดับน้ำตาลอยู่ในช่วงเสี่ยง ควรลดอาหารหวานและออกกำลังกายสม่ำเสมอ';
  }
  return 'ระดับน้ำตาลอยู่ในเกณฑ์ปกติ ดีมากครับ รักษาพฤติกรรมนี้ต่อไป';
}
