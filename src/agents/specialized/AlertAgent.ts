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

    // Get caregiver group (Group-Based Care Model)
    const group = await this.supabase.getGroupByPatientId(message.context.patientId!);
    if (!group) {
      this.log('warn', 'No caregiver group found for patient');
      return;
    }

    const caregivers = group.members || [];
    const alertMessage = this.formatAlertMessage(message, level, patient, group);

    // Send based on level and group settings
    if (level >= this.alertLevels.CRITICAL) {
      // CRITICAL: Send to ALL caregivers in group immediately
      this.log('info', `Sending CRITICAL alert to ${caregivers.length} caregivers`);

      for (const caregiver of caregivers) {
        await this.lineService.sendMessage(caregiver.line_user_id, alertMessage);
      }

      // Also send to LINE group if exists
      if (group.line_group_id) {
        await this.lineService.sendMessage(group.line_group_id, alertMessage);
      }

    } else if (level >= this.alertLevels.URGENT) {
      // URGENT: Send to primary caregiver + group
      const primary = caregivers.find((c: any) => c.role === 'primary');

      if (primary) {
        await this.lineService.sendMessage(primary.line_user_id, alertMessage);
      }

      if (group.line_group_id) {
        await this.lineService.sendMessage(group.line_group_id, alertMessage);
      }

    } else if (level >= this.alertLevels.WARNING) {
      // WARNING: Send to group only (if group notifications enabled)
      const settings = group.settings || {};

      if (settings.emergency_notifications !== false && group.line_group_id) {
        await this.lineService.sendMessage(group.line_group_id, alertMessage);
      }
    }
  }

  private formatAlertMessage(message: Message, level: number, patient: any, group?: any): string {
    const icons = ['ℹ️', '⚠️', '🚨', '🆘'];
    const icon = icons[level - 1] || 'ℹ️';

    const patientName = patient.display_name || patient.full_name || 'ผู้ป่วย';
    const groupName = group?.group_name || 'กลุ่มดูแล';

    // Format for caregiver audience
    let alertText = `${icon} แจ้งเตือนผู้ดูแล ${groupName}

📍 ผู้ป่วย: ${patientName}
🕐 เวลา: ${new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    })} น.
⚠️ ระดับ: ${this.getLevelName(level)}

📝 รายละเอียด:
${message.content}`;

    // Add action recommendations based on level
    if (level >= this.alertLevels.CRITICAL) {
      alertText += `\n\n🚨 โปรดตรวจสอบทันที หรือติดต่อแพทย์/โรงพยาบาล`;
    } else if (level >= this.alertLevels.URGENT) {
      alertText += `\n\n⚡ โปรดตรวจสอบโดยเร็วที่สุด`;
    } else if (level >= this.alertLevels.WARNING) {
      alertText += `\n\n💡 โปรดติดตามอาการต่อไป`;
    }

    alertText += `\n\n📊 ดูรายละเอียดเพิ่มเติมได้ที่เมนู "👤 ข้อมูลผู้ป่วย"`;

    return alertText;
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