import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

const router = Router();

// Types
interface TrendDataPoint {
  day: string;
  date: string;
  // Vitals
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
  duration?: number | null;
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

interface TrendSummary {
  avg: string;
  label1: string;
  count: string;
  label2: string;
}

interface TrendData {
  data: TrendDataPoint[];
  summary: TrendSummary;
  insight: string;
}

// Thai month abbreviations
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Helper: Get range in days
function getRangeDays(range: string): number {
  const map: Record<string, number> = { '7d': 7, '15d': 15, '30d': 30, 'custom': 0 };
  return map[range] || 7;
}

// Helper: Get days between dates
function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// Helper: Get custom date range
function getCustomDateRange(startDate: string, endDate: string): { dates: string[]; labels: string[] } {
  const days = getDaysBetween(startDate, endDate);
  const start = new Date(startDate);
  const dates: string[] = [];
  const labels: string[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(formatISODate(d));
    labels.push(formatThaiShort(d));
  }

  return { dates, labels };
}

// Helper: Format date as Thai short format (e.g., "5 ม.ค.")
function formatThaiShort(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]}`;
}

// Helper: Format date as ISO date (e.g., "2025-01-05")
function formatISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper: Parse ISO date string to Date object
function parseISODate(dateStr: string): Date {
  return new Date(dateStr);
}

// Helper: Subtract days from date
function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

// Helper: Get date array for range
function getDateRange(days: number): { dates: string[]; labels: string[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: string[] = [];
  const labels: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(today, i);
    dates.push(formatISODate(d));
    labels.push(formatThaiShort(d));
  }

  return { dates, labels };
}

/**
 * GET /api/trends/vitals/:patientId
 * Get blood pressure trends
 */
router.get('/vitals/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const range = (req.query.range as string) || '7d';
  const customStartDate = req.query.startDate as string;
  const customEndDate = req.query.endDate as string;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    let dates: string[];
    let labels: string[];
    let days: number;

    if (range === 'custom' && customStartDate && customEndDate) {
      const customRange = getCustomDateRange(customStartDate, customEndDate);
      dates = customRange.dates;
      labels = customRange.labels;
      days = dates.length;
    } else {
      days = getRangeDays(range);
      const dateRange = getDateRange(days);
      dates = dateRange.dates;
      labels = dateRange.labels;
    }

    const startDate = dates[0];

    // Query vitals logs
    const { data: vitals, error } = await supabase
      .from('vitals_logs')
      .select('bp_systolic, bp_diastolic, heart_rate, measured_at')
      .eq('patient_id', patientId)
      .gte('measured_at', `${startDate}T00:00:00`)
      .order('measured_at', { ascending: true });

    if (error) throw error;

    // Group by date with AM/PM split
    interface VitalReading { systolic: number; diastolic: number; pulse: number }
    const byDate: Record<string, {
      latest: VitalReading;
      am: VitalReading | null;
      pm: VitalReading | null;
    }> = {};

    (vitals || []).forEach((v) => {
      if (!v.bp_systolic || !v.bp_diastolic) return;
      const dateKey = formatISODate(parseISODate(v.measured_at));
      const bangkokHour = new Date(new Date(v.measured_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getHours();
      const isAM = bangkokHour < 12;

      const reading: VitalReading = {
        systolic: v.bp_systolic,
        diastolic: v.bp_diastolic,
        pulse: v.heart_rate || 0,
      };

      if (!byDate[dateKey]) {
        byDate[dateKey] = { latest: reading, am: null, pm: null };
      }
      // Always update latest (data is ascending, so last = latest)
      byDate[dateKey].latest = reading;
      // Update AM or PM slot (latest per period)
      if (isAM) {
        byDate[dateKey].am = reading;
      } else {
        byDate[dateKey].pm = reading;
      }
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const entry = byDate[date];
      const sys = entry?.latest.systolic || null;
      const dia = entry?.latest.diastolic || null;
      const isHigh = sys !== null && dia !== null && (sys >= 140 || dia >= 90);

      return {
        day: labels[i],
        date,
        systolic: sys,
        diastolic: dia,
        pulse: entry?.latest.pulse || null,
        sys_am: entry?.am?.systolic || null,
        dia_am: entry?.am?.diastolic || null,
        pulse_am: entry?.am?.pulse || null,
        sys_pm: entry?.pm?.systolic || null,
        dia_pm: entry?.pm?.diastolic || null,
        pulse_pm: entry?.pm?.pulse || null,
        event: isHigh ? 'สูง' : undefined,
        note: isHigh ? 'ความดันสูงกว่าปกติ' : undefined,
      };
    });

    // Calculate summary
    const readings = data.filter((d) => d.systolic !== null);
    const avgSys = readings.length > 0
      ? Math.round(readings.reduce((sum, d) => sum + (d.systolic || 0), 0) / readings.length)
      : 0;
    const avgDia = readings.length > 0
      ? Math.round(readings.reduce((sum, d) => sum + (d.diastolic || 0), 0) / readings.length)
      : 0;

    const summary: TrendSummary = {
      avg: readings.length > 0 ? `${avgSys}/${avgDia}` : '-',
      label1: 'ค่าเฉลี่ย',
      count: `วัดแล้ว ${readings.length}/${days} วัน`,
      label2: 'วันที่มีการวัด',
    };

    // Generate insight
    const insight = getVitalsInsight(avgSys, avgDia, range);

    return res.json({ data, summary, insight });
  } catch (error: any) {
    console.error('Vitals trend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get vitals trend' });
  }
});

/**
 * GET /api/trends/meds/:patientId
 * Get medication adherence trends
 */
router.get('/meds/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const range = (req.query.range as string) || '7d';
  const customStartDate = req.query.startDate as string;
  const customEndDate = req.query.endDate as string;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    let dates: string[];
    let labels: string[];
    let days: number;

    if (range === 'custom' && customStartDate && customEndDate) {
      const customRange = getCustomDateRange(customStartDate, customEndDate);
      dates = customRange.dates;
      labels = customRange.labels;
      days = dates.length;
    } else {
      days = getRangeDays(range);
      const dateRange = getDateRange(days);
      dates = dateRange.dates;
      labels = dateRange.labels;
    }

    const startDate = dates[0];

    // Get patient's active medications count
    const { data: meds } = await supabase
      .from('medications')
      .select('id, times')
      .eq('patient_id', patientId)
      .eq('active', true);

    // Calculate total daily doses from all medications
    let dailyTarget = 0;
    (meds || []).forEach((med) => {
      const times = med.times || [];
      dailyTarget += times.length || 1; // Default 1 if no times specified
    });
    if (dailyTarget === 0) dailyTarget = 2; // Default if no medications

    // Get medication logs
    const { data: logs, error } = await supabase
      .from('medication_logs')
      .select('taken_at, status')
      .eq('patient_id', patientId)
      .gte('taken_at', `${startDate}T00:00:00`)
      .order('taken_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const byDate: Record<string, number> = {};
    (logs || []).forEach((log) => {
      const dateKey = formatISODate(parseISODate(log.taken_at));
      if (log.status === 'taken') {
        byDate[dateKey] = (byDate[dateKey] || 0) + 1;
      }
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const done = byDate[date] || 0;
      const percent = Math.min(100, Math.round((done / dailyTarget) * 100));
      const isMissed = done === 0;
      const isPartial = done > 0 && done < dailyTarget;

      return {
        day: labels[i],
        date,
        target: dailyTarget,
        done,
        percent,
        event: isMissed ? 'ลืม' : isPartial ? 'พลาด' : undefined,
        note: isMissed ? 'ลืมทั้งวัน' : isPartial ? 'พลาดบางมื้อ' : undefined,
      };
    });

    // Calculate summary
    const totalPercent = Math.round(data.reduce((sum, d) => sum + (d.percent || 0), 0) / data.length);
    const completeDays = data.filter((d) => d.percent === 100).length;

    const summary: TrendSummary = {
      avg: `${totalPercent}%`,
      label1: '% กินยาครบ',
      count: `กินครบ ${completeDays}/${days} วัน`,
      label2: 'วันกินครบ',
    };

    // Generate insight
    const insight = getMedsInsight(totalPercent, completeDays, days);

    return res.json({ data, summary, insight });
  } catch (error: any) {
    console.error('Meds trend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get meds trend' });
  }
});

/**
 * GET /api/trends/sleep/:patientId
 * Get sleep trends
 */
router.get('/sleep/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const range = (req.query.range as string) || '7d';
  const customStartDate = req.query.startDate as string;
  const customEndDate = req.query.endDate as string;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    let dates: string[];
    let labels: string[];
    let days: number;

    if (range === 'custom' && customStartDate && customEndDate) {
      const customRange = getCustomDateRange(customStartDate, customEndDate);
      dates = customRange.dates;
      labels = customRange.labels;
      days = dates.length;
    } else {
      days = getRangeDays(range);
      const dateRange = getDateRange(days);
      dates = dateRange.dates;
      labels = dateRange.labels;
    }

    const startDate = dates[0];

    // Query sleep logs
    const { data: sleepLogs, error } = await supabase
      .from('sleep_logs')
      .select('sleep_date, sleep_hours')
      .eq('patient_id', patientId)
      .gte('sleep_date', startDate)
      .order('sleep_date', { ascending: true });

    if (error) throw error;

    // Group by date
    const byDate: Record<string, number> = {};
    (sleepLogs || []).forEach((log) => {
      if (log.sleep_hours) {
        byDate[log.sleep_date] = log.sleep_hours;
      }
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const hours = byDate[date] || null;
      const isLow = hours !== null && hours < 6;

      return {
        day: labels[i],
        date,
        hours,
        event: isLow ? 'น้อย' : undefined,
        note: isLow ? 'นอนน้อยกว่าเกณฑ์' : undefined,
      };
    });

    // Calculate summary
    const recorded = data.filter((d) => d.hours !== null);
    const avgHours = recorded.length > 0
      ? (recorded.reduce((sum, d) => sum + (d.hours || 0), 0) / recorded.length).toFixed(1)
      : '0';

    const summary: TrendSummary = {
      avg: recorded.length > 0 ? `${avgHours} ชม.` : '-',
      label1: 'ชม.นอนเฉลี่ย',
      count: `บันทึก ${recorded.length}/${days} คืน`,
      label2: 'คืนที่บันทึก',
    };

    // Generate insight
    const insight = getSleepInsight(parseFloat(avgHours), days);

    return res.json({ data, summary, insight });
  } catch (error: any) {
    console.error('Sleep trend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get sleep trend' });
  }
});

// Insight generators
function getVitalsInsight(avgSys: number, avgDia: number, range: string): string {
  if (avgSys === 0 && avgDia === 0) {
    return 'ยังไม่มีข้อมูลความดันในช่วงนี้ ลองวัดความดันเพื่อติดตามสุขภาพนะครับ';
  }
  if (avgSys >= 140 || avgDia >= 90) {
    return 'ความดันโดยเฉลี่ยสูงกว่าปกติ ควรปรึกษาแพทย์เพื่อปรับยา';
  } else if (avgSys >= 130 || avgDia >= 80) {
    return 'ความดันอยู่ในระดับสูงกว่าปกติเล็กน้อย ควรระวังเรื่องอาหารเค็มและพักผ่อนให้เพียงพอ';
  }
  const daysText = range === '7d' ? 'สัปดาห์นี้' : range === '15d' ? '15 วันที่ผ่านมา' : 'เดือนนี้';
  return `ความดัน${daysText}อยู่ในเกณฑ์ดี ควบคุมได้ต่อเนื่อง`;
}

function getMedsInsight(percent: number, completeDays: number, totalDays: number): string {
  if (completeDays === 0 && totalDays > 0) {
    return 'ยังไม่มีการบันทึกการกินยาในช่วงนี้ ลองบันทึกทุกวันเพื่อติดตามนะครับ';
  }
  if (percent >= 95) {
    return 'กินยาครบถ้วนมาก สุดยอดครับ!';
  } else if (percent >= 80) {
    return 'กินยาได้ดี แต่ยังพลาดบ้าง ลองตั้งเตือนเพิ่มไหมครับ';
  } else if (percent >= 60) {
    return 'ช่วงนี้พลาดกินยาบ่อย ลองหาวิธีจดจำที่เหมาะกับคุณนะครับ';
  }
  return 'ต้องปรับปรุงการกินยา ลองตั้งนาฬิกาเตือนหรือบอกคนใกล้ชิดให้ช่วยเตือน';
}

function getSleepInsight(avgHours: number, totalDays: number): string {
  if (avgHours === 0 && totalDays > 0) {
    return 'ยังไม่มีการบันทึกการนอนในช่วงนี้ ลองบันทึกทุกคืนเพื่อติดตามนะครับ';
  }
  if (avgHours >= 7) {
    return 'พักผ่อนเพียงพอ สุขภาพโดยรวมจะดีครับ';
  } else if (avgHours >= 6) {
    return 'นอนได้พอประมาณ ลองเข้านอนเร็วขึ้นอีกสัก 30 นาทีจะดีมากครับ';
  }
  return 'นอนน้อยกว่าเกณฑ์ ลองพักงีบช่วงบ่าย และเข้านอนเร็วขึ้นนะครับ';
}

function getExerciseInsight(exerciseDays: number, totalDays: number, avgDuration: number): string {
  if (exerciseDays === 0) {
    return 'ยังไม่มีการบันทึกการออกกำลังกาย ลองเริ่มจากเดินวันละ 15-20 นาทีนะครับ';
  }
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

function getMoodInsight(avgMood: number, recordedDays: number): string {
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

function getWaterInsight(avgGlasses: number): string {
  if (avgGlasses === 0) {
    return 'ยังไม่มีการบันทึกการดื่มน้ำ ลองบันทึกทุกวันเพื่อติดตามนะครับ';
  }
  if (avgGlasses >= 8) {
    return 'ดื่มน้ำได้ตามเป้าหมาย สุขภาพดีแน่นอนครับ!';
  } else if (avgGlasses >= 6) {
    return 'ดื่มน้ำได้ดี ลองเพิ่มอีก 2-3 แก้วต่อวันจะยิ่งดีครับ';
  } else if (avgGlasses >= 4) {
    return 'ดื่มน้ำน้อยไป ลองพกขวดน้ำติดตัวเพื่อเตือนให้ดื่มบ่อยขึ้นนะครับ';
  }
  return 'ดื่มน้ำน้อยมาก ร่างกายต้องการน้ำอย่างน้อย 8 แก้ว/วันนะครับ';
}

/**
 * GET /api/trends/exercise/:patientId
 * Get exercise trends
 */
router.get('/exercise/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const range = (req.query.range as string) || '7d';
  const customStartDate = req.query.startDate as string;
  const customEndDate = req.query.endDate as string;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    let dates: string[];
    let labels: string[];
    let days: number;

    if (range === 'custom' && customStartDate && customEndDate) {
      const customRange = getCustomDateRange(customStartDate, customEndDate);
      dates = customRange.dates;
      labels = customRange.labels;
      days = dates.length;
    } else {
      days = getRangeDays(range);
      const dateRange = getDateRange(days);
      dates = dateRange.dates;
      labels = dateRange.labels;
    }

    const startDate = dates[0];

    // Query exercise logs
    const { data: exerciseLogs, error } = await supabase
      .from('exercise_logs')
      .select('created_at, exercise_type, duration_minutes')
      .eq('patient_id', patientId)
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date (sum duration per day)
    const byDate: Record<string, { duration: number; type: string }> = {};
    (exerciseLogs || []).forEach((log) => {
      const dateKey = formatISODate(parseISODate(log.created_at));
      if (!byDate[dateKey]) {
        byDate[dateKey] = { duration: 0, type: log.exercise_type || '' };
      }
      byDate[dateKey].duration += log.duration_minutes || 0;
      if (log.exercise_type) byDate[dateKey].type = log.exercise_type;
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const entry = byDate[date];
      const duration = entry?.duration || null;
      const isGood = duration !== null && duration >= 30;

      return {
        day: labels[i],
        date,
        duration,
        exerciseType: entry?.type,
        event: isGood ? 'ดี' : undefined,
        note: entry?.type,
      };
    });

    // Calculate summary
    const exerciseDays = data.filter((d) => d.duration !== null && (d.duration as number) > 0).length;
    const totalDuration = data.reduce((sum, d) => sum + ((d.duration as number) || 0), 0);
    const avgDuration = exerciseDays > 0 ? Math.round(totalDuration / exerciseDays) : 0;

    const summary: TrendSummary = {
      avg: exerciseDays > 0 ? `${avgDuration} นาที` : '-',
      label1: 'เวลาเฉลี่ย',
      count: `ออกกำลังกาย ${exerciseDays}/${days} วัน`,
      label2: 'วันที่ออกกำลังกาย',
    };

    // Generate insight
    const insight = getExerciseInsight(exerciseDays, days, avgDuration);

    return res.json({ data, summary, insight });
  } catch (error: any) {
    console.error('Exercise trend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get exercise trend' });
  }
});

/**
 * GET /api/trends/mood/:patientId
 * Get mood trends
 */
router.get('/mood/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const range = (req.query.range as string) || '7d';
  const customStartDate = req.query.startDate as string;
  const customEndDate = req.query.endDate as string;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    let dates: string[];
    let labels: string[];
    let days: number;

    if (range === 'custom' && customStartDate && customEndDate) {
      const customRange = getCustomDateRange(customStartDate, customEndDate);
      dates = customRange.dates;
      labels = customRange.labels;
      days = dates.length;
    } else {
      days = getRangeDays(range);
      const dateRange = getDateRange(days);
      dates = dateRange.dates;
      labels = dateRange.labels;
    }

    const startDate = dates[0];

    // Query mood logs
    const { data: moodLogs, error } = await supabase
      .from('mood_logs')
      .select('timestamp, mood, mood_score, stress_level')
      .eq('patient_id', patientId)
      .gte('timestamp', `${startDate}T00:00:00`)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Mood labels
    const moodLabels: Record<string, string> = {
      happy: 'มีความสุข',
      calm: 'สงบ',
      neutral: 'เฉยๆ',
      sad: 'เศร้า',
      anxious: 'กังวล',
    };

    // Group by date (take latest reading per day)
    const byDate: Record<string, { mood: string; moodScore: number; stressLevel: number }> = {};
    (moodLogs || []).forEach((log) => {
      const dateKey = formatISODate(parseISODate(log.timestamp));
      byDate[dateKey] = {
        mood: log.mood,
        moodScore: log.mood_score || 3,
        stressLevel: log.stress_level || 0,
      };
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const entry = byDate[date];
      const isLow = entry && entry.moodScore <= 2;

      return {
        day: labels[i],
        date,
        mood: entry?.mood || null,
        moodScore: entry?.moodScore || null,
        stressLevel: entry?.stressLevel || null,
        event: isLow ? 'ต่ำ' : undefined,
        note: entry?.mood ? moodLabels[entry.mood] || entry.mood : undefined,
      };
    });

    // Calculate summary
    const recorded = data.filter((d) => d.moodScore !== null);
    const avgMood = recorded.length > 0
      ? (recorded.reduce((sum, d) => sum + (d.moodScore || 0), 0) / recorded.length).toFixed(1)
      : '0';

    const summary: TrendSummary = {
      avg: recorded.length > 0 ? `${avgMood}/5` : '-',
      label1: 'คะแนนอารมณ์เฉลี่ย',
      count: `บันทึก ${recorded.length}/${days} วัน`,
      label2: 'วันที่บันทึก',
    };

    // Generate insight
    const insight = getMoodInsight(parseFloat(avgMood), recorded.length);

    return res.json({ data, summary, insight });
  } catch (error: any) {
    console.error('Mood trend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get mood trend' });
  }
});

/**
 * GET /api/trends/water/:patientId
 * Get water intake trends
 */
router.get('/water/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const range = (req.query.range as string) || '7d';
  const customStartDate = req.query.startDate as string;
  const customEndDate = req.query.endDate as string;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    let dates: string[];
    let labels: string[];
    let days: number;

    if (range === 'custom' && customStartDate && customEndDate) {
      const customRange = getCustomDateRange(customStartDate, customEndDate);
      dates = customRange.dates;
      labels = customRange.labels;
      days = dates.length;
    } else {
      days = getRangeDays(range);
      const dateRange = getDateRange(days);
      dates = dateRange.dates;
      labels = dateRange.labels;
    }

    const startDate = dates[0];

    // Query water logs
    const { data: waterLogs, error } = await supabase
      .from('water_logs')
      .select('created_at, glasses, amount_ml')
      .eq('patient_id', patientId)
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date (sum glasses per day)
    const byDate: Record<string, { glasses: number; ml: number }> = {};
    (waterLogs || []).forEach((log) => {
      const dateKey = formatISODate(parseISODate(log.created_at));
      if (!byDate[dateKey]) {
        byDate[dateKey] = { glasses: 0, ml: 0 };
      }
      byDate[dateKey].glasses += log.glasses || 0;
      byDate[dateKey].ml += log.amount_ml || (log.glasses || 0) * 250;
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const entry = byDate[date];
      const glasses = entry?.glasses || 0;
      const ml = entry?.ml || 0;
      const isLow = glasses < 6;
      const isGood = glasses >= 8;

      return {
        day: labels[i],
        date,
        glasses,
        ml,
        event: isLow ? 'น้อย' : isGood ? 'ดี' : undefined,
        note: isLow ? 'ดื่มน้ำน้อย' : isGood ? 'ดื่มน้ำได้ดี' : undefined,
      };
    });

    // Calculate summary
    const avgGlasses = Math.round(data.reduce((sum, d) => sum + (d.glasses || 0), 0) / data.length);
    const goodDays = data.filter((d) => (d.glasses || 0) >= 8).length;

    const summary: TrendSummary = {
      avg: `${avgGlasses} แก้ว`,
      label1: 'เฉลี่ย/วัน',
      count: `ดื่มครบ ${goodDays}/${days} วัน`,
      label2: 'วันดื่มครบ 8 แก้ว',
    };

    // Generate insight
    const insight = getWaterInsight(avgGlasses);

    return res.json({ data, summary, insight });
  } catch (error: any) {
    console.error('Water trend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get water trend' });
  }
});

/**
 * GET /api/trends/glucose/:patientId
 * Get blood sugar (glucose) trends
 */
router.get('/glucose/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const range = (req.query.range as string) || '7d';
  const customStartDate = req.query.startDate as string;
  const customEndDate = req.query.endDate as string;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    let dates: string[];
    let labels: string[];
    let days: number;

    if (range === 'custom' && customStartDate && customEndDate) {
      const customRange = getCustomDateRange(customStartDate, customEndDate);
      dates = customRange.dates;
      labels = customRange.labels;
      days = dates.length;
    } else {
      days = getRangeDays(range);
      const dateRange = getDateRange(days);
      dates = dateRange.dates;
      labels = dateRange.labels;
    }

    const startDate = dates[0];

    // Query vitals logs with glucose data
    const { data: glucoseLogs, error } = await supabase
      .from('vitals_logs')
      .select('glucose, meal_context, measured_at')
      .eq('patient_id', patientId)
      .not('glucose', 'is', null)
      .gte('measured_at', `${startDate}T00:00:00`)
      .order('measured_at', { ascending: true });

    if (error) throw error;

    // Group by date (take latest reading per day)
    const byDate: Record<string, { glucose: number; mealContext: string | null }> = {};
    (glucoseLogs || []).forEach((log) => {
      if (!log.glucose) return;
      const dateKey = formatISODate(parseISODate(log.measured_at));
      byDate[dateKey] = {
        glucose: log.glucose,
        mealContext: log.meal_context || null,
      };
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const entry = byDate[date];
      const glucose = entry?.glucose || null;
      const isFasting = entry?.mealContext === 'fasting' || entry?.mealContext === 'before_bed';
      const isHigh = glucose !== null && (isFasting ? glucose >= 126 : glucose >= 200);
      const isPreDiabetic = glucose !== null && !isHigh && (isFasting ? glucose >= 100 : glucose >= 140);

      return {
        day: labels[i],
        date,
        glucose,
        mealContext: entry?.mealContext || null,
        event: isHigh ? 'สูง' : isPreDiabetic ? 'เสี่ยง' : undefined,
        note: isHigh ? 'น้ำตาลสูงกว่าปกติ' : isPreDiabetic ? 'น้ำตาลสูงกว่าเกณฑ์เล็กน้อย' : undefined,
      };
    });

    // Calculate summary
    const recorded = data.filter((d) => d.glucose !== null);
    const avgGlucose = recorded.length > 0
      ? Math.round(recorded.reduce((sum, d) => sum + (d.glucose || 0), 0) / recorded.length)
      : 0;

    const summary: TrendSummary = {
      avg: recorded.length > 0 ? `${avgGlucose} mg/dL` : '-',
      label1: 'ค่าเฉลี่ย',
      count: `วัดแล้ว ${recorded.length}/${days} วัน`,
      label2: 'วันที่มีการวัด',
    };

    // Generate insight
    const insight = getGlucoseInsight(avgGlucose, recorded.length);

    return res.json({ data, summary, insight });
  } catch (error: any) {
    console.error('Glucose trend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get glucose trend' });
  }
});

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

export default router;
