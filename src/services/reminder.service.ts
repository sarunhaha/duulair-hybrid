/**
 * Reminder Service
 *
 * Flexible reminder system addressing Oonjai feedback:
 * "เวลา สามารถตั้งเองได้อย่างอิสระโดย caregiver ใช้มั้ยครับ?"
 *
 * Features:
 * - Custom reminder times (not fixed)
 * - Specific days of week
 * - Multiple reminders per activity
 * - Separate water reminders from medication reminders
 *
 * @version 2.0.0
 */

import { supabase } from './supabase.service';
import { DayOfWeek, Frequency } from './medication.service';

export type ReminderType = 'medication' | 'vitals' | 'water' | 'food' | 'exercise' | 'custom';

export interface Reminder {
  id?: string;
  patient_id: string;
  group_id?: string;

  // Type and description (support both old and new field names)
  reminder_type?: ReminderType;
  type?: string;  // Database column name
  title: string;
  description?: string;
  note?: string;  // Database column name

  // Scheduling
  custom_time: string; // '08:00', '14:30'
  frequency: Frequency;
  days_of_week?: DayOfWeek[]; // For specific_days frequency

  // Settings
  is_active: boolean;
  notification_enabled: boolean;
  sound_enabled?: boolean;

  // Metadata
  metadata?: any;

  created_at?: Date;
  updated_at?: Date;
  created_by?: string;
}

export interface ReminderSchedule {
  reminder_id: string;
  next_trigger_at: Date;
  last_triggered_at?: Date;
}

export class ReminderService {
  /**
   * Create a new reminder
   */
  async createReminder(reminder: Reminder): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Validate time format (HH:MM)
      if (!this.isValidTimeFormat(reminder.custom_time)) {
        return {
          success: false,
          error: 'รูปแบบเวลาไม่ถูกต้อง กรุณาใช้ HH:MM (เช่น 08:00)'
        };
      }

      // Validate days_of_week for specific_days frequency
      if (reminder.frequency === 'specific_days' && (!reminder.days_of_week || reminder.days_of_week.length === 0)) {
        return {
          success: false,
          error: 'กรุณาเลือกวันที่ต้องการเตือน'
        };
      }

      const { data, error } = await supabase
        .from('reminders')
        .insert([{
          patient_id: reminder.patient_id,
          type: reminder.reminder_type || reminder.type || 'general',
          title: reminder.title,
          time: reminder.custom_time || '08:00',
          note: reminder.description || reminder.note || null,
          custom_time: reminder.custom_time,
          frequency: reminder.frequency,
          days_of_week: reminder.days_of_week ? JSON.stringify(reminder.days_of_week) : null,
          is_active: reminder.is_active !== undefined ? reminder.is_active : true
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error: any) {
      console.error('Error creating reminder:', error);
      return {
        success: false,
        error: error.message || 'Failed to create reminder'
      };
    }
  }

  /**
   * Update reminder
   */
  async updateReminder(id: string, updates: Partial<Reminder>): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { ...updates };

      // Validate time if provided
      if (updates.custom_time && !this.isValidTimeFormat(updates.custom_time)) {
        return {
          success: false,
          error: 'รูปแบบเวลาไม่ถูกต้อง'
        };
      }

      // Convert arrays to JSON
      if (updates.days_of_week) {
        updateData.days_of_week = JSON.stringify(updates.days_of_week);
      }
      if (updates.metadata) {
        updateData.metadata = JSON.stringify(updates.metadata);
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('reminders')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error updating reminder:', error);
      return {
        success: false,
        error: error.message || 'Failed to update reminder'
      };
    }
  }

  /**
   * Delete reminder
   */
  async deleteReminder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting reminder:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete reminder'
      };
    }
  }

  /**
   * Get all reminders for a patient
   */
  async getPatientReminders(patientId: string, activeOnly: boolean = false): Promise<Reminder[]> {
    try {
      let query = supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId);

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('custom_time', { ascending: true });

      if (error) throw error;

      // Parse JSON fields
      return (data || []).map(reminder => ({
        ...reminder,
        days_of_week: reminder.days_of_week ? JSON.parse(reminder.days_of_week) : undefined,
        metadata: reminder.metadata ? JSON.parse(reminder.metadata) : undefined
      }));
    } catch (error: any) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }

  /**
   * Get reminders by type
   */
  async getRemindersByType(patientId: string, type: ReminderType): Promise<Reminder[]> {
    try {
      const allReminders = await this.getPatientReminders(patientId, true);
      return allReminders.filter(r => r.reminder_type === type);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get reminders due today
   */
  async getRemindersDueToday(patientId: string): Promise<Reminder[]> {
    try {
      const allReminders = await this.getPatientReminders(patientId, true);
      const today = new Date();
      const dayName = this.getDayName(today);

      return allReminders.filter(reminder => {
        if (reminder.frequency === 'daily') {
          return true;
        }

        if (reminder.frequency === 'specific_days' && reminder.days_of_week) {
          return reminder.days_of_week.includes(dayName);
        }

        return false;
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Toggle reminder active status
   */
  async toggleReminder(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateReminder(id, { is_active: isActive });
  }

  /**
   * Get next reminder time
   */
  getNextReminderTime(reminder: Reminder): Date | null {
    const now = new Date();
    const [hours, minutes] = reminder.custom_time.split(':').map(Number);

    const today = new Date(now);
    today.setHours(hours, minutes, 0, 0);

    // If time has passed today, check tomorrow
    if (today <= now) {
      today.setDate(today.getDate() + 1);
    }

    // For specific days, find next matching day
    if (reminder.frequency === 'specific_days' && reminder.days_of_week) {
      let daysToAdd = 0;
      const maxDays = 7;

      while (daysToAdd < maxDays) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + daysToAdd);
        const dayName = this.getDayName(checkDate);

        if (reminder.days_of_week.includes(dayName)) {
          checkDate.setHours(hours, minutes, 0, 0);
          return checkDate;
        }

        daysToAdd++;
      }

      return null; // No matching day found
    }

    // For daily, return today or tomorrow
    return today;
  }

  /**
   * Format reminder time for display
   */
  formatTime(time: string): string {
    return time.substring(0, 5); // HH:MM
  }

  /**
   * Get frequency description in Thai
   */
  getFrequencyDescription(reminder: Reminder): string {
    if (reminder.frequency === 'daily') {
      return `ทุกวัน เวลา ${this.formatTime(reminder.custom_time)}`;
    }

    if (reminder.frequency === 'specific_days' && reminder.days_of_week) {
      const days = reminder.days_of_week.map(d => this.getThaiDayName(d)).join(', ');
      return `${days} เวลา ${this.formatTime(reminder.custom_time)}`;
    }

    if (reminder.frequency === 'weekly' && reminder.days_of_week) {
      return `สัปดาห์ละ ${reminder.days_of_week.length} วัน`;
    }

    return 'ตามที่ตั้งไว้';
  }

  /**
   * Validate time format (HH:MM)
   */
  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Get day name from date
   */
  private getDayName(date: Date): DayOfWeek {
    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Get Thai day name
   */
  private getThaiDayName(day: DayOfWeek): string {
    const thaiDays: Record<DayOfWeek, string> = {
      sunday: 'อาทิตย์',
      monday: 'จันทร์',
      tuesday: 'อังคาร',
      wednesday: 'พุธ',
      thursday: 'พฤหัสบดี',
      friday: 'ศุกร์',
      saturday: 'เสาร์'
    };
    return thaiDays[day];
  }

  /**
   * Get reminder icon by type
   */
  getReminderIcon(type: ReminderType): string {
    const icons: Record<ReminderType, string> = {
      medication: '💊',
      vitals: '🩺',
      water: '💧',
      food: '🍚',
      exercise: '🚶',
      custom: '🔔'
    };
    return icons[type] || '🔔';
  }

  /**
   * Create default medication reminders
   * Helper function for common use case
   */
  async createMedicationReminders(
    patientId: string,
    medicationName: string,
    times: string[],
    daysOfWeek?: DayOfWeek[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const reminders: Reminder[] = times.map(time => ({
        patient_id: patientId,
        reminder_type: 'medication',
        title: `กินยา ${medicationName}`,
        custom_time: time,
        frequency: daysOfWeek ? 'specific_days' : 'daily',
        days_of_week: daysOfWeek,
        is_active: true,
        notification_enabled: true
      }));

      for (const reminder of reminders) {
        const result = await this.createReminder(reminder);
        if (!result.success) {
          return result;
        }
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create medication reminders'
      };
    }
  }

  /**
   * Create default reminders for a new patient
   * Called after patient registration
   */
  async createDefaultReminders(patientId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const defaultReminders = [
        // Morning medication reminder
        {
          patient_id: patientId,
          reminder_type: 'medication' as ReminderType,
          title: 'กินยาเช้า',
          description: 'อย่าลืมกินยาตอนเช้านะคะ',
          custom_time: '08:00',
          frequency: 'daily' as const,
          is_active: true,
          notification_enabled: true
        },
        // Evening medication reminder
        {
          patient_id: patientId,
          reminder_type: 'medication' as ReminderType,
          title: 'กินยาเย็น',
          description: 'อย่าลืมกินยาตอนเย็นนะคะ',
          custom_time: '18:00',
          frequency: 'daily' as const,
          is_active: true,
          notification_enabled: true
        },
        // Blood pressure check reminder
        {
          patient_id: patientId,
          reminder_type: 'vitals' as ReminderType,
          title: 'วัดความดัน',
          description: 'ได้เวลาวัดความดันแล้วค่ะ',
          custom_time: '09:00',
          frequency: 'daily' as const,
          is_active: true,
          notification_enabled: true
        },
        // Water reminder - morning
        {
          patient_id: patientId,
          reminder_type: 'water' as ReminderType,
          title: 'ดื่มน้ำ',
          description: 'อย่าลืมดื่มน้ำนะคะ',
          custom_time: '10:00',
          frequency: 'daily' as const,
          is_active: true,
          notification_enabled: true
        },
        // Water reminder - afternoon
        {
          patient_id: patientId,
          reminder_type: 'water' as ReminderType,
          title: 'ดื่มน้ำ',
          description: 'อย่าลืมดื่มน้ำนะคะ',
          custom_time: '14:00',
          frequency: 'daily' as const,
          is_active: true,
          notification_enabled: true
        },
        // Exercise reminder
        {
          patient_id: patientId,
          reminder_type: 'exercise' as ReminderType,
          title: 'ออกกำลังกาย',
          description: 'ได้เวลาเดินหรือออกกำลังกายเบาๆ แล้วค่ะ',
          custom_time: '16:00',
          frequency: 'daily' as const,
          is_active: true,
          notification_enabled: true
        }
      ];

      for (const reminder of defaultReminders) {
        const result = await this.createReminder(reminder);
        if (!result.success) {
          console.error(`Failed to create default reminder: ${reminder.title}`, result.error);
        }
      }

      console.log(`✅ Created ${defaultReminders.length} default reminders for patient ${patientId}`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to create default reminders:', error);
      return {
        success: false,
        error: error.message || 'Failed to create default reminders'
      };
    }
  }
}

// Export singleton instance
export const reminderService = new ReminderService();
