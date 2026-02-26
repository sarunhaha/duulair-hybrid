// src/agents/specialized/AlertAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';
import { AGENT_MODELS } from '../../services/openrouter.service';
import { LineService } from '../../services/line.service';
import { groupService } from '../../services/group.service';

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
      ...AGENT_MODELS.alert,
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

      console.log(`🚨 AlertAgent processing: type=${alertType}, level=${level}, patientId=${message.context.patientId}`);

      if (level >= this.alertLevels.WARNING) {
        await this.sendAlert(message, level);
      }

      // Log alert to activity_logs (non-critical)
      try {
        await this.supabase.saveActivityLog({
          patient_id: message.context.patientId,
          task_type: 'alert',
          value: message.content,
          intent: `${alertType}:${level}`,
          timestamp: new Date(),
          source: message.context.source === 'group' ? 'group' : '1:1',
          group_id: message.context.groupId,
          actor_line_user_id: message.context.actorLineUserId,
          actor_display_name: message.context.actorDisplayName
        });
      } catch (saveError) {
        console.error('⚠️ Failed to save alert to database (non-critical):', saveError);
      }

      // Generate response message for user
      let responseText = '';
      if (alertType === 'emergency' || level >= this.alertLevels.CRITICAL) {
        responseText = `🆘 ได้รับแจ้งฉุกเฉินแล้วค่ะ!\n\n✅ กำลังแจ้งเตือนผู้ดูแลทุกคนในกลุ่ม\n⏰ เวลา: ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.\n\n📞 หากเป็นกรณีฉุกเฉินร้ายแรง กรุณาโทร 1669`;
      } else if (level >= this.alertLevels.WARNING) {
        responseText = `⚠️ บันทึกการแจ้งเตือนแล้วค่ะ\n\nได้แจ้งไปยังผู้ดูแลในกลุ่มแล้ว`;
      }

      console.log(`✅ AlertAgent response: ${responseText.substring(0, 50)}...`);

      return {
        success: true,
        data: {
          alerted: level >= this.alertLevels.WARNING,
          level,
          type: alertType,
          response: responseText
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ AlertAgent error:', error);
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
    try {
      const patient = await this.supabase.getPatient(message.context.patientId!);

      // Get caregiver group using groupService
      const groupInfo = await groupService.getGroupByPatientId(message.context.patientId!);

      if (!groupInfo) {
        this.log('warn', 'No caregiver group found for patient');
        return;
      }

      const group = groupInfo.group;
      const members = groupInfo.members || [];
      const alertMessage = this.formatAlertMessage(message, level, patient, group);

      this.log('info', `Sending alert level ${level} to ${members.length} members`);

      // Send based on level
      if (level >= this.alertLevels.CRITICAL) {
        // CRITICAL: Send to ALL caregivers in group immediately
        this.log('info', `Sending CRITICAL alert to ${members.length} caregivers`);

        for (const member of members) {
          try {
            await this.lineService.sendMessage(member.lineUserId, alertMessage);
            this.log('info', `Alert sent to ${member.displayName}`);
          } catch (err) {
            this.log('error', `Failed to send alert to ${member.displayName}`, err);
          }
        }

        // Also send to LINE group if exists
        if (group.lineGroupId) {
          try {
            await this.lineService.sendMessage(group.lineGroupId, alertMessage);
            this.log('info', 'Alert sent to LINE group');
          } catch (err) {
            this.log('error', 'Failed to send alert to LINE group', err);
          }
        }

      } else if (level >= this.alertLevels.URGENT) {
        // URGENT: Send to primary caregiver + group
        const primary = members.find((m: any) => m.role === 'primary');

        if (primary) {
          await this.lineService.sendMessage(primary.lineUserId, alertMessage);
        }

        if (group.lineGroupId) {
          await this.lineService.sendMessage(group.lineGroupId, alertMessage);
        }

      } else if (level >= this.alertLevels.WARNING) {
        // WARNING: Send to group only
        if (group.lineGroupId) {
          await this.lineService.sendMessage(group.lineGroupId, alertMessage);
        }
      }

    } catch (error) {
      this.log('error', 'Failed to send alert', error);
    }
  }

  private formatAlertMessage(message: Message, level: number, patient: any, group?: any): string {
    const icons = ['ℹ️', '⚠️', '🚨', '🆘'];
    const icon = icons[level - 1] || 'ℹ️';

    const patientName = patient.display_name || patient.full_name || 'สมาชิก';
    const groupName = group?.group_name || 'กลุ่มดูแล';

    // Format for caregiver audience
    let alertText = `${icon} แจ้งเตือนผู้ดูแล ${groupName}

📍 สมาชิก: ${patientName}
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

    alertText += `\n\n📊 ดูรายละเอียดเพิ่มเติมได้ที่เมนู "👤 ข้อมูลสมาชิก"`;

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