/**
 * Medication Management Service
 *
 * Enhanced medication management addressing Oonjai feedback:
 * - Support specific days of week (Mon/Wed/Fri)
 * - Support fractional dosages (½ tablet)
 * - Support liquid medications with ml and teaspoon conversion
 * - Flexible scheduling
 *
 * @version 2.0.0
 */

import { supabase } from './supabase.service';

export type DosageForm = 'tablet' | 'capsule' | 'liquid' | 'injection' | 'topical' | 'other';
export type DosageUnit = 'tablet' | 'capsule' | 'ml' | 'mg' | 'g' | 'drop' | 'puff' | 'unit';
export type Frequency = 'daily' | 'weekly' | 'specific_days' | 'as_needed';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Medication {
  id?: string;
  patient_id: string;
  name: string;
  generic_name?: string;

  // Dosage
  dosage_amount: number; // Supports 0.5 for half tablet
  dosage_form: DosageForm;
  dosage_unit: DosageUnit;

  // Scheduling
  frequency: Frequency;
  days_of_week?: DayOfWeek[]; // For specific_days or weekly
  times: string[]; // ['08:00', '20:00']

  // Additional info
  purpose?: string;
  side_effects?: string;
  instructions?: string;
  prescriber?: string;

  // Reminder
  reminder_enabled: boolean;

  created_at?: Date;
  updated_at?: Date;
}

export interface MedicationLog {
  id?: string;
  medication_id: string;
  patient_id: string;
  taken_at: Date;
  dosage_amount: number;
  logged_by?: string;
  notes?: string;
}

export class MedicationService {
  /**
   * Add new medication
   */
  async addMedication(medication: Medication): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Validate dosage amount
      if (medication.dosage_amount <= 0) {
        return {
          success: false,
          error: 'จำนวนยาต้องมากกว่า 0'
        };
      }

      // Validate days_of_week if frequency is specific_days
      if (medication.frequency === 'specific_days' && (!medication.days_of_week || medication.days_of_week.length === 0)) {
        return {
          success: false,
          error: 'กรุณาเลือกวันที่ต้องทานยา'
        };
      }

      // Validate times
      if (!medication.times || medication.times.length === 0) {
        return {
          success: false,
          error: 'กรุณาระบุเวลาทานยา'
        };
      }

      const { data, error } = await supabase
        .from('medications')
        .insert([{
          patient_id: medication.patient_id,
          name: medication.name,
          generic_name: medication.generic_name,
          dosage_amount: medication.dosage_amount,
          dosage_form: medication.dosage_form,
          dosage_unit: medication.dosage_unit,
          frequency: medication.frequency,
          days_of_week: medication.days_of_week ? JSON.stringify(medication.days_of_week) : null,
          times: JSON.stringify(medication.times),
          purpose: medication.purpose,
          side_effects: medication.side_effects,
          instructions: medication.instructions,
          prescriber: medication.prescriber,
          reminder_enabled: medication.reminder_enabled !== undefined ? medication.reminder_enabled : true
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error: any) {
      console.error('Error adding medication:', error);
      return {
        success: false,
        error: error.message || 'Failed to add medication'
      };
    }
  }

  /**
   * Update medication
   */
  async updateMedication(id: string, updates: Partial<Medication>): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { ...updates };

      // Convert arrays to JSON strings for database
      if (updates.days_of_week) {
        updateData.days_of_week = JSON.stringify(updates.days_of_week);
      }
      if (updates.times) {
        updateData.times = JSON.stringify(updates.times);
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('medications')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error updating medication:', error);
      return {
        success: false,
        error: error.message || 'Failed to update medication'
      };
    }
  }

  /**
   * Delete medication
   */
  async deleteMedication(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting medication:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete medication'
      };
    }
  }

  /**
   * Get all medications for a patient
   */
  async getPatientMedications(patientId: string): Promise<Medication[]> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse JSON fields
      return (data || []).map(med => ({
        ...med,
        days_of_week: med.days_of_week ? JSON.parse(med.days_of_week) : undefined,
        times: med.times ? JSON.parse(med.times) : []
      }));
    } catch (error: any) {
      console.error('Error getting medications:', error);
      return [];
    }
  }

  /**
   * Get medications due today
   */
  async getMedicationsDueToday(patientId: string): Promise<Medication[]> {
    try {
      const allMeds = await this.getPatientMedications(patientId);
      const today = new Date();
      const dayName = this.getDayName(today);

      // Filter medications that should be taken today
      const dueToday = allMeds.filter(med => {
        if (med.frequency === 'daily') {
          return true;
        }

        if (med.frequency === 'specific_days' && med.days_of_week) {
          return med.days_of_week.includes(dayName);
        }

        if (med.frequency === 'weekly' && med.days_of_week) {
          return med.days_of_week.includes(dayName);
        }

        return false; // as_needed doesn't show in daily list
      });

      return dueToday;
    } catch (error: any) {
      console.error('Error getting medications due today:', error);
      return [];
    }
  }

  /**
   * Log medication taken
   */
  async logMedicationTaken(log: MedicationLog): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('medication_logs')
        .insert([{
          medication_id: log.medication_id,
          patient_id: log.patient_id,
          taken_at: log.taken_at || new Date().toISOString(),
          dosage_amount: log.dosage_amount,
          logged_by: log.logged_by,
          notes: log.notes
        }])
        .select()
        .single();

      if (error) throw error;

      // Also log to activity_logs
      const medication = await this.getMedicationById(log.medication_id);
      if (medication) {
        await supabase
          .from('activity_logs')
          .insert([{
            patient_id: log.patient_id,
            task_type: 'medication',
            value: medication.name,
            metadata: {
              medication_id: log.medication_id,
              medication_name: medication.name,
              dosage: `${log.dosage_amount} ${medication.dosage_unit}`,
              taken_at: log.taken_at
            },
            timestamp: log.taken_at || new Date().toISOString()
          }]);
      }

      return {
        success: true,
        data
      };
    } catch (error: any) {
      console.error('Error logging medication:', error);
      return {
        success: false,
        error: error.message || 'Failed to log medication'
      };
    }
  }

  /**
   * Get medication by ID
   */
  async getMedicationById(id: string): Promise<Medication | null> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        days_of_week: data.days_of_week ? JSON.parse(data.days_of_week) : undefined,
        times: data.times ? JSON.parse(data.times) : []
      };
    } catch (error: any) {
      console.error('Error getting medication:', error);
      return null;
    }
  }

  /**
   * Format dosage for display
   * Handles fractional tablets and ml conversion
   */
  formatDosage(amount: number, unit: DosageUnit, form: DosageForm): string {
    // Handle tablets/capsules - convert 0.5 to ½
    if (form === 'tablet' || form === 'capsule') {
      if (amount === 0.25) return '¼ เม็ด';
      if (amount === 0.5) return '½ เม็ด';
      if (amount === 0.75) return '¾ เม็ด';
      if (amount === 1) return '1 เม็ด';
      if (amount === 1.5) return '1½ เม็ด';
      return `${amount} เม็ด`;
    }

    // Handle liquid - add teaspoon conversion
    if (form === 'liquid' && unit === 'ml') {
      const teaspoons = amount / 5; // 5ml = 1 teaspoon
      const tablespoons = amount / 15; // 15ml = 1 tablespoon

      if (amount === 5) return '5 ml (1 ชอนชา)';
      if (amount === 15) return '15 ml (1 ช้อนโต๊ะ)';
      if (amount % 5 === 0 && teaspoons < 3) {
        return `${amount} ml (${teaspoons} ชอนชา)`;
      }
      if (amount % 15 === 0) {
        return `${amount} ml (${tablespoons} ช้อนโต๊ะ)`;
      }
      return `${amount} ml`;
    }

    // Default format
    return `${amount} ${unit}`;
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
  getThaiDayName(day: DayOfWeek): string {
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
   * Get schedule description in Thai
   */
  getScheduleDescription(medication: Medication): string {
    if (medication.frequency === 'daily') {
      const times = medication.times.map(t => t.substring(0, 5)).join(', ');
      return `ทุกวัน เวลา ${times}`;
    }

    if (medication.frequency === 'specific_days' && medication.days_of_week) {
      const days = medication.days_of_week.map(d => this.getThaiDayName(d)).join(', ');
      const times = medication.times.map(t => t.substring(0, 5)).join(', ');
      return `${days} เวลา ${times}`;
    }

    if (medication.frequency === 'weekly' && medication.days_of_week) {
      const count = medication.days_of_week.length;
      return `สัปดาห์ละ ${count} วัน`;
    }

    if (medication.frequency === 'as_needed') {
      return 'เมื่อจำเป็น';
    }

    return 'ตามแพทย์สั่ง';
  }

  /**
   * Check if medication should be taken on a specific date
   */
  shouldTakeOn(medication: Medication, date: Date): boolean {
    const dayName = this.getDayName(date);

    if (medication.frequency === 'daily') {
      return true;
    }

    if (medication.frequency === 'specific_days' && medication.days_of_week) {
      return medication.days_of_week.includes(dayName);
    }

    if (medication.frequency === 'weekly' && medication.days_of_week) {
      return medication.days_of_week.includes(dayName);
    }

    return false;
  }
}

// Export singleton instance
export const medicationService = new MedicationService();
