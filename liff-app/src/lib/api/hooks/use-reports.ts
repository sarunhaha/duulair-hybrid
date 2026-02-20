import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { subDays, format, eachDayOfInterval } from 'date-fns';
import { th } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Thai font support - using Sarabun TTF (Regular + Bold)
let thaiFontRegular: string | null = null;
let thaiFontBold: string | null = null;
let fontLoadPromise: Promise<{ regular: string | null; bold: string | null }> | null = null;

async function loadFontFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();

    // Verify valid TTF
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    const isValidTTF = (header[0] === 0x00 && header[1] === 0x01 && header[2] === 0x00 && header[3] === 0x00) ||
                      (header[0] === 0x74 && header[1] === 0x72 && header[2] === 0x75 && header[3] === 0x65);
    if (!isValidTTF) return null;

    // Convert to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

async function loadThaiFonts(): Promise<{ regular: string | null; bold: string | null }> {
  if (thaiFontRegular) return { regular: thaiFontRegular, bold: thaiFontBold };
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    // Use Vite base URL for correct path in production (/liff-v2/) vs dev (/)
    const base = import.meta.env.BASE_URL || '/';

    // Load Regular
    const regular = await loadFontFromUrl(`${base}fonts/Sarabun-Regular.ttf`)
      || await loadFontFromUrl('https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf');

    // Load Bold
    const bold = await loadFontFromUrl(`${base}fonts/Sarabun-Bold.ttf`)
      || await loadFontFromUrl('https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf');

    if (regular) {
      thaiFontRegular = regular;
      console.log('Thai font Regular loaded');
    }
    if (bold) {
      thaiFontBold = bold;
      console.log('Thai font Bold loaded');
    }
    if (!regular) {
      console.warn('Thai Regular font failed to load, PDF will use default font');
    }

    return { regular, bold };
  })();

  return fontLoadPromise;
}

// Types
export interface ReportSummary {
  bp: {
    avgSystolic: number;
    avgDiastolic: number;
    avgHeartRate?: number;
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
  sleep?: {
    avgHours: number;
    daysRecorded: number;
    status: 'good' | 'fair' | 'poor';
  };
  glucose?: {
    avgGlucose: number;
    daysRecorded: number;
    status: 'normal' | 'pre' | 'high';
  };
  activities: {
    total: number;
    byType: Record<string, number>;
  };
}

export interface SignificantEvent {
  date: string;
  title: string;
  tag: string;
  type: 'health' | 'meds' | 'symptom' | 'sleep';
  timestamp?: string;
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
  pulse?: number;
  medsPercent?: number;
  waterMl?: number;
  sleepHours?: number;
  glucose?: number;
  glucoseReadings?: { glucose: number; mealContext: string | null; time: string }[];
}

export interface ReportData {
  summary: ReportSummary;
  chartData: ChartDataPoint[];
  significantEvents?: SignificantEvent[];
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
  rows.push(['วันที่', 'Systolic', 'Diastolic', 'ยา (%)', 'น้ำ (มล.)', 'ระดับน้ำตาล (mg/dL)']);
  data.chartData.forEach((point) => {
    rows.push([
      point.date,
      point.systolic?.toString() || '-',
      point.diastolic?.toString() || '-',
      point.medsPercent?.toString() || '-',
      point.waterMl?.toString() || '-',
      point.glucose?.toString() || '-',
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

// Extended PDF Export Options
export interface PDFExportOptions {
  patientName: string;
  patientAge?: number | null;
  patientGender?: string | null;
  dateRange: string;
  drugAllergies?: string[];
  foodAllergies?: string[];
  medications?: Array<{
    name: string;
    dosage_amount?: number;
    dosage_unit?: string;
  }>;
  doctorQuestions?: string[];
  chartImages?: {
    bpImage: string | null;
    medsImage: string | null;
    sleepImage: string | null;
    glucoseImage: string | null;
  };
}

// Helper: ensure enough space on page, add new page if needed
function ensureSpace(doc: jsPDF, yPos: number, neededHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos + neededHeight > pageHeight - 25) {
    doc.addPage();
    return 20;
  }
  return yPos;
}

// Helper: add chart image to PDF
function addChartImage(
  doc: jsPDF,
  imageData: string,
  yPos: number,
  pageWidth: number,
  targetHeight: number
): number {
  const imgWidth = pageWidth - 28; // 14px margin each side
  doc.addImage(imageData, 'PNG', 14, yPos, imgWidth, targetHeight);
  return yPos + targetHeight + 8;
}

// Export to PDF with Thai support
export async function exportToPDF(
  data: ReportData,
  patientName: string,
  dateRange: string,
  options?: Partial<PDFExportOptions>
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Track if Thai font is available
  let hasThaiFont = false;

  // Load Thai fonts (Regular + Bold)
  try {
    const fonts = await loadThaiFonts();
    if (fonts.regular) {
      doc.addFileToVFS('Sarabun-Regular.ttf', fonts.regular);
      doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');

      if (fonts.bold) {
        doc.addFileToVFS('Sarabun-Bold.ttf', fonts.bold);
        doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
      } else {
        doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'bold');
      }

      doc.setFont('Sarabun');
      hasThaiFont = true;
    }
  } catch (e) {
    console.warn('Could not load Thai font:', e);
  }

  const primaryColor: [number, number, number] = [30, 123, 156]; // OONJAI teal

  // Helper to set font
  const setFont = (style: 'normal' | 'bold' = 'normal', size = 11) => {
    doc.setFontSize(size);
    if (hasThaiFont) {
      try {
        doc.setFont('Sarabun', style);
        return;
      } catch {
        // Fall through to default
      }
    }
    doc.setFont('helvetica', style);
  };

  // Status color mapping for didParseCell
  const getStatusColor = (text: string): [number, number, number] | null => {
    const greenStatuses = ['ปกติ', 'ดี', 'ดีมาก', 'เพียงพอ'];
    const orangeStatuses = ['พอใช้', 'เสี่ยง', 'สูงเล็กน้อย', 'น้อย'];
    const redStatuses = ['สูง', 'สูงมาก', 'ต้องปรับปรุง', 'น้อยเกินไป'];
    if (greenStatuses.includes(text)) return [22, 163, 74];   // green-600
    if (orangeStatuses.includes(text)) return [234, 138, 0];  // orange-500
    if (redStatuses.includes(text)) return [220, 38, 38];     // red-600
    return null;
  };

  // ============ PAGE 1: COVER + SUMMARY ============

  // Header
  setFont('bold', 18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('รายงานสุขภาพ - OONJAI', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setTextColor(0, 0, 0);
  setFont('normal', 12);
  doc.text(`ชื่อ: ${patientName}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;

  // Patient info line
  const infoLine: string[] = [];
  if (options?.patientAge) infoLine.push(`อายุ ${options.patientAge} ปี`);
  if (options?.patientGender) {
    infoLine.push(options.patientGender === 'male' ? 'เพศชาย' : options.patientGender === 'female' ? 'เพศหญิง' : options.patientGender);
  }
  if (infoLine.length > 0) {
    doc.text(infoLine.join(' | '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;
  }

  doc.text(`ช่วงเวลา: ${dateRange}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  setFont('normal', 9);
  doc.setTextColor(100, 100, 100);
  doc.text(`สร้างเมื่อ: ${format(new Date(), 'd MMM yyyy HH:mm', { locale: th })} น.`, pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  // Horizontal divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 8;

  // Allergies
  const drugAllergies = options?.drugAllergies || [];
  const foodAllergies = options?.foodAllergies || [];
  if (drugAllergies.length > 0 || foodAllergies.length > 0) {
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(14, yPos - 2, pageWidth - 28, 18, 3, 3, 'FD');

    setFont('bold', 11);
    doc.setTextColor(185, 28, 28);
    doc.text('[!] แพ้:', 18, yPos + 6);

    setFont('normal', 10);
    const allergiesText = [...drugAllergies, ...foodAllergies].join(', ');
    doc.text(allergiesText, 40, yPos + 6);
    doc.setTextColor(0, 0, 0);
    yPos += 22;
  }

  // Medications table
  const medications = options?.medications || [];
  if (medications.length > 0) {
    setFont('bold', 12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('รายการยา', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    const medsData = medications.map((med, idx) => [
      (idx + 1).toString(),
      med.name,
      med.dosage_amount && med.dosage_unit ? `${med.dosage_amount} ${med.dosage_unit}` : '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'ชื่อยา', 'ขนาด']],
      body: medsData,
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22], ...(hasThaiFont && { font: 'Sarabun' }) },
      bodyStyles: { ...(hasThaiFont && { font: 'Sarabun' }) },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, ...(hasThaiFont && { font: 'Sarabun' }) },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Executive Summary with color-coded status
  yPos = ensureSpace(doc, yPos, 60);
  setFont('bold', 12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('สรุปภาพรวม', 14, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  const summaryData = [
    ['ความดันเฉลี่ย', `${data.summary.bp.avgSystolic}/${data.summary.bp.avgDiastolic} mmHg`, getBpStatusLabel(data.summary.bp.status)],
    ['การกินยาครบ', `${data.summary.meds.adherencePercent}%`, getMedsStatusLabel(data.summary.meds.status)],
    ['น้ำดื่มเฉลี่ย', `${data.summary.water.avgMl} มล./วัน`, getWaterStatusLabel(data.summary.water.status)],
  ];

  if (data.summary.sleep) {
    const sleepStatus = data.summary.sleep.status === 'good' ? 'ดี' : data.summary.sleep.status === 'fair' ? 'พอใช้' : 'น้อย';
    summaryData.push(['การนอนเฉลี่ย', `${data.summary.sleep.avgHours.toFixed(1)} ชม.`, sleepStatus]);
  }

  if (data.summary.glucose) {
    const glucoseStatus = data.summary.glucose.status === 'high' ? 'สูง' : data.summary.glucose.status === 'pre' ? 'เสี่ยง' : 'ปกติ';
    summaryData.push(['ระดับน้ำตาลเฉลี่ย', `${data.summary.glucose.avgGlucose} mg/dL`, glucoseStatus]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['รายการ', 'ค่า', 'สถานะ']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, ...(hasThaiFont && { font: 'Sarabun' }) },
    bodyStyles: { ...(hasThaiFont && { font: 'Sarabun' }) },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10, ...(hasThaiFont && { font: 'Sarabun' }) },
    didParseCell: (hookData) => {
      // Color-code the status column (column index 2) in body rows
      if (hookData.section === 'body' && hookData.column.index === 2) {
        const cellText = String(hookData.cell.raw || '');
        const color = getStatusColor(cellText);
        if (color) {
          hookData.cell.styles.textColor = color;
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ============ PAGE 2: CHARTS ============
  doc.addPage();
  yPos = 20;

  setFont('bold', 14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('กราฟสุขภาพ', 14, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 10;

  const chartImages = options?.chartImages;

  // BP & Pulse chart
  if (chartImages?.bpImage) {
    setFont('bold', 11);
    doc.text('ความดัน & ชีพจร', 14, yPos);
    yPos += 6;
    yPos = addChartImage(doc, chartImages.bpImage, yPos, pageWidth, 55);
  }

  // Medication adherence chart
  if (chartImages?.medsImage) {
    yPos = ensureSpace(doc, yPos, 50);
    setFont('bold', 11);
    doc.text('การกินยา (%)', 14, yPos);
    yPos += 6;
    yPos = addChartImage(doc, chartImages.medsImage, yPos, pageWidth, 40);
  }

  // Sleep chart
  if (chartImages?.sleepImage) {
    yPos = ensureSpace(doc, yPos, 50);
    setFont('bold', 11);
    doc.text('การนอน (ชม.)', 14, yPos);
    yPos += 6;
    yPos = addChartImage(doc, chartImages.sleepImage, yPos, pageWidth, 40);
  }

  // ============ PAGE 3: GLUCOSE CHART + SIGNIFICANT EVENTS ============

  // Glucose chart (if data exists)
  if (chartImages?.glucoseImage) {
    yPos = ensureSpace(doc, yPos, 55);
    setFont('bold', 11);
    doc.text('ระดับน้ำตาล (mg/dL)', 14, yPos);
    yPos += 6;
    yPos = addChartImage(doc, chartImages.glucoseImage, yPos, pageWidth, 50);
  }

  // Significant events — show ALL (no .slice)
  if (data.significantEvents && data.significantEvents.length > 0) {
    yPos = ensureSpace(doc, yPos, 40);

    setFont('bold', 12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('วันที่มีนัยยะ (หมอควรดู)', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    const eventsData = data.significantEvents.map((event) => [
      event.date,
      event.title,
      event.tag,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['วันที่', 'รายละเอียด', 'ประเภท']],
      body: eventsData,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11], ...(hasThaiFont && { font: 'Sarabun' }) },
      bodyStyles: { ...(hasThaiFont && { font: 'Sarabun' }) },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, ...(hasThaiFont && { font: 'Sarabun' }) },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ============ PAGE 4-5: DAILY DATA + DOCTOR QUESTIONS ============
  yPos = ensureSpace(doc, yPos, 40);

  setFont('bold', 12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ข้อมูลรายวัน', 14, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  // Show ALL days (no .slice) and add water column
  const dailyData = data.chartData.map((point) => [
    point.day || point.date,
    point.systolic ? `${point.systolic}/${point.diastolic}` : '-',
    point.pulse?.toString() || '-',
    point.medsPercent !== undefined ? `${point.medsPercent}%` : '-',
    point.sleepHours?.toFixed(1) || '-',
    point.waterMl?.toString() || '-',
    point.glucose?.toString() || '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['วันที่', 'ความดัน', 'ชีพจร', 'กินยา', 'นอน (ชม.)', 'น้ำ (มล.)', 'น้ำตาล']],
    body: dailyData,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, ...(hasThaiFont && { font: 'Sarabun' }) },
    bodyStyles: { ...(hasThaiFont && { font: 'Sarabun' }) },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, ...(hasThaiFont && { font: 'Sarabun' }) },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 26 },
      2: { cellWidth: 18 },
      3: { cellWidth: 18 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22 },
    },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Doctor questions
  const doctorQuestions = options?.doctorQuestions || [];
  if (doctorQuestions.length > 0) {
    yPos = ensureSpace(doc, yPos, 40);

    setFont('bold', 12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('คำถามถึงหมอ', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    const questionsData = doctorQuestions.map((q, idx) => [
      (idx + 1).toString(),
      q,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'คำถาม']],
      body: questionsData,
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241], ...(hasThaiFont && { font: 'Sarabun' }) },
      bodyStyles: { ...(hasThaiFont && { font: 'Sarabun' }) },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, ...(hasThaiFont && { font: 'Sarabun' }) },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'auto' },
      },
    });
  }

  // ============ FOOTER — every page ============
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Divider line above footer
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

    setFont('normal', 8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `สร้างโดย OONJAI | ${format(new Date(), 'yyyy-MM-dd HH:mm')} | หน้า ${i}/${pageCount}`,
      pageWidth / 2,
      pageHeight - 12,
      { align: 'center' }
    );

    doc.setTextColor(180, 180, 180);
    setFont('normal', 7);
    doc.text(
      'ข้อมูลนี้เป็นข้อมูลที่ผู้ใช้บันทึกเอง ไม่ใช่การวินิจฉัยทางการแพทย์',
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  // ============ DOWNLOAD ============
  const isInLineWebView = typeof window !== 'undefined' &&
    (window.liff?.isInClient?.() || /Line/i.test(navigator.userAgent));

  if (isInLineWebView) {
    const pdfBase64 = doc.output('datauristring');

    // Toolbar bar at top
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:48px;z-index:100000;background:#1E7B9C;display:flex;align-items:center;justify-content:space-between;padding:0 16px;box-shadow:0 2px 8px rgba(0,0,0,0.2);';

    const title = document.createElement('span');
    title.textContent = 'รายงานสุขภาพ PDF';
    title.style.cssText = 'color:white;font-size:15px;font-family:Kanit,sans-serif;font-weight:600;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'ปิด';
    closeBtn.style.cssText = 'color:white;background:rgba(255,255,255,0.2);border:none;border-radius:8px;padding:6px 16px;font-size:14px;font-family:Kanit,sans-serif;cursor:pointer;';

    toolbar.appendChild(title);
    toolbar.appendChild(closeBtn);

    // iframe below toolbar
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:48px;left:0;width:100%;height:calc(100% - 48px);z-index:99999;border:none;background:white;';
    iframe.src = pdfBase64;

    document.body.appendChild(iframe);
    document.body.appendChild(toolbar);

    closeBtn.onclick = () => {
      iframe.remove();
      toolbar.remove();
    };
  } else {
    doc.save(`รายงานสุขภาพ-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }
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
      glucose: Math.random() > 0.3 ? 85 + Math.floor(Math.random() * 55) : undefined,
      glucoseReadings: Math.random() > 0.3
        ? Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => {
            const contexts = ['fasting', 'post_meal_1h', 'post_meal_2h', 'before_bed'];
            const ctx = contexts[Math.floor(Math.random() * contexts.length)];
            const h = 6 + Math.floor(Math.random() * 14);
            const m = Math.floor(Math.random() * 60);
            return {
              glucose: 85 + Math.floor(Math.random() * 55),
              mealContext: ctx,
              time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            };
          })
        : undefined,
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
    glucose: {
      avgGlucose: 95 + Math.floor(Math.random() * 25),
      daysRecorded: Math.floor(bpData.length * 0.6),
      status: 'normal' as const,
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
