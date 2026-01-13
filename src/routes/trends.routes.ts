import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

const router = Router();

// Types
interface TrendDataPoint {
  day: string;
  date: string;
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  hours?: number | null;
  target?: number;
  done?: number;
  percent?: number;
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
  const map: Record<string, number> = { '7d': 7, '15d': 15, '30d': 30 };
  return map[range] || 7;
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
  const days = getRangeDays(range);

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const { dates, labels } = getDateRange(days);
    const startDate = dates[0];

    // Query vitals logs
    const { data: vitals, error } = await supabase
      .from('vitals_logs')
      .select('bp_systolic, bp_diastolic, heart_rate, measured_at')
      .eq('patient_id', patientId)
      .gte('measured_at', `${startDate}T00:00:00`)
      .order('measured_at', { ascending: true });

    if (error) throw error;

    // Group by date (take latest reading per day)
    const byDate: Record<string, { systolic: number; diastolic: number; pulse: number }> = {};
    (vitals || []).forEach((v) => {
      const dateKey = formatISODate(parseISODate(v.measured_at));
      if (v.bp_systolic && v.bp_diastolic) {
        byDate[dateKey] = {
          systolic: v.bp_systolic,
          diastolic: v.bp_diastolic,
          pulse: v.heart_rate || 0,
        };
      }
    });

    // Build data array
    const data: TrendDataPoint[] = dates.map((date, i) => {
      const reading = byDate[date];
      const sys = reading?.systolic || null;
      const dia = reading?.diastolic || null;
      const isHigh = sys !== null && dia !== null && (sys >= 140 || dia >= 90);

      return {
        day: labels[i],
        date,
        systolic: sys,
        diastolic: dia,
        pulse: reading?.pulse || null,
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
  const days = getRangeDays(range);

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const { dates, labels } = getDateRange(days);
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
  const days = getRangeDays(range);

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const { dates, labels } = getDateRange(days);
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

export default router;
