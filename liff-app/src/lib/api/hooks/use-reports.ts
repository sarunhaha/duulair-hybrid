import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { subDays, format, eachDayOfInterval } from 'date-fns';
import { th } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
export interface ReportSummary {
  bp: {
    avgSystolic: number;
    avgDiastolic: number;
    count: number;
    status: 'normal' | 'elevated' | 'high' | 'crisis';
  };
  meds: {
    adherencePercent: number;
    takenCount: number;
    totalCount: number;
    status: 'good' | 'fair' | 'poor';
  };
  water: {
    avgMl: number;
    daysRecorded: number;
    status: 'good' | 'fair' | 'poor';
  };
  activities: {
    total: number;
    byType: Record<string, number>;
  };
}

export interface ActivityLogItem {
  id: string;
  type: 'medication' | 'vitals' | 'water' | 'symptom' | 'sleep' | 'exercise';
  title: string;
  value: string;
  timestamp: string;
  date: string;
  time: string;
}

export interface ChartDataPoint {
  date: string;
  day: string;
  systolic?: number;
  diastolic?: number;
  medsPercent?: number;
  waterMl?: number;
}

export interface ReportData {
  summary: ReportSummary;
  chartData: ChartDataPoint[];
  activities: ActivityLogItem[];
}

export type DateRange = '7d' | '30d' | '90d' | 'custom';

// Query keys
export const reportKeys = {
  all: ['reports'] as const,
  data: (patientId: string, startDate: string, endDate: string) =>
    [...reportKeys.all, 'data', patientId, startDate, endDate] as const,
};

// Helper functions
export function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate: Date;

  switch (range) {
    case '7d':
      startDate = subDays(endDate, 6);
      break;
    case '30d':
      startDate = subDays(endDate, 29);
      break;
    case '90d':
      startDate = subDays(endDate, 89);
      break;
    case 'custom':
      startDate = customStart || subDays(endDate, 6);
      return { startDate, endDate: customEnd || endDate };
    default:
      startDate = subDays(endDate, 6);
  }

  return { startDate, endDate };
}

export function formatDateRange(startDate: Date, endDate: Date): string {
  const start = format(startDate, 'd MMM', { locale: th });
  const end = format(endDate, 'd MMM yyyy', { locale: th });
  return `${start} - ${end}`;
}

// Reports Data Hook
export function useReportData(
  patientId: string | null,
  range: DateRange,
  customStart?: Date,
  customEnd?: Date
) {
  const { startDate, endDate } = getDateRange(range, customStart, customEnd);
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: patientId ? reportKeys.data(patientId, startStr, endStr) : ['reports', 'data', 'none'],
    queryFn: async (): Promise<ReportData> => {
      if (!patientId) return getMockReportData(startDate, endDate);
      try {
        const data = await apiClient.get<ReportData>(
          `/reports/${patientId}?start=${startStr}&end=${endStr}`
        );
        return data;
      } catch {
        console.warn('Reports API not available, using mock data');
        return getMockReportData(startDate, endDate);
      }
    },
    enabled: !!patientId || true, // Always fetch for demo
    staleTime: 60 * 1000,
  });
}

// BP Status Helper
export function getBpStatus(systolic: number, diastolic: number): 'normal' | 'elevated' | 'high' | 'crisis' {
  if (systolic >= 180 || diastolic >= 120) return 'crisis';
  if (systolic >= 140 || diastolic >= 90) return 'high';
  if (systolic >= 130 || diastolic >= 80) return 'elevated';
  return 'normal';
}

export function getBpStatusLabel(status: 'normal' | 'elevated' | 'high' | 'crisis'): string {
  const labels: Record<string, string> = {
    normal: 'ปกติ',
    elevated: 'สูงเล็กน้อย',
    high: 'สูง',
    crisis: 'สูงมาก',
  };
  return labels[status] || status;
}

// Meds Status Helper
export function getMedsStatusLabel(status: 'good' | 'fair' | 'poor'): string {
  const labels: Record<string, string> = {
    good: 'ดีมาก',
    fair: 'พอใช้',
    poor: 'ต้องปรับปรุง',
  };
  return labels[status] || status;
}

// Water Status Helper
export function getWaterStatusLabel(status: 'good' | 'fair' | 'poor'): string {
  const labels: Record<string, string> = {
    good: 'เพียงพอ',
    fair: 'พอใช้',
    poor: 'น้อยเกินไป',
  };
  return labels[status] || status;
}

// Activity Type Labels
export function getActivityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    medication: 'กินยา',
    vitals: 'วัดความดัน',
    water: 'ดื่มน้ำ',
    symptom: 'อาการ',
    sleep: 'การนอน',
    exercise: 'ออกกำลังกาย',
  };
  return labels[type] || type;
}

// Export to CSV
export function exportToCSV(data: ReportData, patientName: string, dateRange: string): void {
  const rows: string[][] = [];

  // Header
  rows.push(['รายงานสุขภาพ - ' + patientName]);
  rows.push(['ช่วงเวลา: ' + dateRange]);
  rows.push([]);

  // Summary
  rows.push(['สรุปภาพรวม']);
  rows.push(['ความดันเฉลี่ย', `${data.summary.bp.avgSystolic}/${data.summary.bp.avgDiastolic} mmHg`]);
  rows.push(['การกินยา', `${data.summary.meds.adherencePercent}%`]);
  rows.push(['น้ำดื่มเฉลี่ย', `${data.summary.water.avgMl} มล./วัน`]);
  rows.push(['กิจกรรมทั้งหมด', `${data.summary.activities.total} รายการ`]);
  rows.push([]);

  // Chart data
  rows.push(['ข้อมูลรายวัน']);
  rows.push(['วันที่', 'Systolic', 'Diastolic', 'ยา (%)', 'น้ำ (มล.)']);
  data.chartData.forEach((point) => {
    rows.push([
      point.date,
      point.systolic?.toString() || '-',
      point.diastolic?.toString() || '-',
      point.medsPercent?.toString() || '-',
      point.waterMl?.toString() || '-',
    ]);
  });
  rows.push([]);

  // Activities
  rows.push(['รายละเอียดกิจกรรม']);
  rows.push(['วันที่', 'เวลา', 'ประเภท', 'รายละเอียด']);
  data.activities.forEach((activity) => {
    rows.push([activity.date, activity.time, getActivityTypeLabel(activity.type), activity.value]);
  });

  // Convert to CSV string
  const csvContent = rows.map((row) => row.join(',')).join('\n');
  const BOM = '\uFEFF'; // UTF-8 BOM for Thai characters
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `health-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
}

// Export to PDF
export function exportToPDF(data: ReportData, patientName: string, dateRange: string): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Health Report - OONJAI', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient: ${patientName}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  doc.text(`Period: ${dateRange}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Summary Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const summaryData = [
    ['Blood Pressure (Average)', `${data.summary.bp.avgSystolic}/${data.summary.bp.avgDiastolic} mmHg`, getBpStatusLabel(data.summary.bp.status)],
    ['Medication Adherence', `${data.summary.meds.adherencePercent}%`, getMedsStatusLabel(data.summary.meds.status)],
    ['Water Intake (Average)', `${data.summary.water.avgMl} ml/day`, getWaterStatusLabel(data.summary.water.status)],
    ['Total Activities', `${data.summary.activities.total}`, ''],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value', 'Status']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [30, 123, 156] },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // Daily Data Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Records', 14, yPos);
  yPos += 10;

  const dailyData = data.chartData.map((point) => [
    point.date,
    point.systolic?.toString() || '-',
    point.diastolic?.toString() || '-',
    point.medsPercent !== undefined ? `${point.medsPercent}%` : '-',
    point.waterMl?.toString() || '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Systolic', 'Diastolic', 'Meds (%)', 'Water (ml)']],
    body: dailyData,
    theme: 'striped',
    headStyles: { fillColor: [30, 123, 156] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // Check if we need a new page for activities
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  // Activities Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Activity Log', 14, yPos);
  yPos += 10;

  const activityData = data.activities.slice(0, 20).map((activity) => [
    activity.date,
    activity.time,
    getActivityTypeLabel(activity.type),
    activity.value,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Time', 'Type', 'Detail']],
    body: activityData,
    theme: 'striped',
    headStyles: { fillColor: [30, 123, 156] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Generated by OONJAI - ${format(new Date(), 'yyyy-MM-dd HH:mm')} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  doc.save(`health-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// Mock Data Generator
function getMockReportData(startDate: Date, endDate: Date): ReportData {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Generate chart data
  const chartData: ChartDataPoint[] = days.map((date) => {
    const sys = 115 + Math.floor(Math.random() * 30);
    const dia = 70 + Math.floor(Math.random() * 20);
    const medsPercent = Math.random() > 0.2 ? 100 : Math.random() > 0.5 ? 50 : 0;
    const waterMl = 1000 + Math.floor(Math.random() * 1500);

    return {
      date: format(date, 'yyyy-MM-dd'),
      day: format(date, 'd MMM', { locale: th }),
      systolic: Math.random() > 0.1 ? sys : undefined,
      diastolic: Math.random() > 0.1 ? dia : undefined,
      medsPercent,
      waterMl: Math.random() > 0.15 ? waterMl : undefined,
    };
  });

  // Calculate summary
  const bpData = chartData.filter((d) => d.systolic && d.diastolic);
  const avgSystolic = bpData.length > 0
    ? Math.round(bpData.reduce((sum, d) => sum + (d.systolic || 0), 0) / bpData.length)
    : 0;
  const avgDiastolic = bpData.length > 0
    ? Math.round(bpData.reduce((sum, d) => sum + (d.diastolic || 0), 0) / bpData.length)
    : 0;

  const medsData = chartData.filter((d) => d.medsPercent !== undefined);
  const avgMedsPercent = medsData.length > 0
    ? Math.round(medsData.reduce((sum, d) => sum + (d.medsPercent || 0), 0) / medsData.length)
    : 0;

  const waterData = chartData.filter((d) => d.waterMl !== undefined);
  const avgWater = waterData.length > 0
    ? Math.round(waterData.reduce((sum, d) => sum + (d.waterMl || 0), 0) / waterData.length)
    : 0;

  // Generate activities
  const activities: ActivityLogItem[] = [];
  const activityTypes: ActivityLogItem['type'][] = ['medication', 'vitals', 'water', 'symptom'];

  days.forEach((date) => {
    const numActivities = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numActivities; i++) {
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const hour = 6 + Math.floor(Math.random() * 14);
      const minute = Math.floor(Math.random() * 60);

      let title = '';
      let value = '';

      switch (type) {
        case 'medication':
          title = 'กินยา';
          value = ['ยาลดความดัน', 'Metformin', 'วิตามิน'][Math.floor(Math.random() * 3)];
          break;
        case 'vitals':
          title = 'วัดความดัน';
          value = `${115 + Math.floor(Math.random() * 30)}/${70 + Math.floor(Math.random() * 20)} mmHg`;
          break;
        case 'water':
          title = 'ดื่มน้ำ';
          value = `${250 + Math.floor(Math.random() * 500)} มล.`;
          break;
        case 'symptom':
          title = 'บันทึกอาการ';
          value = ['ปวดหัว', 'เวียนศีรษะ', 'อ่อนเพลีย'][Math.floor(Math.random() * 3)];
          break;
      }

      activities.push({
        id: `${format(date, 'yyyy-MM-dd')}-${i}`,
        type,
        title,
        value,
        timestamp: new Date(date.setHours(hour, minute)).toISOString(),
        date: format(date, 'd MMM', { locale: th }),
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      });
    }
  });

  // Sort activities by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const summary: ReportSummary = {
    bp: {
      avgSystolic,
      avgDiastolic,
      count: bpData.length,
      status: getBpStatus(avgSystolic, avgDiastolic),
    },
    meds: {
      adherencePercent: avgMedsPercent,
      takenCount: medsData.filter((d) => d.medsPercent === 100).length,
      totalCount: medsData.length,
      status: avgMedsPercent >= 90 ? 'good' : avgMedsPercent >= 70 ? 'fair' : 'poor',
    },
    water: {
      avgMl: avgWater,
      daysRecorded: waterData.length,
      status: avgWater >= 1500 ? 'good' : avgWater >= 1000 ? 'fair' : 'poor',
    },
    activities: {
      total: activities.length,
      byType: activities.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  };

  return {
    summary,
    chartData,
    activities: activities.slice(0, 30), // Limit to 30 most recent
  };
}
