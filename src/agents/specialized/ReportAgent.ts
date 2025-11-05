// src/agents/specialized/ReportAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';

export class ReportAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'report',
      role: 'Generate daily and weekly reports',
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
      const patientId = message.context.patientId;
      if (!patientId) {
        throw new Error('Patient ID required for report generation');
      }

      const reportType = message.metadata?.reportType || 'daily';

      // Get data from database
      const data = await this.fetchReportData(patientId, reportType);
      
      // Generate report
      let report;
      if (reportType === 'daily') {
        report = await this.generateDailyReport(data);
      } else {
        report = await this.generateWeeklyReport(data);
      }

      // Format for LINE Flex Message
      const flexMessage = this.formatFlexMessage(report);
      
      return {
        success: true,
        data: {
          report,
          flexMessage,
          stats: data.stats
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
      
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
    
    // Calculate statistics
    const stats = {
      totalActivities: logs.length,
      medications: logs.filter((l: any) => l.task_type === 'medication').length,
      vitals: logs.filter((l: any) => l.task_type === 'vitals').length,
      water: logs.filter((l: any) => l.task_type === 'water').length,
      exercise: logs.filter((l: any) => l.task_type === 'walk').length,
      meals: logs.filter((l: any) => l.task_type === 'food').length
    };

    return { logs, stats, patientId, startDate, endDate };
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
      targetAudience: 'caregivers'
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
      targetAudience: 'caregivers'
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

  private formatFlexMessage(report: any) {
    // Create LINE Flex Message format for caregiver group
    const isWeekly = report.weekRange !== undefined;

    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#667eea',
        contents: [{
          type: 'text',
          text: isWeekly ? '📊 รายงานสัปดาห์' : '📊 รายงานประจำวัน',
          weight: 'bold',
          size: 'xl',
          color: '#ffffff'
        },
        {
          type: 'text',
          text: isWeekly ? report.weekRange : report.date,
          size: 'sm',
          color: '#ffffff',
          margin: 'sm'
        }]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '✅ ความสำเร็จ',
                flex: 0,
                size: 'sm',
                color: '#666666'
              },
              {
                type: 'text',
                text: `${report.completionRate}%`,
                size: 'lg',
                weight: 'bold',
                color: '#667eea',
                align: 'end'
              }
            ],
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: report.summary || report.analysis,
            wrap: true,
            size: 'sm',
            margin: 'md',
            color: '#333333'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💡 ดูรายละเอียดเพิ่มเติมได้ที่เมนู "📊 รายงาน"',
            size: 'xs',
            color: '#999999',
            wrap: true,
            align: 'center'
          }
        ]
      }
    };
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