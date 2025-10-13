// src/agents/specialized/AlertAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';
import { LineService } from '../../services/line.service';

export class AlertAgent extends BaseAgent {
  private lineService: LineService;
  
  private alertLevels = {
    INFO: 1,
    WARNING: 2,
    URGENT: 3,
    CRITICAL: 4
  };

  constructor(config?: Partial<Config>) {
    super({
      name: 'alert',
      role: 'Monitor and send alerts',
      model: 'claude-3-haiku-20240307',
      temperature: 0.1,
      maxTokens: 500,
      ...config
    });

    this.lineService = new LineService();
  }

  async initialize(): Promise<boolean> {
    // Subscribe to real-time alerts
    this.supabase.subscribeToAlerts((payload) => {
      this.handleRealtimeAlert(payload);
    });
    
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();
    
    try {
      const alertType = message.metadata?.alertType || this.detectAlertType(message.content);
      const level = this.determineAlertLevel(alertType, message);
      
      if (level >= this.alertLevels.WARNING) {
        await this.sendAlert(message, level);
      }
      
      // Log alert
      await this.supabase.saveAlert({
        patient_id: message.context.patientId,
        alert_type: alertType,
        level,
        message: message.content,
        timestamp: new Date()
      });
      
      return {
        success: true,
        data: {
          alerted: level >= this.alertLevels.WARNING,
          level,
          type: alertType
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Alert processing failed',
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  private detectAlertType(content: string): string {
    const emergencyKeywords = ['ฉุกเฉิน', 'ช่วย', 'เจ็บ', 'ล้ม', 'หายใจไม่ออก'];
    const warningKeywords = ['ไม่สบาย', 'ปวด', 'เหนื่อย', 'มึน'];
    
    if (emergencyKeywords.some(kw => content.includes(kw))) {
      return 'emergency';
    }
    if (warningKeywords.some(kw => content.includes(kw))) {
      return 'warning';
    }
    
    return 'info';
  }

  private determineAlertLevel(type: string, message: Message): number {
    switch(type) {
      case 'emergency':
        return this.alertLevels.CRITICAL;
      case 'no_response':
        const hours = message.metadata?.hoursNoResponse || 0;
        if (hours > 8) return this.alertLevels.URGENT;
        if (hours > 4) return this.alertLevels.WARNING;
        return this.alertLevels.INFO;
      case 'abnormal_vitals':
        return this.alertLevels.WARNING;
      default:
        return this.alertLevels.INFO;
    }
  }

  private async sendAlert(message: Message, level: number) {
    const patient = await this.supabase.getPatient(message.context.patientId!);
    const caregivers = patient.caregivers || [];
    
    const alertMessage = this.formatAlertMessage(message, level, patient);
    
    // Send based on level
    if (level >= this.alertLevels.CRITICAL) {
      // Send to all caregivers immediately
      for (const caregiver of caregivers) {
        await this.lineService.sendMessage(caregiver.line_user_id, alertMessage);
      }
    } else if (level >= this.alertLevels.WARNING) {
      // Send to primary caregiver
      const primary = caregivers.find((c: any) => c.role === 'primary');
      if (primary) {
        await this.lineService.sendMessage(primary.line_user_id, alertMessage);
      }
    }
  }

  private formatAlertMessage(message: Message, level: number, patient: any): string {
    const icons = ['ℹ️', '⚠️', '🚨', '🆘'];
    const icon = icons[level - 1] || 'ℹ️';
    
    return `${icon} แจ้งเตือน ${patient.display_name}

${message.content}

เวลา: ${new Date().toLocaleTimeString('th-TH')}
ระดับ: ${this.getLevelName(level)}

กรุณาตรวจสอบด่วน`;
  }

  private getLevelName(level: number): string {
    const names = ['ข้อมูล', 'เตือน', 'เร่งด่วน', 'ฉุกเฉิน'];
    return names[level - 1] || 'ไม่ทราบ';
  }

  private async handleRealtimeAlert(payload: any) {
    // Handle real-time alert from Supabase
    this.log('info', 'Realtime alert received', payload);
    
    await this.process({
      id: payload.id,
      content: payload.message,
      context: {
        patientId: payload.patient_id,
        source: 'system',
        timestamp: new Date()
      },
      metadata: {
        alertType: payload.alert_type,
        realtime: true
      }
    });
  }

  getCapabilities(): string[] {
    return [
      'alert-monitoring',
      'emergency-detection',
      'caregiver-notification',
      'realtime-alerts'
    ];
  }
}