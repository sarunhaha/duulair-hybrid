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
  // Sleep
  hours?: number | null;
  // Meds
  target?: number;
  done?: number;
  percent?: number;
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

export type TimeRange = '7d' | '15d' | '30d';
export type TrendCategory = 'heart' | 'meds' | 'sleep';

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

const DAYS_MAP = {
  '7d': 7,
  '15d': 15,
  '30d': 30,
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
};

// Vitals Trends Hook
export function useVitalsTrend(patientId: string | null, range: TimeRange) {
  return useQuery({
    queryKey: patientId ? trendKeys.vitals(patientId, range) : ['trends', 'vitals', 'none'],
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getMockVitalsData(range);
      try {
        const data = await apiClient.get<TrendData>(`/trends/vitals/${patientId}?range=${range}`);
        return data;
      } catch {
        console.warn('Vitals trend API not available, using mock data');
        return getMockVitalsData(range);
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Medication Trends Hook
export function useMedsTrend(patientId: string | null, range: TimeRange) {
  return useQuery({
    queryKey: patientId ? trendKeys.meds(patientId, range) : ['trends', 'meds', 'none'],
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getMockMedsData(range);
      try {
        const data = await apiClient.get<TrendData>(`/trends/meds/${patientId}?range=${range}`);
        return data;
      } catch {
        console.warn('Meds trend API not available, using mock data');
        return getMockMedsData(range);
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Sleep Trends Hook
export function useSleepTrend(patientId: string | null, range: TimeRange) {
  return useQuery({
    queryKey: patientId ? trendKeys.sleep(patientId, range) : ['trends', 'sleep', 'none'],
    queryFn: async (): Promise<TrendData> => {
      if (!patientId) return getMockSleepData(range);
      try {
        const data = await apiClient.get<TrendData>(`/trends/sleep/${patientId}?range=${range}`);
        return data;
      } catch {
        console.warn('Sleep trend API not available, using mock data');
        return getMockSleepData(range);
      }
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

// Mock Data Generators
function getMockVitalsData(range: TimeRange): TrendData {
  const days = DAYS_MAP[range];
  const labels = getLastNDays(days);
  const dates = getLastNDates(days);

  const data: TrendDataPoint[] = labels.map((day, i) => {
    const sys = 120 + Math.floor(Math.random() * 25);
    const dia = 75 + Math.floor(Math.random() * 15);
    const hr = 70 + Math.floor(Math.random() * 20);
    const isHigh = sys >= 140 || dia >= 90;

    return {
      day,
      date: dates[i],
      systolic: sys,
      diastolic: dia,
      pulse: hr,
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

function getMockMedsData(range: TimeRange): TrendData {
  const days = DAYS_MAP[range];
  const labels = getLastNDays(days);
  const dates = getLastNDates(days);

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

function getMockSleepData(range: TimeRange): TrendData {
  const days = DAYS_MAP[range];
  const labels = getLastNDays(days);
  const dates = getLastNDates(days);

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
