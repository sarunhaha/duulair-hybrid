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
   *
   * DISABLED: All reminder notifications are now handled by Supabase Edge Functions + pg_cron
   * This prevents duplicate notifications from running both systems simultaneously.
   *
   * See: supabase/functions/send-reminders/index.ts
   * See: docs/migrations/008_setup_pg_cron_reminders.sql
   */
  start() {
    // DISABLED: Use Supabase Edge Functions + pg_cron for ALL environments
    // This prevents duplicate notifications when both systems are active
    console.log('⏰ Scheduler: DISABLED - Using Supabase Edge Functions + pg_cron for reminders');
    console.log('   If you need local scheduling, enable pg_cron trigger in Supabase Dashboard');
    return;

    // ==================== DISABLED CODE BELOW ====================
    // Uncomment only if Supabase Edge Functions are not available
    /*
    // Skip on Vercel - use Supabase Edge Functions + pg_cron instead
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      console.log('⏰ Scheduler: Skipping node-cron on Vercel (use Supabase Edge Functions + pg_cron)');
      return;
    }

    if (this.isRunning) {
      console.log('⏰ Scheduler already running');
      return;
    }

    console.log('⏰ Starting Scheduler Service (node-cron for local development)');

    // Run every minute to check for due reminders
    cron.schedule('* * * * *', async () => {
      await this.checkDueReminders();
    });

    // Run every hour to check for missed activities (no response alerts)
    cron.schedule('0 * * * *', async () => {
      await this.checkMissedActivities();
    });

    this.isRunning = true;
    console.log('✅ Scheduler Service started (local mode)');
    */
  }

  /**
   * Check for reminders due at current time and send notifications
   */
  private async checkDueReminders() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
      const dayName = this.getDayName(now);
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

      console.log(`⏰ [Scheduler] Checking reminders at ${currentTime}`);

      // Get all active reminders due at current time
      // Include medication info if medication_id is set
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select(`
          *,
          patient_profiles(
            id,
            first_name,
            last_name,
            user_id,
            users(line_user_id)
          ),
          medications(
            id,
            name,
            dosage,
            dosage_amount,
            dosage_unit
          )
        `)
        .eq('is_active', true)
        .eq('time', currentTime);

      if (error) {
        console.error('❌ [Scheduler] Error fetching reminders:', error);
        return;
      }

      if (!reminders || reminders.length === 0) {
        // Don't log every minute, it's too noisy
        return;
      }

      console.log(`⏰ [Scheduler] Found ${reminders.length} reminders due at ${currentTime}`);

      for (const reminder of reminders) {
        // Check frequency
        if (reminder.frequency === 'specific_days' && reminder.days_of_week) {
          if (!reminder.days_of_week.includes(dayName)) {
            continue; // Skip if not on this day
          }
        }

        // Check if already sent for this time window (±30min around reminder time).
        // This allows re-sending if user changes the reminder time after it was sent.
        const alreadySent = await this.checkIfAlreadySentForTime(reminder.id, reminder.time, today);
        if (alreadySent) {
          console.log(`⏭️ Reminder ${reminder.id} already sent for time ${reminder.time}, skipping`);
          continue;
        }

        await this.sendReminderNotification(reminder);
      }

    } catch (error) {
      console.error('❌ Error checking due reminders:', error);
    }
  }

  /**
   * Check if reminder was already sent within ±30min of its scheduled time today.
   * This prevents duplicates while allowing re-sends when the user changes the time.
   */
  private async checkIfAlreadySentForTime(reminderId: string, reminderTime: string, today: string): Promise<boolean> {
    try {
      const [h, m] = reminderTime.split(':').map(Number);

      // Build ±30min window in Bangkok time then format as ISO for query
      const windowStart = new Date(`${today}T00:00:00+07:00`);
      windowStart.setHours(h, m - 30, 0, 0);
      const windowEnd = new Date(`${today}T00:00:00+07:00`);
      windowEnd.setHours(h, m + 30, 0, 0);

      const { data, error } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('reminder_id', reminderId)
        .gte('sent_at', windowStart.toISOString())
        .lte('sent_at', windowEnd.toISOString())
        .limit(1);

      if (error) {
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send notification for a reminder (using Flex Message)
   *
   * Logic:
   * - If patient is in a group: send to group only (caregivers + patient see it)
   * - If patient is NOT in a group but has LINE: send to patient 1:1 (without patient name)
   */
  private async sendReminderNotification(reminder: any) {
    try {
      const patient = reminder.patient_profiles;
      if (!patient) {
        console.error('No patient found for reminder:', reminder.id);
        return;
      }

      // Get the group for this patient
      const groupInfo = await groupService.getGroupByPatientId(patient.id);
      const patientLineUserId = patient.users?.line_user_id;

      // Determine where to send: group OR 1:1 (not both)
      if (groupInfo && groupInfo.group.lineGroupId) {
        // Send to GROUP - include patient name (for caregivers context)
        const flexMessage = this.createReminderFlexMessage(reminder, { includePatientName: true });
        await this.lineService.sendFlexMessage(
          groupInfo.group.lineGroupId,
          flexMessage.altText,
          flexMessage.contents
        );
        console.log(`✅ Reminder (Flex) sent to group for patient ${patient.first_name}`);
      } else if (patientLineUserId) {
        // Send to PATIENT 1:1 - NO patient name (they know who they are)
        const flexMessage = this.createReminderFlexMessage(reminder, { includePatientName: false });
        await this.lineService.sendFlexMessage(
          patientLineUserId,
          flexMessage.altText,
          flexMessage.contents
        );
        console.log(`✅ Reminder (Flex) sent to patient ${patient.first_name} (1:1)`);
      } else {
        console.log(`⚠️ No LINE target for reminder ${reminder.id} - patient has no group and no LINE user`);
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
   * Format reminder message (text fallback)
   */
  private formatReminderMessage(reminder: any): string {
    const patient = reminder.patient_profiles;
    const patientName = patient?.first_name || 'สมาชิก';

    const typeEmojis: Record<string, string> = {
      medication: '💊',
      vitals: '🩺',
      water: '💧',
      exercise: '🏃',
      meal: '🍽️',
      glucose: '🩸'
    };

    const typeNames: Record<string, string> = {
      medication: 'กินยา',
      vitals: 'วัดความดัน',
      water: 'ดื่มน้ำ',
      exercise: 'ออกกำลังกาย',
      meal: 'กินอาหาร',
      glucose: 'วัดน้ำตาล'
    };

    const emoji = typeEmojis[reminder.type] || '🔔';
    const typeName = typeNames[reminder.type] || reminder.type;

    let message = `${emoji} แจ้งเตือน${typeName}\n\n`;
    message += `📍 คุณ${patientName}\n`;
    message += `🕐 เวลา: ${reminder.time} น.\n`;

    if (reminder.title) {
      message += `📝 ${reminder.title}\n`;
    }

    if (reminder.description) {
      message += `💬 ${reminder.description}\n`;
    }

    message += `\n✅ พิมพ์ "@oonjai ${this.getConfirmCommand(reminder.type)}" เพื่อบันทึก`;

    return message;
  }

  /**
   * Create Flex Message for reminder with action buttons
   * Uses POSTBACK for medication reminders to track specific medication_id
   * @param reminder - The reminder object
   * @param options.includePatientName - Whether to include patient name (true for group, false for 1:1)
   */
  private createReminderFlexMessage(
    reminder: any,
    options: { includePatientName: boolean } = { includePatientName: true }
  ): { altText: string; contents: any } {
    const patient = reminder.patient_profiles;
    const patientName = patient?.first_name || 'สมาชิก';
    const patientId = patient?.id || '';
    const showPatientName = options.includePatientName;

    // OONJAI theme constants
    const OJ_PRIMARY = '#0FA968';
    const OJ_TEXT = '#3B4C63';
    const OJ_TEXT_MUTED = '#7B8DA0';

    const typeConfig: Record<string, { emoji: string; name: string; color: string; confirmText: string; declineText: string }> = {
      medication: {
        emoji: '💊',
        name: 'กินยา',
        color: '#A855F7',
        confirmText: 'กินยาแล้ว',
        declineText: 'ยังไม่ได้กินยา'
      },
      vitals: {
        emoji: '🩺',
        name: 'วัดความดัน',
        color: '#EF4444',
        confirmText: 'วัดความดันแล้ว',
        declineText: 'ยังไม่ได้วัดความดัน'
      },
      water: {
        emoji: '💧',
        name: 'ดื่มน้ำ',
        color: '#3B82F6',
        confirmText: 'ดื่มน้ำแล้ว',
        declineText: 'ยังไม่ได้ดื่มน้ำ'
      },
      exercise: {
        emoji: '🏃',
        name: 'ออกกำลังกาย',
        color: '#22C55E',
        confirmText: 'ออกกำลังกายแล้ว',
        declineText: 'ยังไม่ได้ออกกำลังกาย'
      },
      food: {
        emoji: '🍽️',
        name: 'ทานอาหาร',
        color: '#F97316',
        confirmText: 'ทานอาหารแล้ว',
        declineText: 'ยังไม่ได้ทานอาหาร'
      },
      glucose: {
        emoji: '🩸',
        name: 'วัดน้ำตาล',
        color: '#F59E0B',
        confirmText: 'วัดน้ำตาลแล้ว',
        declineText: 'ยังไม่ได้วัดน้ำตาล'
      }
    };

    const config = typeConfig[reminder.type] || {
      emoji: '🔔',
      name: reminder.type,
      color: OJ_PRIMARY,
      confirmText: 'ทำแล้ว',
      declineText: 'ยังไม่ได้ทำ'
    };

    const timeDisplay = reminder.time?.substring(0, 5) || '00:00';

    // Get medication name from linked medication, title, or fallback to generic name
    const linkedMedication = reminder.medications;
    const medicationName = linkedMedication?.name || reminder.title || config.name;
    const dosageInfo = linkedMedication ? `${linkedMedication.dosage_amount || ''} ${linkedMedication.dosage_unit || linkedMedication.dosage || ''}`.trim() : '';

    // Build postback data for tracking
    const confirmPostbackData = `action=reminder_confirm&type=${reminder.type}&reminder_id=${reminder.id}&patient_id=${patientId}${reminder.medication_id ? `&medication_id=${reminder.medication_id}` : ''}&medication_name=${encodeURIComponent(medicationName)}`;
    const declinePostbackData = `action=reminder_skip&type=${reminder.type}&reminder_id=${reminder.id}&patient_id=${patientId}${reminder.medication_id ? `&medication_id=${reminder.medication_id}` : ''}`;

    const flexContents = {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [],
                width: '10px',
                height: '10px',
                backgroundColor: '#FFFFFF',
                cornerRadius: '50px',
                flex: 0
              },
              { type: 'text', text: 'อุ่นใจ', size: 'xs', color: '#FFFFFF', margin: 'sm', weight: 'bold', flex: 0 },
              { type: 'text', text: `แจ้งเตือน${config.name}`, size: 'xs', color: '#FFFFFFB3', margin: 'md' },
            ],
            alignItems: 'center'
          },
          {
            type: 'text',
            text: medicationName,
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF',
            margin: 'md',
            wrap: true
          }
        ],
        backgroundColor: config.color,
        paddingAll: 'xl',
        paddingBottom: 'lg'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          // Only show patient name in group context
          ...(showPatientName ? [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [],
                width: '12px',
                height: '12px',
                backgroundColor: config.color,
                cornerRadius: '50px',
                flex: 0
              },
              { type: 'text', text: 'สมาชิก', size: 'xs', color: OJ_TEXT_MUTED, flex: 0, margin: 'md' },
              { type: 'text', text: patientName, size: 'sm', color: OJ_TEXT, weight: 'bold', margin: 'md', wrap: true }
            ],
            alignItems: 'center'
          }] : []),
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [],
                width: '12px',
                height: '12px',
                backgroundColor: OJ_TEXT_MUTED,
                cornerRadius: '50px',
                flex: 0
              },
              { type: 'text', text: 'เวลา', size: 'xs', color: OJ_TEXT_MUTED, flex: 0, margin: 'md' },
              { type: 'text', text: `${timeDisplay} น.`, size: 'sm', color: OJ_TEXT, margin: 'md' }
            ],
            alignItems: 'center',
            margin: showPatientName ? 'lg' : 'none'
          },
          // Show dosage info
          ...((dosageInfo) ? [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [],
                width: '12px',
                height: '12px',
                backgroundColor: OJ_TEXT_MUTED,
                cornerRadius: '50px',
                flex: 0
              },
              { type: 'text', text: 'ขนาด', size: 'xs', color: OJ_TEXT_MUTED, flex: 0, margin: 'md' },
              { type: 'text', text: dosageInfo, size: 'sm', color: OJ_TEXT, margin: 'md', wrap: true }
            ],
            alignItems: 'center',
            margin: 'lg'
          }] : []),
          ...(reminder.note ? [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [],
                width: '12px',
                height: '12px',
                backgroundColor: OJ_TEXT_MUTED,
                cornerRadius: '50px',
                flex: 0
              },
              { type: 'text', text: 'หมายเหตุ', size: 'xs', color: OJ_TEXT_MUTED, flex: 0, margin: 'md' },
              { type: 'text', text: reminder.note, size: 'sm', color: OJ_TEXT, margin: 'md', wrap: true }
            ],
            alignItems: 'center',
            margin: 'lg'
          }] : [])
        ],
        paddingAll: 'lg'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: `${config.name}แล้ว ✓`,
              data: confirmPostbackData,
              displayText: `${config.confirmText} (${medicationName})`
            },
            style: 'primary',
            color: OJ_PRIMARY,
            height: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '⏰ ยังไม่ได้ทำ',
              data: declinePostbackData,
              displayText: config.declineText
            },
            style: 'secondary',
            height: 'sm',
            margin: 'sm'
          }
        ],
        paddingAll: 'lg'
      }
    };

    // altText: include patient name only for group context
    const altText = showPatientName
      ? `${config.emoji} แจ้งเตือน${config.name} - ${patientName} เวลา ${timeDisplay} น.`
      : `${config.emoji} แจ้งเตือน${config.name} เวลา ${timeDisplay} น.`;

    return {
      altText,
      contents: flexContents
    };
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
      meal: 'กินข้าวแล้ว',
      glucose: 'น้ำตาล [ค่า]'
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
              const message = `⚠️ แจ้งเตือน\n\nไม่พบกิจกรรมของคุณ${patient.first_name} มากกว่า 4 ชั่วโมงแล้ว\n\nกรุณาตรวจสอบด้วยนะคะ`;

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
