/**
 * Report Generation Service (TASK-002 Phase 5)
 * Generates health reports for patients and groups
 */

import { supabase } from './supabase.service';

interface ActivitySummary {
  medication: { count: number; lastTaken?: Date };
  vitals: { count: number; lastReading?: any };
  water: { totalMl: number; count: number };
  food: { count: number };
  exercise: { totalMinutes: number; count: number };
}

interface DailyReport {
  date: Date;
  patientName: string;
  summary: ActivitySummary;
  activities: any[];
  completionRate: number;
  insights: string[];
}

interface WeeklyReport {
  startDate: Date;
  endDate: Date;
  patientName: string;
  dailySummaries: { [date: string]: ActivitySummary };
  weekTotal: ActivitySummary;
  trends: string[];
  insights: string[];
}

export class ReportService {
  /**
   * Generate daily report for a patient
   */
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

    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'ผู้ป่วย';

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

    // Calculate summary
    const summary = this.calculateActivitySummary(activities || []);

    // Calculate completion rate
    const completionRate = this.calculateCompletionRate(summary);

    // Generate insights
    const insights = this.generateDailyInsights(summary, activities || []);

    return {
      date: reportDate,
      patientName,
      summary,
      activities: activities || [],
      completionRate,
      insights
    };
  }

  /**
   * Generate weekly report for a patient
   */
  async generateWeeklyReport(patientId: string, endDate?: Date): Promise<WeeklyReport> {
    const end = endDate || new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6); // Last 7 days
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Get patient info
    const { data: patient } = await supabase
      .from('patient_profiles')
      .select('first_name, last_name')
      .eq('id', patientId)
      .single();

    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'ผู้ป่วย';

    // Get activities for the week
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString())
      .order('timestamp', { ascending: true });

    // Group by day
    const dailySummaries: { [date: string]: ActivitySummary } = {};
    const activityGroups: { [date: string]: any[] } = {};

    (activities || []).forEach(activity => {
      const activityDate = new Date(activity.timestamp);
      const dateKey = activityDate.toISOString().split('T')[0];

      if (!activityGroups[dateKey]) {
        activityGroups[dateKey] = [];
      }
      activityGroups[dateKey].push(activity);
    });

    // Calculate summary for each day
    Object.keys(activityGroups).forEach(dateKey => {
      dailySummaries[dateKey] = this.calculateActivitySummary(activityGroups[dateKey]);
    });

    // Calculate week total
    const weekTotal = this.calculateActivitySummary(activities || []);

    // Generate trends and insights
    const trends = this.generateWeeklyTrends(dailySummaries);
    const insights = this.generateWeeklyInsights(weekTotal, dailySummaries);

    return {
      startDate: start,
      endDate: end,
      patientName,
      dailySummaries,
      weekTotal,
      trends,
      insights
    };
  }

  /**
   * Calculate activity summary
   */
  private calculateActivitySummary(activities: any[]): ActivitySummary {
    const summary: ActivitySummary = {
      medication: { count: 0 },
      vitals: { count: 0 },
      water: { totalMl: 0, count: 0 },
      food: { count: 0 },
      exercise: { totalMinutes: 0, count: 0 }
    };

    activities.forEach(activity => {
      const taskType = activity.task_type;
      const value = activity.value;

      switch (taskType) {
        case 'medication':
          summary.medication.count++;
          if (!summary.medication.lastTaken || new Date(activity.timestamp) > new Date(summary.medication.lastTaken)) {
            summary.medication.lastTaken = new Date(activity.timestamp);
          }
          break;

        case 'vitals':
          summary.vitals.count++;
          if (value) {
            summary.vitals.lastReading = value;
          }
          break;

        case 'water':
          summary.water.count++;
          if (value && value.amount) {
            summary.water.totalMl += value.amount;
          }
          break;

        case 'food':
          summary.food.count++;
          break;

        case 'walk':
        case 'exercise':
          summary.exercise.count++;
          if (value && value.duration) {
            summary.exercise.totalMinutes += value.duration;
          }
          break;
      }
    });

    return summary;
  }

  /**
   * Calculate completion rate (0-100)
   */
  private calculateCompletionRate(summary: ActivitySummary): number {
    // Expected daily activities:
    // - Medication: 2 times (morning/evening)
    // - Water: 8 glasses (2000ml)
    // - Food: 3 meals
    // - Vitals: 1 reading
    // - Exercise: 1 session

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

  /**
   * Generate daily insights
   */
  private generateDailyInsights(summary: ActivitySummary, activities: any[]): string[] {
    const insights: string[] = [];

    // Medication insights
    if (summary.medication.count === 0) {
      insights.push('⚠️ ยังไม่ได้บันทึกการกินยาวันนี้');
    } else if (summary.medication.count < 2) {
      insights.push('💊 กินยาแล้ว 1 มื้อ อย่าลืมกินยามื้อถัดไปนะคะ');
    } else {
      insights.push('✅ กินยาครบทุกมื้อแล้ว');
    }

    // Water insights
    if (summary.water.totalMl >= 2000) {
      insights.push('💧 ดื่มน้ำครบตามเป้าหมายแล้ว เยี่ยมมาก!');
    } else if (summary.water.totalMl >= 1000) {
      insights.push(`💧 ดื่มน้ำไปแล้ว ${summary.water.totalMl} มล. ยังขาดอีก ${2000 - summary.water.totalMl} มล.`);
    } else {
      insights.push('💧 อย่าลืมดื่มน้ำให้เพียงพอนะคะ');
    }

    // Vitals insights
    if (summary.vitals.count > 0 && summary.vitals.lastReading) {
      const reading = summary.vitals.lastReading;
      if (reading.systolic && reading.diastolic) {
        insights.push(`🩺 ความดันล่าสุด: ${reading.systolic}/${reading.diastolic} mmHg`);
      }
    }

    // Exercise insights
    if (summary.exercise.count === 0) {
      insights.push('🚶 อย่าลืมออกกำลังกายนะคะ');
    } else {
      insights.push(`🚶 ออกกำลังกายแล้ว ${summary.exercise.totalMinutes} นาที เยี่ยม!`);
    }

    return insights;
  }

  /**
   * Generate weekly trends
   */
  private generateWeeklyTrends(dailySummaries: { [date: string]: ActivitySummary }): string[] {
    const trends: string[] = [];
    const dates = Object.keys(dailySummaries).sort();

    if (dates.length < 2) {
      return ['ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์แนวโน้ม'];
    }

    // Medication trend
    const medCounts = dates.map(d => dailySummaries[d].medication.count);
    const avgMed = medCounts.reduce((a, b) => a + b, 0) / medCounts.length;
    if (avgMed >= 2) {
      trends.push('✅ กินยาสม่ำเสมอทุกวัน');
    } else if (avgMed >= 1) {
      trends.push('⚠️ กินยาไม่ครบบางวัน ควรปรับปรุง');
    }

    // Water trend
    const waterTotals = dates.map(d => dailySummaries[d].water.totalMl);
    const avgWater = waterTotals.reduce((a, b) => a + b, 0) / waterTotals.length;
    if (avgWater >= 1500) {
      trends.push('💧 ดื่มน้ำเพียงพอ');
    } else {
      trends.push('💧 ควรดื่มน้ำให้มากขึ้น');
    }

    // Exercise trend
    const exerciseCounts = dates.map(d => dailySummaries[d].exercise.count);
    const exerciseDays = exerciseCounts.filter(c => c > 0).length;
    if (exerciseDays >= 5) {
      trends.push('🚶 ออกกำลังกายสม่ำเสมอ เยี่ยมมาก!');
    } else if (exerciseDays >= 3) {
      trends.push('🚶 ออกกำลังกายดี แต่ควรเพิ่มให้มากขึ้น');
    } else {
      trends.push('🚶 ควรออกกำลังกายให้มากขึ้น');
    }

    return trends;
  }

  /**
   * Generate weekly insights
   */
  private generateWeeklyInsights(weekTotal: ActivitySummary, dailySummaries: { [date: string]: ActivitySummary }): string[] {
    const insights: string[] = [];

    // Overall summary
    insights.push(`📊 สรุปกิจกรรมสัปดาห์นี้:`);
    insights.push(`💊 กินยา: ${weekTotal.medication.count} ครั้ง`);
    insights.push(`💧 ดื่มน้ำ: ${weekTotal.water.totalMl} มล.`);
    insights.push(`🍚 ทานอาหาร: ${weekTotal.food.count} มื้อ`);
    insights.push(`🚶 ออกกำลังกาย: ${weekTotal.exercise.totalMinutes} นาที`);

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

    const bestDateFormatted = new Date(bestDate).toLocaleDateString('th-TH', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
    insights.push(`⭐ วันที่ดูแลตัวเองได้ดีที่สุด: ${bestDateFormatted}`);

    return insights;
  }

  /**
   * Format daily report as text
   */
  formatDailyReportText(report: DailyReport): string {
    const dateStr = report.date.toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let text = `📊 รายงานประจำวัน\n`;
    text += `${report.patientName}\n`;
    text += `${dateStr}\n\n`;

    text += `📈 อัตราความสำเร็จ: ${report.completionRate}%\n\n`;

    text += `📝 สรุปกิจกรรม:\n`;
    text += `💊 กินยา: ${report.summary.medication.count} ครั้ง\n`;
    text += `💧 ดื่มน้ำ: ${report.summary.water.totalMl} มล.\n`;
    text += `🍚 ทานอาหาร: ${report.summary.food.count} มื้อ\n`;
    text += `🩺 วัดสุขภาพ: ${report.summary.vitals.count} ครั้ง\n`;
    text += `🚶 ออกกำลังกาย: ${report.summary.exercise.totalMinutes} นาที\n\n`;

    if (report.insights.length > 0) {
      text += `💡 ข้อสังเกต:\n`;
      report.insights.forEach(insight => {
        text += `${insight}\n`;
      });
    }

    return text;
  }

  /**
   * Format weekly report as text
   */
  formatWeeklyReportText(report: WeeklyReport): string {
    const startStr = report.startDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
    const endStr = report.endDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });

    let text = `📊 รายงานสัปดาห์\n`;
    text += `${report.patientName}\n`;
    text += `${startStr} - ${endStr}\n\n`;

    text += `📝 สรุปกิจกรรมทั้งสัปดาห์:\n`;
    text += `💊 กินยา: ${report.weekTotal.medication.count} ครั้ง\n`;
    text += `💧 ดื่มน้ำ: ${report.weekTotal.water.totalMl} มล.\n`;
    text += `🍚 ทานอาหาร: ${report.weekTotal.food.count} มื้อ\n`;
    text += `🩺 วัดสุขภาพ: ${report.weekTotal.vitals.count} ครั้ง\n`;
    text += `🚶 ออกกำลังกาย: ${report.weekTotal.exercise.totalMinutes} นาที\n\n`;

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
}

export const reportService = new ReportService();
