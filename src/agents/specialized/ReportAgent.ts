// src/agents/specialized/ReportAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';
import { reportService } from '../../services/report.service';

const LIFF_ID = process.env.LIFF_ID || '2008278683-5k69jxNq';

export class ReportAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'report',
      role: 'Generate daily, weekly, and monthly reports',
      model: 'claude-3-sonnet-20240229',  // ใช้ sonnet เพราะต้องการ creativity
      temperature: 0.7,
      maxTokens: 2000,
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Report Agent initialized');
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();

    try {
      // Check if this is a report menu request (no patientId needed)
      const intent = message.metadata?.intent;
      if (intent === 'report_menu') {
        const menuFlexMessage = this.createReportMenuFlexMessage();
        return {
          success: true,
          data: {
            flexMessage: menuFlexMessage,
            flexMessageType: 'report_menu'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // For actual report generation, patientId is required
      const patientId = message.context.patientId || message.metadata?.patientData?.id;
      if (!patientId) {
        // No patientId - inform user to register first
        this.log('warn', 'No patientId available');
        return {
          success: true,
          data: {
            response: 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อนใช้งานค่ะ 📝',
            reportText: 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อนใช้งานค่ะ 📝'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      const reportType = message.metadata?.reportType || 'daily';

      // Use enhanced reportService for all report types
      let reportText: string;
      let reportData: any;

      try {
        if (reportType === 'daily') {
          reportData = await reportService.generateDailyReport(patientId);
          reportText = reportService.formatDailyReportText(reportData);
        } else if (reportType === 'weekly') {
          reportData = await reportService.generateWeeklyReport(patientId);
          reportText = reportService.formatWeeklyReportText(reportData);
        } else if (reportType === 'monthly') {
          reportData = await reportService.generateMonthlyReport(patientId);
          reportText = reportService.formatMonthlyReportText(reportData);
        } else {
          // Default to daily
          reportData = await reportService.generateDailyReport(patientId);
          reportText = reportService.formatDailyReportText(reportData);
        }

        // Check if report has any data
        const hasData = this.checkReportHasData(reportData, reportType);
        if (!hasData) {
          const noDataText = this.getNoDataMessage(reportType);
          return {
            success: true,
            data: {
              response: noDataText,
              reportText: noDataText,
              reportType,
              hasData: false
            },
            agentName: this.config.name,
            processingTime: Date.now() - startTime
          };
        }

        return {
          success: true,
          data: {
            report: reportData,
            reportText,
            response: reportText,
            reportType,
            hasData: true
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      } catch (error) {
        this.log('error', 'Error generating report', error);
        return {
          success: true,
          data: {
            response: 'ขออภัยค่ะ ไม่สามารถสร้างรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ',
            reportText: 'ขออภัยค่ะ ไม่สามารถสร้างรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed',
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  private async fetchReportData(patientId: string, type: string) {
    // Get from Supabase
    const endDate = new Date();
    const startDate = new Date();

    if (type === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }

    const logs = await this.supabase.getActivityLogs(patientId, startDate, endDate);

    // Get planned activities
    const medications = await this.supabase.getPatientMedications(patientId);
    // Get water goal from health_goals table
    const healthGoals = await this.supabase.getHealthGoals(patientId);
    // Get water logs from activity_logs (task_type = 'water')
    const waterLogs = logs.filter((l: any) => l.task_type === 'water');

    // Calculate detailed stats
    const medicationLogs = logs.filter((l: any) => l.task_type === 'medication');
    const vitalsLogs = logs.filter((l: any) => l.task_type === 'vitals');

    // Build medication status
    const medicationStatus = this.buildMedicationStatus(medications, medicationLogs);

    // Build water status (using health_goals for target)
    const waterStatus = this.buildWaterStatus(healthGoals, waterLogs);

    // Build vitals status
    const vitalsStatus = this.buildVitalsStatus(vitalsLogs);

    // Calculate statistics
    const stats = {
      totalActivities: logs.length,
      medications: medicationLogs.length,
      vitals: vitalsLogs.length,
      water: waterLogs.length,
      exercise: logs.filter((l: any) => l.task_type === 'walk').length,
      meals: logs.filter((l: any) => l.task_type === 'food').length
    };

    return {
      logs,
      stats,
      patientId,
      startDate,
      endDate,
      medicationStatus,
      waterStatus,
      vitalsStatus,
      medications,
      healthGoals
    };
  }

  private buildMedicationStatus(medications: any[], logs: any[]) {
    const status: any[] = [];
    const today = new Date();
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];

    for (const med of medications) {
      if (!med.is_active) continue;

      // Check if medication should be taken today
      const frequency = med.frequency || [];
      const daysOfWeek = med.days_of_week || null;

      // Determine times to take
      let times: string[] = [];
      if (frequency.includes('เช้า') || frequency.includes('morning')) times.push('เช้า');
      if (frequency.includes('กลางวัน') || frequency.includes('noon')) times.push('กลางวัน');
      if (frequency.includes('เย็น') || frequency.includes('evening')) times.push('เย็น');
      if (frequency.includes('ก่อนนอน') || frequency.includes('bedtime')) times.push('ก่อนนอน');

      if (times.length === 0) times = ['วันละครั้ง'];

      for (const time of times) {
        // Check if this dose was taken
        const taken = logs.find((log: any) => {
          const logMedName = log.value || log.metadata?.medication_name || '';
          return logMedName.toLowerCase().includes(med.name.toLowerCase());
        });

        status.push({
          name: med.name,
          dosage: med.dosage,
          time,
          done: !!taken,
          takenAt: taken ? new Date(taken.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : null
        });
      }
    }

    return status;
  }

  private buildWaterStatus(healthGoals: any, logs: any[]) {
    const targetMl = healthGoals?.target_water_ml || 2000;
    // Water logs from activity_logs have amount in metadata or value
    const totalDrunk = logs.reduce((sum: number, log: any) => {
      const amount = log.metadata?.amount_ml || parseInt(log.value) || 0;
      return sum + amount;
    }, 0);

    const details = logs.map((log: any) => ({
      amount: log.metadata?.amount_ml || parseInt(log.value) || 0,
      time: new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      loggedBy: log.actor_display_name || 'ไม่ระบุ'
    }));

    return {
      target: targetMl,
      current: totalDrunk,
      remaining: Math.max(0, targetMl - totalDrunk),
      percentage: Math.min(100, Math.round((totalDrunk / targetMl) * 100)),
      details
    };
  }

  private buildVitalsStatus(logs: any[]) {
    const vitals: any[] = [];

    for (const log of logs) {
      const metadata = log.metadata || {};
      vitals.push({
        type: metadata.vital_type || 'ความดัน',
        value: log.value || `${metadata.systolic}/${metadata.diastolic}`,
        time: new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        loggedBy: log.actor_display_name || 'ไม่ระบุ'
      });
    }

    return vitals;
  }

  private async generateDailyReport(data: any) {
    const prompt = `Generate a daily care report in Thai for CAREGIVERS monitoring their loved one's health.

TARGET AUDIENCE: Family caregivers (children, grandchildren managing elderly parent/grandparent)
TONE: Professional, clear, actionable

Patient activities today:
- Medications taken: ${data.stats.medications}
- Vitals measured: ${data.stats.vitals}
- Water intake: ${data.stats.water} times
- Exercise: ${data.stats.exercise} times
- Meals logged: ${data.stats.meals}

Create a clear, informative summary (100 words max) for caregivers.
Include:
1. Completion percentage (compare to expected daily activities)
2. Key observations (what went well, what was missed)
3. One actionable suggestion for caregivers
4. Use อ้างอิง "คุณ" for patient, "คุณ/ท่าน" for caregiver

Example format:
"คุณแม่มีการดูแลสุขภาพที่ดีวันนี้ ครบ X% ของกิจกรรมที่วางไว้ โดยเฉพาะ...
สิ่งที่ควรติดตาม...
คำแนะนำสำหรับวันพรุ่งนี้..."`;

    const summary = await this.askClaude(prompt);

    return {
      date: new Date().toLocaleDateString('th-TH'),
      summary,
      stats: data.stats,
      completionRate: this.calculateCompletionRate(data.stats),
      targetAudience: 'caregivers',
      medicationStatus: data.medicationStatus,
      waterStatus: data.waterStatus,
      vitalsStatus: data.vitalsStatus
    };
  }

  private async generateWeeklyReport(data: any) {
    const prompt = `Generate a weekly care trend report in Thai for CAREGIVERS.

TARGET AUDIENCE: Family caregivers managing elderly patient care
TONE: Professional, analytical, supportive

Weekly summary (7 days):
- Total activities logged: ${data.stats.totalActivities}
- Medications: ${data.stats.medications}
- Vitals checks: ${data.stats.vitals}
- Water intake: ${data.stats.water}
- Exercise: ${data.stats.exercise}
- Meals: ${data.stats.meals}

Create a comprehensive weekly analysis (150 words max):
1. Overall trend (improving/stable/declining)
2. Consistency analysis (which activities were consistent vs inconsistent)
3. Notable achievements or concerns
4. 2-3 specific recommendations for next week
5. Encourage caregiver team collaboration

Example format:
"สรุปการดูแลสุขภาพสัปดาห์นี้:
แนวโน้มโดยรวม...
ความสม่ำเสมอ...
ข้อสังเกต...
คำแนะนำสำหรับสัปดาห์หน้า...
ขอบคุณทีมผู้ดูแลทุกท่านที่ช่วยกันบันทึกข้อมูล"`;

    const analysis = await this.askClaude(prompt);

    return {
      weekRange: `${data.startDate.toLocaleDateString('th-TH')} - ${data.endDate.toLocaleDateString('th-TH')}`,
      analysis,
      stats: data.stats,
      trends: this.calculateTrends(data.logs),
      targetAudience: 'caregivers',
      completionRate: this.calculateCompletionRate(data.stats),
      medicationStatus: data.medicationStatus,
      waterStatus: data.waterStatus,
      vitalsStatus: data.vitalsStatus
    };
  }

  private calculateCompletionRate(stats: any): number {
    const expected = 10; // Expected activities per day
    const actual = Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number;
    return Math.min(100, Math.round((actual / expected) * 100));
  }

  private calculateTrends(logs: any[]): any {
    // วิเคราะห์แนวโน้ม
    return {
      improving: [],
      declining: [],
      stable: []
    };
  }

  // OONJAI Design System colors (matching LIFF theme)
  private static OONJAI = {
    primary: '#0FA968',
    text: '#3B4C63',
    textMuted: '#7B8DA0',
    border: '#E2E8F0',
    card: '#FFFFFF',
    bg: '#F5F7FA',
    medAccent: '#A855F7',
    waterAccent: '#3B82F6',
    vitalsAccent: '#EF4444',
    successText: '#0FA968',
  };

  private formatFlexMessage(report: any) {
    const O = ReportAgent.OONJAI;
    const isWeekly = report.weekRange !== undefined;

    // Build medication section
    const medicationContents: any[] = [];
    if (report.medicationStatus && report.medicationStatus.length > 0) {
      const done = report.medicationStatus.filter((m: any) => m.done).length;
      const total = report.medicationStatus.length;

      medicationContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'box', layout: 'vertical', contents: [], width: '10px', height: '10px', backgroundColor: O.medAccent, cornerRadius: '50px', flex: 0 },
          { type: 'text', text: `ยา (${done}/${total})`, weight: 'bold', size: 'sm', color: O.text, margin: 'md' },
        ],
        alignItems: 'center',
      });

      for (const med of report.medicationStatus.slice(0, 5)) {
        medicationContents.push({
          type: 'text',
          text: med.done
            ? `✓ ${med.name} ${med.dosage || ''} — ${med.takenAt}`
            : `· ${med.name} ${med.dosage || ''} (${med.time})`,
          size: 'xs',
          color: med.done ? O.successText : O.textMuted,
          margin: 'sm',
          wrap: true,
        });
      }
    }

    // Build water section
    const waterContents: any[] = [];
    if (report.waterStatus) {
      waterContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'box', layout: 'vertical', contents: [], width: '10px', height: '10px', backgroundColor: O.waterAccent, cornerRadius: '50px', flex: 0 },
          { type: 'text', text: `น้ำ (${report.waterStatus.current}/${report.waterStatus.target} ml)`, weight: 'bold', size: 'sm', color: O.text, margin: 'md' },
        ],
        alignItems: 'center',
        margin: 'xl',
      });

      if (report.waterStatus.details && report.waterStatus.details.length > 0) {
        for (const log of report.waterStatus.details.slice(0, 3)) {
          waterContents.push({
            type: 'text',
            text: `✓ ${log.amount}ml — ${log.time}`,
            size: 'xs',
            color: O.successText,
            margin: 'sm',
          });
        }
      }

      if (report.waterStatus.remaining > 0) {
        waterContents.push({
          type: 'text',
          text: `· เหลืออีก ${report.waterStatus.remaining}ml`,
          size: 'xs',
          color: O.textMuted,
          margin: 'sm',
        });
      }
    }

    // Build vitals section
    const vitalsContents: any[] = [];
    if (report.vitalsStatus && report.vitalsStatus.length > 0) {
      vitalsContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'box', layout: 'vertical', contents: [], width: '10px', height: '10px', backgroundColor: O.vitalsAccent, cornerRadius: '50px', flex: 0 },
          { type: 'text', text: `วัดค่าสุขภาพ (${report.vitalsStatus.length})`, weight: 'bold', size: 'sm', color: O.text, margin: 'md' },
        ],
        alignItems: 'center',
        margin: 'xl',
      });

      for (const vital of report.vitalsStatus.slice(0, 3)) {
        vitalsContents.push({
          type: 'text',
          text: `✓ ${vital.type} ${vital.value} — ${vital.time}`,
          size: 'xs',
          color: O.successText,
          margin: 'sm',
        });
      }
    }

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: O.primary,
        paddingAll: 'xl',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'box', layout: 'vertical', contents: [], width: '10px', height: '10px', backgroundColor: '#FFFFFF', cornerRadius: '50px', flex: 0 },
              { type: 'text', text: 'อุ่นใจ', size: 'xs', color: '#FFFFFF', margin: 'sm', weight: 'bold', flex: 0 },
              { type: 'text', text: isWeekly ? 'รายงานสัปดาห์' : 'รายงานประจำวัน', size: 'xs', color: '#FFFFFFB3', margin: 'md' },
            ],
            alignItems: 'center',
          },
          {
            type: 'text',
            text: isWeekly ? report.weekRange : report.date,
            size: 'lg',
            weight: 'bold',
            color: '#ffffff',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'ความสำเร็จ', size: 'sm', color: '#FFFFFFB3' },
              { type: 'text', text: `${report.completionRate}%`, size: 'xl', weight: 'bold', color: '#ffffff', align: 'end' },
            ],
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'xl',
        backgroundColor: O.card,
        contents: [
          ...medicationContents,
          ...waterContents,
          ...vitalsContents,
          { type: 'separator', margin: 'xl', color: O.border },
          {
            type: 'text',
            text: report.summary || report.analysis || '',
            wrap: true,
            size: 'xs',
            margin: 'lg',
            color: O.textMuted,
          },
        ],
      },
    };
  }

  private createReportMenuFlexMessage() {
    const O = ReportAgent.OONJAI;

    // Reusable menu row
    const menuRow = (dotColor: string, title: string, subtitle: string, action: any) => ({
      type: 'box',
      layout: 'vertical',
      backgroundColor: O.bg,
      cornerRadius: 'lg',
      paddingAll: 'lg',
      action,
      contents: [{
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'box', layout: 'vertical', contents: [], width: '10px', height: '10px', backgroundColor: dotColor, cornerRadius: '50px', flex: 0 },
          {
            type: 'box', layout: 'vertical', margin: 'lg', flex: 1,
            contents: [
              { type: 'text', text: title, weight: 'bold', size: 'md', color: O.text },
              { type: 'text', text: subtitle, size: 'xs', color: O.textMuted, margin: 'xs' },
            ],
          },
          { type: 'text', text: '›', size: 'xl', color: O.border, flex: 0, gravity: 'center' },
        ],
        alignItems: 'center',
      }],
    });

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: O.primary,
        paddingAll: 'xl',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'box', layout: 'vertical', contents: [], width: '10px', height: '10px', backgroundColor: '#FFFFFF', cornerRadius: '50px', flex: 0 },
              { type: 'text', text: 'อุ่นใจ', size: 'xs', color: '#FFFFFF', margin: 'sm', weight: 'bold', flex: 0 },
            ],
            alignItems: 'center',
          },
          { type: 'text', text: 'เลือกประเภทรายงาน', weight: 'bold', size: 'xl', color: '#ffffff', margin: 'md' },
          { type: 'text', text: 'ดูสรุปกิจกรรมสุขภาพของคุณ', size: 'sm', color: '#FFFFFFB3', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        backgroundColor: O.card,
        contents: [
          menuRow(O.primary, 'รายงานวันนี้', 'ดูสรุปกิจกรรมประจำวันนี้', { type: 'message', label: 'รายงานวันนี้', text: 'รายงานวันนี้' }),
          menuRow(O.primary, 'รายงานสัปดาห์', 'ดูสรุปกิจกรรม 7 วันย้อนหลัง', { type: 'message', label: 'รายงานสัปดาห์', text: 'รายงานสัปดาห์' }),
          menuRow(O.primary, 'รายงานเดือน', 'ดูสรุปกิจกรรม 30 วันย้อนหลัง', { type: 'message', label: 'รายงานเดือน', text: 'รายงานเดือน' }),
          { type: 'separator', margin: 'md', color: O.border },
          menuRow(O.waterAccent, 'รายงานพร้อมกราฟ', 'ดูกราฟ เลือกช่วงเวลา และส่งออก', { type: 'uri', label: 'รายงานพร้อมกราฟ', uri: `https://liff.line.me/${LIFF_ID}/reports` }),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: O.bg,
        paddingAll: 'md',
        contents: [
          { type: 'text', text: 'เลือกรายงานแบบข้อความ หรือ เปิดรายงานพร้อมกราฟ', size: 'xxs', color: O.textMuted, align: 'center', wrap: true },
        ],
      },
    };
  }

  /**
   * Check if report has any actual data
   */
  private checkReportHasData(reportData: any, reportType: string): boolean {
    if (!reportData) return false;

    if (reportType === 'daily') {
      const summary = reportData.summary;
      if (!summary) return false;
      // Check if any activity was recorded
      return (
        (summary.medication?.count || 0) > 0 ||
        (summary.vitals?.count || 0) > 0 ||
        (summary.water?.totalMl || 0) > 0 ||
        (summary.food?.count || 0) > 0 ||
        (summary.exercise?.count || 0) > 0 ||
        (reportData.activities?.length || 0) > 0
      );
    } else if (reportType === 'weekly') {
      const weekTotal = reportData.weekTotal;
      if (!weekTotal) return false;
      return (
        (weekTotal.medication?.count || 0) > 0 ||
        (weekTotal.vitals?.count || 0) > 0 ||
        (weekTotal.water?.totalMl || 0) > 0 ||
        (weekTotal.food?.count || 0) > 0 ||
        (weekTotal.exercise?.count || 0) > 0
      );
    } else if (reportType === 'monthly') {
      const monthTotal = reportData.monthTotal;
      if (!monthTotal) return false;
      return (
        (monthTotal.medication?.count || 0) > 0 ||
        (monthTotal.vitals?.count || 0) > 0 ||
        (monthTotal.water?.totalMl || 0) > 0 ||
        (monthTotal.food?.count || 0) > 0 ||
        (monthTotal.exercise?.count || 0) > 0 ||
        (reportData.activeDays || 0) > 0
      );
    }

    return false;
  }

  /**
   * Get appropriate no-data message based on report type
   */
  private getNoDataMessage(reportType: string): string {
    const today = new Date().toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (reportType === 'daily') {
      return `📊 รายงานประจำวัน\n📅 ${today}\n\n📝 ยังไม่มีกิจกรรมที่บันทึกในวันนี้ค่ะ\n\n💡 เริ่มบันทึกสุขภาพได้เลย:\n• พิมพ์ "กินยาแล้ว"\n• พิมพ์ "ความดัน 120/80"\n• พิมพ์ "ดื่มน้ำ"\n\nหรือเข้าเมนู "บันทึกสุขภาพ" ค่ะ 💚`;
    } else if (reportType === 'weekly') {
      return `📊 รายงานสัปดาห์\n\n📝 ยังไม่มีกิจกรรมที่บันทึกในช่วง 7 วันที่ผ่านมาค่ะ\n\n💡 เริ่มบันทึกสุขภาพวันนี้ได้เลย:\n• พิมพ์ "กินยาแล้ว"\n• พิมพ์ "ความดัน 120/80"\n• พิมพ์ "ดื่มน้ำ"\n\nหรือเข้าเมนู "บันทึกสุขภาพ" ค่ะ 💚`;
    } else if (reportType === 'monthly') {
      return `📊 รายงานเดือนนี้\n\n📝 ยังไม่มีกิจกรรมที่บันทึกในเดือนนี้ค่ะ\n\n💡 เริ่มบันทึกสุขภาพวันนี้ได้เลย:\n• พิมพ์ "กินยาแล้ว"\n• พิมพ์ "ความดัน 120/80"\n• พิมพ์ "ดื่มน้ำ"\n\nหรือเข้าเมนู "บันทึกสุขภาพ" ค่ะ 💚`;
    }

    return '📊 ยังไม่มีข้อมูลกิจกรรมค่ะ';
  }

  getCapabilities(): string[] {
    return [
      'report-generation',
      'data-analysis',
      'trend-detection',
      'flex-message-formatting'
    ];
  }
}