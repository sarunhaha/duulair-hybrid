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
