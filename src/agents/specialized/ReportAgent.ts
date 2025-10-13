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
    const prompt = `Generate a daily health report in Thai:
    
Patient activities today:
- Medications taken: ${data.stats.medications}
- Vitals measured: ${data.stats.vitals}
- Water intake: ${data.stats.water} times
- Exercise: ${data.stats.exercise} times
- Meals: ${data.stats.meals}

Create a friendly, encouraging summary (100 words max).
Include:
1. Completion percentage
2. Key achievements
3. One suggestion for tomorrow`;

    const summary = await this.askClaude(prompt);
    
    return {
      date: new Date().toLocaleDateString('th-TH'),
      summary,
      stats: data.stats,
      completionRate: this.calculateCompletionRate(data.stats)
    };
  }

  private async generateWeeklyReport(data: any) {
    // Similar to daily but with trends
    const prompt = `Generate a weekly health trend analysis in Thai...`;
    const analysis = await this.askClaude(prompt);
    
    return {
      weekRange: `${data.startDate.toLocaleDateString('th-TH')} - ${data.endDate.toLocaleDateString('th-TH')}`,
      analysis,
      stats: data.stats,
      trends: this.calculateTrends(data.logs)
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
    // Create LINE Flex Message format
    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: '📊 รายงานประจำวัน',
          weight: 'bold',
          size: 'xl'
        }]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `ความสำเร็จ: ${report.completionRate}%`,
            size: 'lg',
            weight: 'bold'
          },
          {
            type: 'text',
            text: report.summary,
            wrap: true
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