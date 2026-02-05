/**
 * Report Generation Service (Enhanced)
 * Generates comprehensive health reports for patients and groups
 *
 * Features:
 * - Daily/Weekly/Monthly reports
 * - Blood pressure tracking with trends
 * - Medication compliance tracking
 * - Activity timestamps and actor info
 * - Period-over-period comparison
 */

import { supabase } from './supabase.service';

// ============================================
// INTERFACES
// ============================================

interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  pulse?: number;
  timestamp: Date;
  recordedBy?: string;
}

interface BloodPressureSummary {
  readings: BloodPressureReading[];
  latest?: BloodPressureReading;
  average?: { systolic: number; diastolic: number };
  highest?: BloodPressureReading;
  lowest?: BloodPressureReading;
  status: 'normal' | 'high' | 'low' | 'no_data';
}

interface MedicationStatus {
  id: string;
  name: string;
  expectedTimes: string[]; // ['morning', 'evening']
  takenTimes: { time: string; timestamp: Date; recordedBy?: string }[];
  compliance: number; // 0-100%
}

interface ActivityDetail {
  id: string;
  type: string;
  value: any;
  timestamp: Date;
  recordedBy?: string;
  note?: string;
}

interface ActivitySummary {
  medication: {
    count: number;
    lastTaken?: Date;
    medications?: MedicationStatus[];
  };
  vitals: {
    count: number;
    lastReading?: any;
    bloodPressure?: BloodPressureSummary;
  };
  water: { totalMl: number; count: number };
  food: { count: number; meals?: string[] };
  exercise: { totalMinutes: number; count: number };
}

interface DailyReport {
  date: Date;
  patientId: string;
  patientName: string;
  summary: ActivitySummary;
  activities: ActivityDetail[];
  completionRate: number;
  insights: string[];
  alerts: string[];
}

interface WeeklyReport {
  startDate: Date;
  endDate: Date;
  patientId: string;
  patientName: string;
  dailySummaries: { [date: string]: ActivitySummary };
  weekTotal: ActivitySummary;
  bloodPressureTrend: BloodPressureSummary;
  trends: string[];
  insights: string[];
  comparison?: {
    previousWeek: ActivitySummary;
    change: {
      medication: number; // +/- percentage
      water: number;
      exercise: number;
    };
  };
  missingDays: string[]; // Days with no activity
}

interface MonthlyReport {
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
  patientId: string;
  patientName: string;
  monthTotal: ActivitySummary;
  bloodPressureTrend: BloodPressureSummary;
  weeklySummaries: { [weekNumber: string]: ActivitySummary };
  averageCompletionRate: number;
  activeDays: number;
  totalDays: number;
  trends: string[];
  insights: string[];
  comparison?: {
    previousMonth: ActivitySummary;
    change: {
      medication: number;
      water: number;
      exercise: number;
      completionRate: number;
    };
  };
}

// ============================================
// REPORT SERVICE
// ============================================

export class ReportService {

  // ============================================
  // DAILY REPORT
  // ============================================

  async generateDailyReport(patientId: string, date?: Date): Promise<DailyReport> {
    const reportDate = date || new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get patient info
    const { data: patient } = await supabase
      .from('patient_profiles')
      .select('first_name, last_name')
      .eq('id', patientId)
      .single();

    const patientName = patient ? `คุณ${patient.first_name} ${patient.last_name}` : 'สมาชิก';

    // Get activities for the day
    const { data: activities, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', startOfDay.toISOString())
      .lte('timestamp', endOfDay.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }

    // Get patient's medications
    const { data: medications } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .eq('active', true);

    // Calculate summary with enhanced data
    const summary = this.calculateActivitySummary(activities || [], medications || []);

    // Process blood pressure readings
    summary.vitals.bloodPressure = this.processBloodPressureReadings(activities || []);

    // Process medication compliance
    summary.medication.medications = this.processMedicationCompliance(
      medications || [],
      activities || []
    );

    // Format activities with details
    const activityDetails = this.formatActivityDetails(activities || []);

    // Calculate completion rate
    const completionRate = this.calculateCompletionRate(summary);

    // Generate insights
    const insights = this.generateDailyInsights(summary, activities || []);

    // Generate alerts
    const alerts = this.generateAlerts(summary);

    return {
      date: reportDate,
      patientId,
      patientName,
      summary,
      activities: activityDetails,
      completionRate,
      insights,
      alerts
    };
  }

  // ============================================
  // WEEKLY REPORT
  // ============================================

  async generateWeeklyReport(patientId: string, endDate?: Date): Promise<WeeklyReport> {
    const end = endDate || new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6); // Last 7 days
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Previous week for comparison
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
    prevStart.setHours(0, 0, 0, 0);

    // Get patient info
    const { data: patient } = await supabase
      .from('patient_profiles')
      .select('first_name, last_name')
      .eq('id', patientId)
      .single();

    const patientName = patient ? `คุณ${patient.first_name} ${patient.last_name}` : 'สมาชิก';

    // Get activities for this week
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString())
      .order('timestamp', { ascending: true });

    // Get activities for previous week (for comparison)
    const { data: prevActivities } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', prevStart.toISOString())
      .lte('timestamp', prevEnd.toISOString());

    // Group by day
    const dailySummaries: { [date: string]: ActivitySummary } = {};
    const activityGroups: { [date: string]: any[] } = {};

    // Initialize all 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      activityGroups[dateKey] = [];
    }

    (activities || []).forEach(activity => {
      const activityDate = new Date(activity.timestamp);
      const dateKey = activityDate.toISOString().split('T')[0];
      if (activityGroups[dateKey]) {
        activityGroups[dateKey].push(activity);
      }
    });

    // Calculate summary for each day
    Object.keys(activityGroups).forEach(dateKey => {
      dailySummaries[dateKey] = this.calculateActivitySummary(activityGroups[dateKey], []);
    });

    // Find days with no activity
    const missingDays = Object.entries(activityGroups)
      .filter(([_, acts]) => acts.length === 0)
      .map(([date, _]) => date);

    // Calculate week total
    const weekTotal = this.calculateActivitySummary(activities || [], []);

    // Process blood pressure for the week
    const bloodPressureTrend = this.processBloodPressureReadings(activities || []);

    // Calculate previous week total for comparison
    const previousWeekTotal = this.calculateActivitySummary(prevActivities || [], []);

    // Calculate change percentages
    const comparison = {
      previousWeek: previousWeekTotal,
      change: {
        medication: this.calculateChange(weekTotal.medication.count, previousWeekTotal.medication.count),
        water: this.calculateChange(weekTotal.water.totalMl, previousWeekTotal.water.totalMl),
        exercise: this.calculateChange(weekTotal.exercise.totalMinutes, previousWeekTotal.exercise.totalMinutes)
      }
    };

    // Generate trends and insights
    const trends = this.generateWeeklyTrends(dailySummaries, bloodPressureTrend);
    const insights = this.generateWeeklyInsights(weekTotal, dailySummaries, comparison);

    return {
      startDate: start,
      endDate: end,
      patientId,
      patientName,
      dailySummaries,
      weekTotal,
      bloodPressureTrend,
      trends,
      insights,
      comparison,
      missingDays
    };
  }

  // ============================================
  // MONTHLY REPORT
  // ============================================

  async generateMonthlyReport(patientId: string, month?: number, year?: number): Promise<MonthlyReport> {
    const now = new Date();
    const targetMonth = month !== undefined ? month : now.getMonth();
    const targetYear = year !== undefined ? year : now.getFullYear();

    // Start and end of month
    const startOfMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    const totalDays = endOfMonth.getDate();

    // Previous month for comparison
    const prevStartOfMonth = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const prevEndOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Get patient info
    const { data: patient } = await supabase
      .from('patient_profiles')
      .select('first_name, last_name')
      .eq('id', patientId)
      .single();

    const patientName = patient ? `คุณ${patient.first_name} ${patient.last_name}` : 'สมาชิก';

    // Get activities for this month
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', startOfMonth.toISOString())
      .lte('timestamp', endOfMonth.toISOString())
      .order('timestamp', { ascending: true });

    // Get activities for previous month
    const { data: prevActivities } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', prevStartOfMonth.toISOString())
      .lte('timestamp', prevEndOfMonth.toISOString());

    // Group by week
    const weeklySummaries: { [weekNumber: string]: ActivitySummary } = {};
    const weekGroups: { [weekNumber: string]: any[] } = {};

    (activities || []).forEach(activity => {
      const activityDate = new Date(activity.timestamp);
      const weekNum = this.getWeekOfMonth(activityDate);
      const weekKey = `week${weekNum}`;

      if (!weekGroups[weekKey]) {
        weekGroups[weekKey] = [];
      }
      weekGroups[weekKey].push(activity);
    });

    Object.keys(weekGroups).forEach(weekKey => {
      weeklySummaries[weekKey] = this.calculateActivitySummary(weekGroups[weekKey], []);
    });

    // Calculate month total
    const monthTotal = this.calculateActivitySummary(activities || [], []);

    // Process blood pressure for the month
    const bloodPressureTrend = this.processBloodPressureReadings(activities || []);

    // Count active days (days with at least one activity)
    const activeDaysSet = new Set<string>();
    (activities || []).forEach(activity => {
      const dateKey = new Date(activity.timestamp).toISOString().split('T')[0];
      activeDaysSet.add(dateKey);
    });
    const activeDays = activeDaysSet.size;

    // Calculate average completion rate
    const dailyRates: number[] = [];
    activeDaysSet.forEach(dateKey => {
      const dayActivities = (activities || []).filter(a =>
        new Date(a.timestamp).toISOString().split('T')[0] === dateKey
      );
      const daySummary = this.calculateActivitySummary(dayActivities, []);
      dailyRates.push(this.calculateCompletionRate(daySummary));
    });
    const averageCompletionRate = dailyRates.length > 0
      ? Math.round(dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length)
      : 0;

    // Previous month comparison
    const previousMonth = this.calculateActivitySummary(prevActivities || [], []);
    const prevDailyRates: number[] = [];
    const prevActiveDaysSet = new Set<string>();
    (prevActivities || []).forEach(activity => {
      const dateKey = new Date(activity.timestamp).toISOString().split('T')[0];
      prevActiveDaysSet.add(dateKey);
    });
    prevActiveDaysSet.forEach(dateKey => {
      const dayActivities = (prevActivities || []).filter(a =>
        new Date(a.timestamp).toISOString().split('T')[0] === dateKey
      );
      const daySummary = this.calculateActivitySummary(dayActivities, []);
      prevDailyRates.push(this.calculateCompletionRate(daySummary));
    });
    const prevAvgCompletionRate = prevDailyRates.length > 0
      ? Math.round(prevDailyRates.reduce((a, b) => a + b, 0) / prevDailyRates.length)
      : 0;

    const comparison = {
      previousMonth,
      change: {
        medication: this.calculateChange(monthTotal.medication.count, previousMonth.medication.count),
        water: this.calculateChange(monthTotal.water.totalMl, previousMonth.water.totalMl),
        exercise: this.calculateChange(monthTotal.exercise.totalMinutes, previousMonth.exercise.totalMinutes),
        completionRate: averageCompletionRate - prevAvgCompletionRate
      }
    };

    // Generate trends and insights
    const trends = this.generateMonthlyTrends(weeklySummaries, bloodPressureTrend);
    const insights = this.generateMonthlyInsights(monthTotal, activeDays, totalDays, comparison);

    return {
      month: targetMonth,
      year: targetYear,
      startDate: startOfMonth,
      endDate: endOfMonth,
      patientId,
      patientName,
      monthTotal,
      bloodPressureTrend,
      weeklySummaries,
      averageCompletionRate,
      activeDays,
      totalDays,
      trends,
      insights,
      comparison
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private calculateActivitySummary(activities: any[], medications: any[]): ActivitySummary {
    const summary: ActivitySummary = {
      medication: { count: 0 },
      vitals: { count: 0 },
      water: { totalMl: 0, count: 0 },
      food: { count: 0, meals: [] },
      exercise: { totalMinutes: 0, count: 0 }
    };

    activities.forEach(activity => {
      const taskType = activity.task_type;
      const metadata = activity.metadata || {};

      switch (taskType) {
        case 'medication':
          summary.medication.count++;
          if (!summary.medication.lastTaken || new Date(activity.timestamp) > new Date(summary.medication.lastTaken)) {
            summary.medication.lastTaken = new Date(activity.timestamp);
          }
          break;

        case 'vitals':
          summary.vitals.count++;
          if (activity.value) {
            summary.vitals.lastReading = activity.value;
          }
          break;

        case 'water':
          summary.water.count++;
          const amount = metadata.amount || 250; // default 250ml
          summary.water.totalMl += amount;
          break;

        case 'food':
          summary.food.count++;
          if (metadata.meal) {
            summary.food.meals?.push(metadata.meal);
          }
          break;

        case 'walk':
        case 'exercise':
          summary.exercise.count++;
          if (metadata.duration) {
            summary.exercise.totalMinutes += metadata.duration;
          } else {
            summary.exercise.totalMinutes += 30; // default 30 min
          }
          break;
      }
    });

    return summary;
  }

  private processBloodPressureReadings(activities: any[]): BloodPressureSummary {
    const readings: BloodPressureReading[] = [];

    activities.forEach(activity => {
      if (activity.task_type === 'vitals') {
        const value = activity.value || '';
        const metadata = activity.metadata || {};

        // Parse blood pressure from value string like "120/80"
        let systolic: number | undefined;
        let diastolic: number | undefined;

        if (typeof value === 'string' && value.includes('/')) {
          const parts = value.split('/');
          systolic = parseInt(parts[0]);
          diastolic = parseInt(parts[1]);
        } else if (metadata.systolic && metadata.diastolic) {
          systolic = metadata.systolic;
          diastolic = metadata.diastolic;
        }

        if (systolic && diastolic && !isNaN(systolic) && !isNaN(diastolic)) {
          readings.push({
            systolic,
            diastolic,
            pulse: metadata.pulse,
            timestamp: new Date(activity.timestamp),
            recordedBy: activity.actor_display_name
          });
        }
      }
    });

    if (readings.length === 0) {
      return { readings: [], status: 'no_data' };
    }

    // Sort by timestamp
    readings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const latest = readings[0];

    // Calculate average
    const avgSystolic = Math.round(readings.reduce((sum, r) => sum + r.systolic, 0) / readings.length);
    const avgDiastolic = Math.round(readings.reduce((sum, r) => sum + r.diastolic, 0) / readings.length);

    // Find highest and lowest
    const highest = readings.reduce((max, r) => r.systolic > max.systolic ? r : max, readings[0]);
    const lowest = readings.reduce((min, r) => r.systolic < min.systolic ? r : min, readings[0]);

    // Determine status based on latest reading
    let status: 'normal' | 'high' | 'low' = 'normal';
    if (latest.systolic >= 140 || latest.diastolic >= 90) {
      status = 'high';
    } else if (latest.systolic < 90 || latest.diastolic < 60) {
      status = 'low';
    }

    return {
      readings,
      latest,
      average: { systolic: avgSystolic, diastolic: avgDiastolic },
      highest,
      lowest,
      status
    };
  }

  private processMedicationCompliance(medications: any[], activities: any[]): MedicationStatus[] {
    const medicationActivities = activities.filter(a => a.task_type === 'medication');

    return medications.map(med => {
      const expectedTimes = med.times || ['morning', 'evening'];
      const takenTimes: { time: string; timestamp: Date; recordedBy?: string }[] = [];

      // Match activities to this medication
      medicationActivities.forEach(activity => {
        const activityTime = new Date(activity.timestamp);
        const hour = activityTime.getHours();

        let timePeriod = 'other';
        if (hour >= 5 && hour < 12) timePeriod = 'morning';
        else if (hour >= 12 && hour < 17) timePeriod = 'afternoon';
        else if (hour >= 17 && hour < 21) timePeriod = 'evening';
        else timePeriod = 'night';

        takenTimes.push({
          time: timePeriod,
          timestamp: activityTime,
          recordedBy: activity.actor_display_name
        });
      });

      const compliance = expectedTimes.length > 0
        ? Math.min(100, Math.round((takenTimes.length / expectedTimes.length) * 100))
        : 0;

      return {
        id: med.id,
        name: med.name,
        expectedTimes,
        takenTimes,
        compliance
      };
    });
  }

  private formatActivityDetails(activities: any[]): ActivityDetail[] {
    return activities.map(activity => ({
      id: activity.id,
      type: activity.task_type,
      value: activity.value,
      timestamp: new Date(activity.timestamp),
      recordedBy: activity.actor_display_name,
      note: activity.metadata?.note
    }));
  }

  private calculateCompletionRate(summary: ActivitySummary): number {
    let completed = 0;
    let total = 5;

    // Medication (expected 2)
    if (summary.medication.count >= 2) completed++;
    else if (summary.medication.count >= 1) completed += 0.5;

    // Water (expected 2000ml)
    if (summary.water.totalMl >= 2000) completed++;
    else if (summary.water.totalMl >= 1000) completed += 0.5;

    // Food (expected 3)
    if (summary.food.count >= 3) completed++;
    else if (summary.food.count >= 2) completed += 0.5;

    // Vitals (expected 1)
    if (summary.vitals.count >= 1) completed++;

    // Exercise (expected 1)
    if (summary.exercise.count >= 1) completed++;

    return Math.round((completed / total) * 100);
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private getWeekOfMonth(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
  }

  // ============================================
  // INSIGHTS GENERATION
  // ============================================

  private generateAlerts(summary: ActivitySummary): string[] {
    const alerts: string[] = [];

    // Blood pressure alerts
    if (summary.vitals.bloodPressure) {
      const bp = summary.vitals.bloodPressure;
      if (bp.status === 'high') {
        alerts.push(`🚨 ความดันโลหิตสูง: ${bp.latest?.systolic}/${bp.latest?.diastolic} mmHg - ควรปรึกษาแพทย์`);
      } else if (bp.status === 'low') {
        alerts.push(`⚠️ ความดันโลหิตต่ำ: ${bp.latest?.systolic}/${bp.latest?.diastolic} mmHg - ควรติดตามอาการ`);
      }
    }

    // Medication alerts
    if (summary.medication.count === 0) {
      alerts.push('⚠️ ยังไม่ได้บันทึกการกินยาวันนี้');
    }

    return alerts;
  }

  private generateDailyInsights(summary: ActivitySummary, activities: any[]): string[] {
    const insights: string[] = [];

    // Blood pressure insights
    if (summary.vitals.bloodPressure && summary.vitals.bloodPressure.latest) {
      const bp = summary.vitals.bloodPressure.latest;
      const time = bp.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      insights.push(`🩺 ความดันล่าสุด: ${bp.systolic}/${bp.diastolic} mmHg (${time} น.)`);
    }

    // Medication insights
    if (summary.medication.medications && summary.medication.medications.length > 0) {
      const totalMeds = summary.medication.medications.length;
      const takenMeds = summary.medication.medications.filter(m => m.takenTimes.length > 0).length;
      insights.push(`💊 กินยา: ${takenMeds}/${totalMeds} รายการ`);
    } else if (summary.medication.count === 0) {
      insights.push('⚠️ ยังไม่ได้บันทึกการกินยาวันนี้');
    } else {
      insights.push(`💊 กินยาแล้ว ${summary.medication.count} ครั้ง`);
    }

    // Water insights
    if (summary.water.totalMl >= 2000) {
      insights.push('💧 ดื่มน้ำครบตามเป้าหมายแล้ว เยี่ยมมาก!');
    } else if (summary.water.totalMl > 0) {
      insights.push(`💧 ดื่มน้ำไปแล้ว ${summary.water.totalMl} มล. (เป้าหมาย 2,000 มล.)`);
    } else {
      insights.push('💧 อย่าลืมดื่มน้ำให้เพียงพอนะคะ');
    }

    // Exercise insights
    if (summary.exercise.count > 0) {
      insights.push(`🚶 ออกกำลังกายแล้ว ${summary.exercise.totalMinutes} นาที`);
    } else {
      insights.push('🚶 อย่าลืมออกกำลังกายนะคะ');
    }

    return insights;
  }

  private generateWeeklyTrends(
    dailySummaries: { [date: string]: ActivitySummary },
    bloodPressure: BloodPressureSummary
  ): string[] {
    const trends: string[] = [];
    const dates = Object.keys(dailySummaries).sort();

    if (dates.length < 2) {
      return ['ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์แนวโน้ม'];
    }

    // Blood pressure trend
    if (bloodPressure.readings.length >= 2) {
      const first = bloodPressure.readings[bloodPressure.readings.length - 1];
      const last = bloodPressure.readings[0];
      const diff = last.systolic - first.systolic;

      if (Math.abs(diff) < 5) {
        trends.push('🩺 ความดันโลหิตคงที่ตลอดสัปดาห์');
      } else if (diff > 0) {
        trends.push(`🩺 ความดันโลหิตมีแนวโน้มเพิ่มขึ้น (+${diff} mmHg)`);
      } else {
        trends.push(`🩺 ความดันโลหิตมีแนวโน้มลดลง (${diff} mmHg)`);
      }

      if (bloodPressure.average) {
        trends.push(`📊 ความดันเฉลี่ย: ${bloodPressure.average.systolic}/${bloodPressure.average.diastolic} mmHg`);
      }
    }

    // Medication trend
    const medCounts = dates.map(d => dailySummaries[d].medication.count);
    const avgMed = medCounts.reduce((a, b) => a + b, 0) / medCounts.length;
    if (avgMed >= 2) {
      trends.push('✅ กินยาสม่ำเสมอทุกวัน');
    } else if (avgMed >= 1) {
      trends.push('⚠️ กินยาไม่ครบบางวัน ควรปรับปรุง');
    } else {
      trends.push('❌ ขาดการบันทึกกินยาหลายวัน');
    }

    // Exercise trend
    const exerciseDays = dates.filter(d => dailySummaries[d].exercise.count > 0).length;
    if (exerciseDays >= 5) {
      trends.push('🚶 ออกกำลังกายสม่ำเสมอ เยี่ยมมาก!');
    } else if (exerciseDays >= 3) {
      trends.push(`🚶 ออกกำลังกาย ${exerciseDays}/7 วัน`);
    } else {
      trends.push('🚶 ควรออกกำลังกายให้มากขึ้น');
    }

    return trends;
  }

  private generateWeeklyInsights(
    weekTotal: ActivitySummary,
    dailySummaries: { [date: string]: ActivitySummary },
    comparison: any
  ): string[] {
    const insights: string[] = [];

    // Summary
    insights.push(`📊 สรุปกิจกรรมสัปดาห์นี้:`);
    insights.push(`💊 กินยา: ${weekTotal.medication.count} ครั้ง`);
    insights.push(`💧 ดื่มน้ำ: ${weekTotal.water.totalMl.toLocaleString()} มล.`);
    insights.push(`🍚 ทานอาหาร: ${weekTotal.food.count} มื้อ`);
    insights.push(`🚶 ออกกำลังกาย: ${weekTotal.exercise.totalMinutes} นาที`);

    // Comparison with previous week
    if (comparison) {
      const changes: string[] = [];
      if (comparison.change.medication > 0) {
        changes.push(`กินยา +${comparison.change.medication}%`);
      } else if (comparison.change.medication < 0) {
        changes.push(`กินยา ${comparison.change.medication}%`);
      }

      if (comparison.change.exercise > 0) {
        changes.push(`ออกกำลังกาย +${comparison.change.exercise}%`);
      } else if (comparison.change.exercise < 0) {
        changes.push(`ออกกำลังกาย ${comparison.change.exercise}%`);
      }

      if (changes.length > 0) {
        insights.push(`📈 เทียบกับสัปดาห์ก่อน: ${changes.join(', ')}`);
      }
    }

    // Best day
    const dates = Object.keys(dailySummaries).sort();
    let bestDate = dates[0];
    let bestScore = 0;

    dates.forEach(date => {
      const summary = dailySummaries[date];
      const score = summary.medication.count + summary.water.count + summary.food.count + summary.exercise.count;
      if (score > bestScore) {
        bestScore = score;
        bestDate = date;
      }
    });

    if (bestScore > 0) {
      const bestDateFormatted = new Date(bestDate).toLocaleDateString('th-TH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
      insights.push(`⭐ วันที่ดูแลตัวเองได้ดีที่สุด: ${bestDateFormatted}`);
    }

    return insights;
  }

  private generateMonthlyTrends(
    weeklySummaries: { [weekNumber: string]: ActivitySummary },
    bloodPressure: BloodPressureSummary
  ): string[] {
    const trends: string[] = [];

    // Blood pressure monthly trend
    if (bloodPressure.readings.length > 0) {
      if (bloodPressure.average) {
        trends.push(`🩺 ความดันเฉลี่ยเดือนนี้: ${bloodPressure.average.systolic}/${bloodPressure.average.diastolic} mmHg`);
      }
      if (bloodPressure.highest && bloodPressure.lowest) {
        trends.push(`📊 ช่วงความดัน: ${bloodPressure.lowest.systolic}/${bloodPressure.lowest.diastolic} - ${bloodPressure.highest.systolic}/${bloodPressure.highest.diastolic} mmHg`);
      }
    }

    // Weekly progress
    const weeks = Object.keys(weeklySummaries).sort();
    if (weeks.length >= 2) {
      const firstWeek = weeklySummaries[weeks[0]];
      const lastWeek = weeklySummaries[weeks[weeks.length - 1]];

      if (lastWeek.medication.count > firstWeek.medication.count) {
        trends.push('📈 การกินยาดีขึ้นเรื่อยๆ ตลอดเดือน');
      }
      if (lastWeek.exercise.totalMinutes > firstWeek.exercise.totalMinutes) {
        trends.push('📈 ออกกำลังกายมากขึ้นในช่วงท้ายเดือน');
      }
    }

    return trends;
  }

  private generateMonthlyInsights(
    monthTotal: ActivitySummary,
    activeDays: number,
    totalDays: number,
    comparison: any
  ): string[] {
    const insights: string[] = [];

    // Summary
    insights.push(`📊 สรุปกิจกรรมเดือนนี้:`);
    insights.push(`💊 กินยา: ${monthTotal.medication.count} ครั้ง`);
    insights.push(`💧 ดื่มน้ำ: ${monthTotal.water.totalMl.toLocaleString()} มล.`);
    insights.push(`🍚 ทานอาหาร: ${monthTotal.food.count} มื้อ`);
    insights.push(`🩺 วัดความดัน: ${monthTotal.vitals.count} ครั้ง`);
    insights.push(`🚶 ออกกำลังกาย: ${monthTotal.exercise.totalMinutes} นาที`);

    // Active days
    const activeRate = Math.round((activeDays / totalDays) * 100);
    insights.push(`📅 วันที่มีกิจกรรม: ${activeDays}/${totalDays} วัน (${activeRate}%)`);

    // Comparison with previous month
    if (comparison) {
      const changes: string[] = [];
      if (comparison.change.completionRate !== 0) {
        const sign = comparison.change.completionRate > 0 ? '+' : '';
        changes.push(`อัตราความสำเร็จ ${sign}${comparison.change.completionRate}%`);
      }
      if (comparison.change.exercise !== 0) {
        const sign = comparison.change.exercise > 0 ? '+' : '';
        changes.push(`ออกกำลังกาย ${sign}${comparison.change.exercise}%`);
      }

      if (changes.length > 0) {
        insights.push(`📈 เทียบกับเดือนก่อน: ${changes.join(', ')}`);
      }
    }

    return insights;
  }

  // ============================================
  // FORMAT METHODS
  // ============================================

  formatDailyReportText(report: DailyReport): string {
    const dateStr = report.date.toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let text = `📊 รายงานประจำวัน\n`;
    text += `👤 ${report.patientName}\n`;
    text += `📅 ${dateStr}\n\n`;

    text += `📈 อัตราความสำเร็จ: ${report.completionRate}%\n\n`;

    // Alerts first
    if (report.alerts.length > 0) {
      text += `🚨 แจ้งเตือน:\n`;
      report.alerts.forEach(alert => {
        text += `${alert}\n`;
      });
      text += `\n`;
    }

    // Blood pressure
    const bpData = report.summary.vitals.bloodPressure;
    if (bpData && bpData.latest) {
      const latest = bpData.latest;
      text += `🩺 ความดันโลหิต:\n`;
      text += `   ล่าสุด: ${latest.systolic}/${latest.diastolic} mmHg\n`;
      if (bpData.readings.length > 1 && bpData.average) {
        text += `   เฉลี่ย: ${bpData.average.systolic}/${bpData.average.diastolic} mmHg\n`;
      }
      text += `\n`;
    }

    text += `📝 สรุปกิจกรรม:\n`;
    text += `💊 กินยา: ${report.summary.medication.count} ครั้ง\n`;
    text += `💧 ดื่มน้ำ: ${report.summary.water.totalMl.toLocaleString()} มล.\n`;
    text += `🍚 ทานอาหาร: ${report.summary.food.count} มื้อ\n`;
    text += `🩺 วัดสุขภาพ: ${report.summary.vitals.count} ครั้ง\n`;
    text += `🚶 ออกกำลังกาย: ${report.summary.exercise.totalMinutes} นาที\n\n`;

    // Activity timeline
    if (report.activities.length > 0) {
      text += `⏰ กิจกรรมวันนี้:\n`;
      report.activities.slice(0, 5).forEach(activity => {
        const time = activity.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const typeEmoji = this.getTypeEmoji(activity.type);
        const actor = activity.recordedBy ? ` (${activity.recordedBy})` : '';
        text += `   ${time} ${typeEmoji} ${this.getTypeName(activity.type)}${actor}\n`;
      });
      if (report.activities.length > 5) {
        text += `   ... และอีก ${report.activities.length - 5} รายการ\n`;
      }
      text += `\n`;
    }

    if (report.insights.length > 0) {
      text += `💡 ข้อสังเกต:\n`;
      report.insights.forEach(insight => {
        text += `${insight}\n`;
      });
    }

    return text;
  }

  formatWeeklyReportText(report: WeeklyReport): string {
    const startStr = report.startDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
    const endStr = report.endDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });

    let text = `📊 รายงานสัปดาห์\n`;
    text += `👤 ${report.patientName}\n`;
    text += `📅 ${startStr} - ${endStr}\n\n`;

    // Blood pressure summary
    if (report.bloodPressureTrend.readings.length > 0) {
      const bp = report.bloodPressureTrend;
      text += `🩺 ความดันโลหิต:\n`;
      if (bp.average) {
        text += `   เฉลี่ย: ${bp.average.systolic}/${bp.average.diastolic} mmHg\n`;
      }
      if (bp.highest && bp.lowest) {
        text += `   สูงสุด: ${bp.highest.systolic}/${bp.highest.diastolic} mmHg\n`;
        text += `   ต่ำสุด: ${bp.lowest.systolic}/${bp.lowest.diastolic} mmHg\n`;
      }
      text += `   จำนวนครั้งวัด: ${bp.readings.length} ครั้ง\n\n`;
    }

    text += `📝 สรุปกิจกรรมทั้งสัปดาห์:\n`;
    text += `💊 กินยา: ${report.weekTotal.medication.count} ครั้ง\n`;
    text += `💧 ดื่มน้ำ: ${report.weekTotal.water.totalMl.toLocaleString()} มล.\n`;
    text += `🍚 ทานอาหาร: ${report.weekTotal.food.count} มื้อ\n`;
    text += `🩺 วัดสุขภาพ: ${report.weekTotal.vitals.count} ครั้ง\n`;
    text += `🚶 ออกกำลังกาย: ${report.weekTotal.exercise.totalMinutes} นาที\n\n`;

    // Missing days
    if (report.missingDays.length > 0) {
      text += `⚠️ วันที่ไม่มีกิจกรรม: ${report.missingDays.length} วัน\n\n`;
    }

    if (report.trends.length > 0) {
      text += `📈 แนวโน้ม:\n`;
      report.trends.forEach(trend => {
        text += `${trend}\n`;
      });
      text += `\n`;
    }

    if (report.insights.length > 0) {
      text += `💡 ข้อสังเกต:\n`;
      report.insights.forEach(insight => {
        text += `${insight}\n`;
      });
    }

    return text;
  }

  formatMonthlyReportText(report: MonthlyReport): string {
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const monthName = monthNames[report.month];

    let text = `📊 รายงานเดือน${monthName} ${report.year + 543}\n`;
    text += `👤 ${report.patientName}\n\n`;

    text += `📈 อัตราความสำเร็จเฉลี่ย: ${report.averageCompletionRate}%\n`;
    text += `📅 วันที่มีกิจกรรม: ${report.activeDays}/${report.totalDays} วัน\n\n`;

    // Blood pressure summary
    if (report.bloodPressureTrend.readings.length > 0) {
      const bp = report.bloodPressureTrend;
      text += `🩺 ความดันโลหิต:\n`;
      if (bp.average) {
        text += `   เฉลี่ย: ${bp.average.systolic}/${bp.average.diastolic} mmHg\n`;
      }
      if (bp.highest && bp.lowest) {
        text += `   ช่วง: ${bp.lowest.systolic}/${bp.lowest.diastolic} - ${bp.highest.systolic}/${bp.highest.diastolic} mmHg\n`;
      }
      text += `   จำนวนครั้งวัด: ${bp.readings.length} ครั้ง\n\n`;
    }

    text += `📝 สรุปกิจกรรมทั้งเดือน:\n`;
    text += `💊 กินยา: ${report.monthTotal.medication.count} ครั้ง\n`;
    text += `💧 ดื่มน้ำ: ${report.monthTotal.water.totalMl.toLocaleString()} มล.\n`;
    text += `🍚 ทานอาหาร: ${report.monthTotal.food.count} มื้อ\n`;
    text += `🩺 วัดสุขภาพ: ${report.monthTotal.vitals.count} ครั้ง\n`;
    text += `🚶 ออกกำลังกาย: ${report.monthTotal.exercise.totalMinutes} นาที\n\n`;

    if (report.trends.length > 0) {
      text += `📈 แนวโน้ม:\n`;
      report.trends.forEach(trend => {
        text += `${trend}\n`;
      });
      text += `\n`;
    }

    if (report.insights.length > 0) {
      text += `💡 ข้อสังเกต:\n`;
      report.insights.forEach(insight => {
        text += `${insight}\n`;
      });
    }

    return text;
  }

  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      medication: '💊',
      vitals: '🩺',
      water: '💧',
      food: '🍚',
      walk: '🚶',
      exercise: '🏃'
    };
    return emojis[type] || '📝';
  }

  private getTypeName(type: string): string {
    const names: Record<string, string> = {
      medication: 'กินยา',
      vitals: 'วัดความดัน',
      water: 'ดื่มน้ำ',
      food: 'ทานอาหาร',
      walk: 'เดิน',
      exercise: 'ออกกำลังกาย'
    };
    return names[type] || type;
  }
}

export const reportService = new ReportService();
