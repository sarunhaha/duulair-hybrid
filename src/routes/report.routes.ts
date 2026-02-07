/**
 * Report Routes
 *
 * API endpoints for report generation and downloads
 * Addresses Oonjai feedback: Download reports with custom date range
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

const router = Router();

/**
 * GET /api/reports/:patientId
 *
 * Get report data for patient with date range
 * Query Parameters:
 * - start: Start date (YYYY-MM-DD)
 * - end: End date (YYYY-MM-DD)
 */
router.get('/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { start, end } = req.query;

    if (!patientId) {
      return res.status(400).json({ success: false, error: 'Patient ID is required' });
    }

    const startDate = start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = end ? new Date(end as string) : new Date();

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const startDatetime = startDate.toISOString();
    const endDatetime = new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString(); // End of day

    console.log(`[GET /reports/${patientId}] Date range: ${startStr} to ${endStr}`);

    // Fetch all data in parallel
    const [vitals, medications, water, sleep, symptoms, healthEvents] = await Promise.all([
      // Vitals data
      supabase
        .from('vitals_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('measured_at', startDatetime)
        .lte('measured_at', endDatetime)
        .order('measured_at', { ascending: true }),

      // Medication logs
      supabase
        .from('medication_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('taken_at', startDatetime)
        .lte('taken_at', endDatetime)
        .order('taken_at', { ascending: true }),

      // Water logs
      supabase
        .from('water_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('log_date', startStr)
        .lte('log_date', endStr)
        .order('log_date', { ascending: true }),

      // Sleep logs
      supabase
        .from('sleep_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('sleep_date', startStr)
        .lte('sleep_date', endStr)
        .order('sleep_date', { ascending: true }),

      // Symptoms
      supabase
        .from('symptoms')
        .select('*')
        .eq('patient_id', patientId)
        .gte('created_at', startDatetime)
        .lte('created_at', endDatetime)
        .order('created_at', { ascending: true }),

      // Health events (significant events)
      supabase
        .from('health_events')
        .select('*')
        .eq('patient_id', patientId)
        .gte('event_timestamp', startDatetime)
        .lte('event_timestamp', endDatetime)
        .order('event_timestamp', { ascending: false }),
    ]);

    // Calculate BP summary
    const bpData = vitals.data?.filter(v => v.bp_systolic && v.bp_diastolic) || [];
    const avgSystolic = bpData.length > 0
      ? Math.round(bpData.reduce((sum, v) => sum + v.bp_systolic, 0) / bpData.length)
      : 0;
    const avgDiastolic = bpData.length > 0
      ? Math.round(bpData.reduce((sum, v) => sum + v.bp_diastolic, 0) / bpData.length)
      : 0;
    const avgHeartRate = bpData.length > 0
      ? Math.round(bpData.filter(v => v.heart_rate).reduce((sum, v) => sum + (v.heart_rate || 0), 0) / bpData.filter(v => v.heart_rate).length) || 0
      : 0;

    // Calculate medication adherence
    const medsData = medications.data || [];
    const takenCount = medsData.filter(m => m.status === 'taken').length;
    const totalMeds = medsData.length;
    const adherencePercent = totalMeds > 0 ? Math.round((takenCount / totalMeds) * 100) : 0;

    // Calculate water average
    const waterData = water.data || [];
    const waterTotal = waterData.reduce((sum, w) => sum + (w.amount_ml || 0), 0);
    const waterDays = new Set(waterData.map(w => w.log_date)).size;
    const avgWaterMl = waterDays > 0 ? Math.round(waterTotal / waterDays) : 0;

    // Calculate sleep average
    const sleepData = sleep.data || [];
    const avgSleepHours = sleepData.length > 0
      ? Math.round(sleepData.reduce((sum, s) => sum + (s.sleep_hours || 0), 0) / sleepData.length * 10) / 10
      : 0;

    // Get BP status
    const bpStatus = getBpStatus(avgSystolic, avgDiastolic);

    // Build chart data (daily)
    const chartData = buildChartData(startDate, endDate, vitals.data || [], medications.data || [], water.data || [], sleep.data || []);

    // Build significant events
    const significantEvents = buildSignificantEvents(healthEvents.data || [], symptoms.data || [], vitals.data || [], medications.data || []);

    // Build activities list
    const activities = buildActivities(vitals.data || [], medications.data || [], water.data || [], symptoms.data || []);

    const reportData = {
      summary: {
        bp: {
          avgSystolic,
          avgDiastolic,
          avgHeartRate,
          count: bpData.length,
          status: bpStatus,
        },
        meds: {
          adherencePercent,
          takenCount,
          totalCount: totalMeds,
          status: adherencePercent >= 90 ? 'good' : adherencePercent >= 70 ? 'fair' : 'poor',
        },
        water: {
          avgMl: avgWaterMl,
          daysRecorded: waterDays,
          status: avgWaterMl >= 1500 ? 'good' : avgWaterMl >= 1000 ? 'fair' : 'poor',
        },
        sleep: {
          avgHours: avgSleepHours,
          daysRecorded: sleepData.length,
          status: avgSleepHours >= 7 ? 'good' : avgSleepHours >= 5 ? 'fair' : 'poor',
        },
        activities: {
          total: activities.length,
          byType: activities.reduce((acc, a) => {
            acc[a.type] = (acc[a.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      },
      chartData,
      significantEvents,
      activities: activities.slice(0, 50), // Limit to 50 most recent
    };

    console.log(`[GET /reports/${patientId}] Summary: BP ${avgSystolic}/${avgDiastolic}, Meds ${adherencePercent}%, Water ${avgWaterMl}ml, Sleep ${avgSleepHours}h`);

    res.json(reportData);
  } catch (error: any) {
    console.error('Get report data error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get report data' });
  }
});

/**
 * Helper: Get BP status
 */
function getBpStatus(systolic: number, diastolic: number): 'normal' | 'elevated' | 'high' | 'crisis' {
  if (systolic >= 180 || diastolic >= 120) return 'crisis';
  if (systolic >= 140 || diastolic >= 90) return 'high';
  if (systolic >= 130 || diastolic >= 80) return 'elevated';
  return 'normal';
}

/**
 * Helper: Build chart data from raw data
 */
function buildChartData(startDate: Date, endDate: Date, vitals: any[], meds: any[], water: any[], sleep: any[]) {
  const days: any[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayFormatted = currentDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

    // Get vitals for this day
    const dayVitals = vitals.filter(v => v.measured_at?.startsWith(dateStr));
    const avgSystolic = dayVitals.length > 0
      ? Math.round(dayVitals.reduce((sum, v) => sum + (v.bp_systolic || 0), 0) / dayVitals.length)
      : undefined;
    const avgDiastolic = dayVitals.length > 0
      ? Math.round(dayVitals.reduce((sum, v) => sum + (v.bp_diastolic || 0), 0) / dayVitals.length)
      : undefined;
    const avgPulse = dayVitals.filter(v => v.heart_rate).length > 0
      ? Math.round(dayVitals.filter(v => v.heart_rate).reduce((sum, v) => sum + (v.heart_rate || 0), 0) / dayVitals.filter(v => v.heart_rate).length)
      : undefined;

    // Get meds for this day
    const dayMeds = meds.filter(m => m.taken_at?.startsWith(dateStr));
    const takenCount = dayMeds.filter(m => m.status === 'taken').length;
    const medsPercent = dayMeds.length > 0 ? Math.round((takenCount / dayMeds.length) * 100) : undefined;

    // Get water for this day
    const dayWater = water.filter(w => w.log_date === dateStr);
    const waterMl = dayWater.length > 0
      ? dayWater.reduce((sum, w) => sum + (w.amount_ml || 0), 0)
      : undefined;

    // Get sleep for this day
    const daySleep = sleep.find(s => s.sleep_date === dateStr);
    const sleepHours = daySleep?.sleep_hours || undefined;

    days.push({
      date: dateStr,
      day: dayFormatted,
      systolic: avgSystolic,
      diastolic: avgDiastolic,
      pulse: avgPulse,
      medsPercent,
      waterMl,
      sleepHours,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
}

/**
 * Helper: Build significant events
 */
function buildSignificantEvents(healthEvents: any[], symptoms: any[], vitals: any[], meds: any[]) {
  const events: any[] = [];

  // Add health events from database
  healthEvents.forEach(event => {
    events.push({
      date: new Date(event.event_timestamp).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      title: event.summary_text || `${event.event_type}: ${event.event_subtype || ''}`,
      tag: event.event_type === 'vitals' ? 'BP/HR' : event.event_type === 'medication' ? 'ยา' : 'อื่นๆ',
      type: event.event_type === 'vitals' ? 'health' : event.event_type === 'medication' ? 'meds' : 'symptom',
      timestamp: event.event_timestamp,
    });
  });

  // Add high BP readings
  vitals.filter(v => v.bp_systolic >= 140 || v.bp_diastolic >= 90).forEach(v => {
    events.push({
      date: new Date(v.measured_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      title: `ความดันสูงผิดปกติ (${v.bp_systolic}/${v.bp_diastolic})`,
      tag: 'BP/HR',
      type: 'health',
      timestamp: v.measured_at,
    });
  });

  // Add severe symptoms
  symptoms.filter(s => s.severity_1to5 >= 4).forEach(s => {
    events.push({
      date: new Date(s.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      title: `${s.symptom_name} ระดับ ${s.severity_1to5}`,
      tag: 'อาการ',
      type: 'symptom',
      timestamp: s.created_at,
    });
  });

  // Add missed medications
  meds.filter(m => m.status === 'skipped').forEach(m => {
    events.push({
      date: new Date(m.taken_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      title: `ลืมกินยา ${m.medication_name || ''}`,
      tag: 'ยา',
      type: 'meds',
      timestamp: m.taken_at,
    });
  });

  // Sort by timestamp descending and limit to 10
  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

/**
 * Helper: Build activities list
 */
function buildActivities(vitals: any[], meds: any[], water: any[], symptoms: any[]) {
  const activities: any[] = [];

  vitals.forEach(v => {
    activities.push({
      id: v.id,
      type: 'vitals',
      title: 'วัดความดัน',
      value: `${v.bp_systolic}/${v.bp_diastolic} mmHg${v.heart_rate ? `, ชีพจร ${v.heart_rate}` : ''}`,
      timestamp: v.measured_at,
      date: new Date(v.measured_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      time: new Date(v.measured_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    });
  });

  meds.forEach(m => {
    activities.push({
      id: m.id,
      type: 'medication',
      title: m.status === 'taken' ? 'กินยา' : 'ลืมกินยา',
      value: m.medication_name || m.dosage || '-',
      timestamp: m.taken_at,
      date: new Date(m.taken_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      time: new Date(m.taken_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    });
  });

  water.forEach(w => {
    activities.push({
      id: w.id,
      type: 'water',
      title: 'ดื่มน้ำ',
      value: `${w.amount_ml} มล.`,
      timestamp: w.logged_at,
      date: new Date(w.logged_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      time: new Date(w.logged_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    });
  });

  symptoms.forEach(s => {
    activities.push({
      id: s.id,
      type: 'symptom',
      title: 'บันทึกอาการ',
      value: `${s.symptom_name}${s.severity_1to5 ? ` (ระดับ ${s.severity_1to5})` : ''}`,
      timestamp: s.created_at,
      date: new Date(s.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      time: new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    });
  });

  // Sort by timestamp descending
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * GET /api/reports/download
 *
 * Download patient report in PDF or CSV format
 * Premium feature (Plus package only)
 *
 * Query Parameters:
 * - patientId: UUID of patient
 * - from: Start date (YYYY-MM-DD)
 * - to: End date (YYYY-MM-DD)
 * - format: 'pdf' or 'csv'
 *
 * Headers:
 * - x-group-id: Group ID for package verification
 */
router.get('/download', async (req: Request, res: Response) => {
  try {
    const { patientId, from, to, format } = req.query;
    const groupId = req.headers['x-group-id'] as string;

    // Validate required parameters
    if (!patientId || !from || !to || !format) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: patientId, from, to, format'
      });
    }

    // Validate format
    if (format !== 'pdf' && format !== 'csv') {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "pdf" or "csv"'
      });
    }

    // Check package access (Plus only)
    const hasAccess = await checkPlusAccess(groupId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'This feature is only available for Plus package',
        upgrade_url: '/settings#packages'
      });
    }

    // Validate date range
    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date must be before end date'
      });
    }

    // Limit to 90 days
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return res.status(400).json({
        success: false,
        error: 'Date range cannot exceed 90 days'
      });
    }

    // Fetch data
    const reportData = await fetchReportData(patientId as string, fromDate, toDate);

    // Log download to database
    await logDownload(groupId, patientId as string, fromDate, toDate, format as string);

    // Generate file based on format
    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(reportData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${patientId}-${from}-${to}.pdf"`);
      res.send(pdfBuffer);
    } else {
      const csvContent = await generateCSV(reportData);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="report-${patientId}-${from}-${to}.csv"`);
      res.send('\uFEFF' + csvContent); // BOM for Excel UTF-8 support
    }

  } catch (error: any) {
    console.error('Report download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate report'
    });
  }
});

/**
 * Check if group has Plus package access
 */
async function checkPlusAccess(groupId: string): Promise<boolean> {
  if (!groupId) return false;

  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_packages(*)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .single();

    if (error || !data) return false;

    // Check if Plus package
    return data.subscription_packages?.package_name === 'plus';
  } catch (error) {
    console.error('Package check error:', error);
    return false;
  }
}

/**
 * Fetch all activity data for report
 */
async function fetchReportData(patientId: string, fromDate: Date, toDate: Date) {
  const { data: activities, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('timestamp', fromDate.toISOString())
    .lte('timestamp', toDate.toISOString())
    .order('timestamp', { ascending: true });

  if (error) throw error;

  // Fetch patient info
  const { data: patient } = await supabase
    .from('patient_profiles')
    .select('*')
    .eq('id', patientId)
    .single();

  // Fetch medications
  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId);

  // Fetch water intake
  const { data: waterLogs } = await supabase
    .from('water_intake_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('logged_at', fromDate.toISOString())
    .lte('logged_at', toDate.toISOString());

  return {
    patient,
    activities: activities || [],
    medications: medications || [],
    waterLogs: waterLogs || [],
    dateRange: {
      from: fromDate,
      to: toDate
    }
  };
}

/**
 * Generate PDF report
 * Note: Requires 'pdfkit' or 'puppeteer'
 */
async function generatePDF(data: any): Promise<Buffer> {
  // TODO: Implement PDF generation
  // Option 1: Use PDFKit for simple reports
  // Option 2: Use Puppeteer to render HTML template as PDF

  // For now, return placeholder
  throw new Error('PDF generation not yet implemented. Please install pdfkit or puppeteer.');

  /*
  Example with PDFKit:

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add content
    doc.fontSize(20).text('รายงานสุขภาพ', { align: 'center' });
    doc.fontSize(12).text(`สมาชิก: ${data.patient?.first_name} ${data.patient?.last_name}`);
    doc.text(`ระยะเวลา: ${formatDate(data.dateRange.from)} - ${formatDate(data.dateRange.to)}`);

    // Add activities
    doc.moveDown();
    doc.fontSize(14).text('กิจกรรม:');
    data.activities.forEach(activity => {
      doc.fontSize(10).text(`${formatDate(activity.timestamp)} - ${activity.task_type}: ${activity.value}`);
    });

    doc.end();
  });
  */
}

/**
 * Generate CSV report
 */
async function generateCSV(data: any): Promise<string> {
  const rows: string[] = [];

  // Header
  rows.push('วันที่,เวลา,ประเภทกิจกรรม,ค่า,หมายเหตุ,ผู้บันทึก');

  // Activity rows
  data.activities.forEach((activity: any) => {
    const timestamp = new Date(activity.timestamp);
    const date = timestamp.toLocaleDateString('th-TH');
    const time = timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const row = [
      date,
      time,
      getTaskTypeLabel(activity.task_type),
      activity.value || '',
      activity.metadata?.notes || '',
      activity.actor_display_name || ''
    ].map(escapeCSV).join(',');

    rows.push(row);
  });

  // Add water intake section
  if (data.waterLogs && data.waterLogs.length > 0) {
    rows.push(''); // Empty row
    rows.push('=== ปริมาณน้ำที่ดื่ม ===');
    rows.push('วันที่,เวลา,ปริมาณ (ml),ผู้บันทึก');

    data.waterLogs.forEach((log: any) => {
      const timestamp = new Date(log.logged_at);
      const date = timestamp.toLocaleDateString('th-TH');
      const time = timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      const row = [
        date,
        time,
        log.amount_ml,
        log.logged_by_display_name || ''
      ].map(escapeCSV).join(',');

      rows.push(row);
    });
  }

  return rows.join('\n');
}

/**
 * Escape CSV values
 */
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Get Thai label for task type
 */
function getTaskTypeLabel(taskType: string): string {
  const labels: Record<string, string> = {
    medication: 'กินยา',
    vitals: 'วัดความดัน',
    water: 'ดื่มน้ำ',
    food: 'ทานอาหาร',
    exercise: 'ออกกำลังกาย'
  };
  return labels[taskType] || taskType;
}

/**
 * Log download to database
 */
async function logDownload(
  groupId: string,
  patientId: string,
  fromDate: Date,
  toDate: Date,
  format: string
): Promise<void> {
  try {
    await supabase
      .from('report_downloads')
      .insert([{
        group_id: groupId,
        patient_id: patientId,
        report_type: 'custom_range',
        date_from: fromDate.toISOString().split('T')[0],
        date_to: toDate.toISOString().split('T')[0],
        format: format
      }]);
  } catch (error) {
    console.error('Failed to log download:', error);
    // Don't throw - logging is not critical
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default router;
