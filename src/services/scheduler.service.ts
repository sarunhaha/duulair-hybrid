// src/services/scheduler.service.ts
import cron from 'node-cron';
import { supabase } from './supabase.service';
import { LineService } from './line.service';
import { groupService } from './group.service';

class SchedulerService {
  private lineService: LineService;
  private isRunning: boolean = false;

  constructor() {
    this.lineService = new LineService();
  }

  /**
   * Start all cron jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⏰ Scheduler already running');
      return;
    }

    console.log('⏰ Starting Scheduler Service');

    // Run every minute to check for due reminders
    cron.schedule('* * * * *', async () => {
      await this.checkDueReminders();
    });

    // Run every hour to check for missed activities (no response alerts)
    cron.schedule('0 * * * *', async () => {
      await this.checkMissedActivities();
    });

    this.isRunning = true;
    console.log('✅ Scheduler Service started');
  }

  /**
   * Check for reminders due at current time and send notifications
   */
  private async checkDueReminders() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const dayName = this.getDayName(now);
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get all active reminders due at current time
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select(`
          *,
          patient_profiles(id, first_name, last_name, line_user_id)
        `)
        .eq('is_active', true)
        .eq('custom_time', currentTime);

      if (error || !reminders || reminders.length === 0) {
        return;
      }

      console.log(`⏰ Found ${reminders.length} reminders due at ${currentTime}`);

      for (const reminder of reminders) {
        // Check frequency
        if (reminder.frequency === 'specific_days' && reminder.days_of_week) {
          if (!reminder.days_of_week.includes(dayName)) {
            continue; // Skip if not on this day
          }
        }

        // Check if already sent today (prevent duplicates)
        const alreadySent = await this.checkIfAlreadySentToday(reminder.id, today);
        if (alreadySent) {
          console.log(`⏭️ Reminder ${reminder.id} already sent today, skipping`);
          continue;
        }

        await this.sendReminderNotification(reminder);
      }

    } catch (error) {
      console.error('❌ Error checking due reminders:', error);
    }
  }

  /**
   * Check if reminder was already sent today
   */
  private async checkIfAlreadySentToday(reminderId: string, today: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('reminder_id', reminderId)
        .gte('sent_at', `${today}T00:00:00`)
        .lte('sent_at', `${today}T23:59:59`)
        .limit(1);

      if (error) {
        // If table doesn't exist, allow sending
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send notification for a reminder
   */
  private async sendReminderNotification(reminder: any) {
    try {
      const patient = reminder.patient_profiles;
      if (!patient) {
        console.error('No patient found for reminder:', reminder.id);
        return;
      }

      const message = this.formatReminderMessage(reminder);

      // Get the group for this patient to notify caregivers
      const groupInfo = await groupService.getGroupByPatientId(patient.id);

      if (groupInfo && groupInfo.group.lineGroupId) {
        // Send to LINE group
        await this.lineService.sendMessage(groupInfo.group.lineGroupId, message);
        console.log(`✅ Reminder sent to group for patient ${patient.first_name}`);
      }

      // Also send to patient's LINE if they have it
      if (patient.line_user_id) {
        await this.lineService.sendMessage(patient.line_user_id, message);
        console.log(`✅ Reminder sent to patient ${patient.first_name}`);
      }

      // Log the sent reminder
      await supabase.from('reminder_logs').insert({
        reminder_id: reminder.id,
        patient_id: patient.id,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });

    } catch (error) {
      console.error('❌ Error sending reminder notification:', error);
    }
  }

  /**
   * Format reminder message
   */
  private formatReminderMessage(reminder: any): string {
    const patient = reminder.patient_profiles;
    const patientName = patient?.first_name || 'ผู้ป่วย';

    const typeEmojis: Record<string, string> = {
      medication: '💊',
      vitals: '🩺',
      water: '💧',
      exercise: '🏃',
      meal: '🍽️'
    };

    const typeNames: Record<string, string> = {
      medication: 'กินยา',
      vitals: 'วัดความดัน',
      water: 'ดื่มน้ำ',
      exercise: 'ออกกำลังกาย',
      meal: 'กินอาหาร'
    };

    const emoji = typeEmojis[reminder.reminder_type] || '🔔';
    const typeName = typeNames[reminder.reminder_type] || reminder.reminder_type;

    let message = `${emoji} แจ้งเตือน${typeName}\n\n`;
    message += `📍 ผู้ป่วย: ${patientName}\n`;
    message += `🕐 เวลา: ${reminder.custom_time} น.\n`;

    if (reminder.title) {
      message += `📝 ${reminder.title}\n`;
    }

    if (reminder.description) {
      message += `💬 ${reminder.description}\n`;
    }

    message += `\n✅ พิมพ์ "@oonjai ${this.getConfirmCommand(reminder.reminder_type)}" เพื่อบันทึก`;

    return message;
  }

  /**
   * Get confirm command based on reminder type
   */
  private getConfirmCommand(type: string): string {
    const commands: Record<string, string> = {
      medication: 'กินยาแล้ว',
      vitals: 'ความดัน [ค่า]',
      water: 'ดื่มน้ำแล้ว',
      exercise: 'ออกกำลังกายแล้ว',
      meal: 'กินข้าวแล้ว'
    };
    return commands[type] || 'บันทึกแล้ว';
  }

  /**
   * Check for missed activities and send alerts
   */
  private async checkMissedActivities() {
    try {
      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

      // Get patients with no activity in the last 4 hours
      const { data: patients, error } = await supabase
        .from('patient_profiles')
        .select('id, first_name, last_name, line_user_id');

      if (error || !patients) {
        return;
      }

      for (const patient of patients) {
        // Check last activity
        const { data: lastActivity } = await supabase
          .from('activity_logs')
          .select('timestamp')
          .eq('patient_id', patient.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (lastActivity) {
          const lastActivityTime = new Date(lastActivity.timestamp);

          if (lastActivityTime < fourHoursAgo) {
            // No activity in 4 hours - send warning to group
            const groupInfo = await groupService.getGroupByPatientId(patient.id);

            if (groupInfo && groupInfo.group.lineGroupId) {
              const message = `⚠️ แจ้งเตือน\n\nไม่พบกิจกรรมของ ${patient.first_name} มากกว่า 4 ชั่วโมงแล้ว\n\nกรุณาตรวจสอบสถานะผู้ป่วยค่ะ`;

              await this.lineService.sendMessage(groupInfo.group.lineGroupId, message);
              console.log(`⚠️ No activity alert sent for patient ${patient.first_name}`);
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Error checking missed activities:', error);
    }
  }

  /**
   * Get day name in English
   */
  private getDayName(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }
}

export const schedulerService = new SchedulerService();
