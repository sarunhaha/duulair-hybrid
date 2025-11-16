/**
 * Water Tracking Service
 *
 * Handles water intake logging and tracking separate from medications
 * Addresses Oonjai feedback: "ต้อง track ปริมาณน้ำทั้งวัน ใช้ในกรณีคนไข้ต้องคุมน้ำ"
 *
 * Features:
 * - Log water intake (ml)
 * - Track daily total
 * - Set daily goals
 * - Calculate progress percentage
 * - Send reminders (separate from medication reminders)
 */

import { supabase } from './supabase.service';

export interface WaterIntakeLog {
  id?: string;
  patient_id: string;
  group_id?: string;
  amount_ml: number;
  logged_at?: Date;
  logged_by_line_user_id?: string;
  logged_by_display_name?: string;
  notes?: string;
}

export interface WaterIntakeGoal {
  id?: string;
  patient_id: string;
  daily_goal_ml: number;
  reminder_enabled: boolean;
  reminder_times?: string[]; // ['08:00', '12:00', '16:00', '20:00']
}

export interface DailyWaterSummary {
  total_ml: number;
  goal_ml: number;
  progress_percentage: number;
  remaining_ml: number;
  logs: WaterIntakeLog[];
}

export class WaterTrackingService {
  /**
   * Log water intake
   */
  async logWaterIntake(data: WaterIntakeLog): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Validate amount
      if (data.amount_ml <= 0 || data.amount_ml > 5000) {
        return {
          success: false,
          error: 'ปริมาณน้ำต้องอยู่ระหว่าง 1-5000 ml'
        };
      }

      const { data: result, error } = await supabase
        .from('water_intake_logs')
        .insert([{
          patient_id: data.patient_id,
          group_id: data.group_id,
          amount_ml: data.amount_ml,
          logged_at: data.logged_at || new Date().toISOString(),
          logged_by_line_user_id: data.logged_by_line_user_id,
          logged_by_display_name: data.logged_by_display_name,
          notes: data.notes
        }])
        .select()
        .single();

      if (error) throw error;

      // Also log to activity_logs for unified tracking
      await supabase
        .from('activity_logs')
        .insert([{
          patient_id: data.patient_id,
          group_id: data.group_id,
          task_type: 'water',
          value: data.amount_ml.toString(),
          metadata: {
            amount_ml: data.amount_ml,
            unit: 'ml',
            logged_by: data.logged_by_display_name
          },
          actor_line_user_id: data.logged_by_line_user_id,
          actor_display_name: data.logged_by_display_name,
          source: data.group_id ? 'group' : '1:1',
          timestamp: data.logged_at || new Date().toISOString()
        }]);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('Error logging water intake:', error);
      return {
        success: false,
        error: error.message || 'Failed to log water intake'
      };
    }
  }

  /**
   * Get daily water intake summary
   */
  async getDailySummary(patientId: string, date: Date = new Date()): Promise<DailyWaterSummary> {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get logs for the day
      const { data: logs, error: logsError } = await supabase
        .from('water_intake_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('logged_at', `${dateStr}T00:00:00`)
        .lt('logged_at', `${dateStr}T23:59:59`)
        .order('logged_at', { ascending: true });

      if (logsError) throw logsError;

      // Get daily goal
      const { data: goal } = await supabase
        .from('water_intake_goals')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      const goalMl = goal?.daily_goal_ml || 2000; // Default 2000ml
      const totalMl = (logs || []).reduce((sum, log) => sum + log.amount_ml, 0);
      const progressPercentage = Math.round((totalMl / goalMl) * 100);
      const remainingMl = Math.max(0, goalMl - totalMl);

      return {
        total_ml: totalMl,
        goal_ml: goalMl,
        progress_percentage: Math.min(100, progressPercentage),
        remaining_ml: remainingMl,
        logs: logs || []
      };
    } catch (error: any) {
      console.error('Error getting daily water summary:', error);
      return {
        total_ml: 0,
        goal_ml: 2000,
        progress_percentage: 0,
        remaining_ml: 2000,
        logs: []
      };
    }
  }

  /**
   * Set or update daily water goal
   */
  async setDailyGoal(patientId: string, goalData: Partial<WaterIntakeGoal>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('water_intake_goals')
        .upsert([{
          patient_id: patientId,
          daily_goal_ml: goalData.daily_goal_ml || 2000,
          reminder_enabled: goalData.reminder_enabled !== undefined ? goalData.reminder_enabled : true,
          reminder_times: goalData.reminder_times || ['08:00', '12:00', '16:00', '20:00'],
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'patient_id'
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error setting water goal:', error);
      return {
        success: false,
        error: error.message || 'Failed to set water goal'
      };
    }
  }

  /**
   * Get water intake goal
   */
  async getGoal(patientId: string): Promise<WaterIntakeGoal | null> {
    try {
      const { data, error } = await supabase
        .from('water_intake_goals')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      return data || null;
    } catch (error: any) {
      console.error('Error getting water goal:', error);
      return null;
    }
  }

  /**
   * Get weekly water intake trend
   */
  async getWeeklyTrend(patientId: string): Promise<Array<{ date: string; total_ml: number }>> {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const { data: logs, error } = await supabase
        .from('water_intake_logs')
        .select('logged_at, amount_ml')
        .eq('patient_id', patientId)
        .gte('logged_at', sevenDaysAgo.toISOString())
        .order('logged_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const dailyTotals = new Map<string, number>();

      (logs || []).forEach(log => {
        const date = new Date(log.logged_at).toISOString().split('T')[0];
        const current = dailyTotals.get(date) || 0;
        dailyTotals.set(date, current + log.amount_ml);
      });

      // Convert to array
      const trend = Array.from(dailyTotals.entries()).map(([date, total_ml]) => ({
        date,
        total_ml
      }));

      return trend;
    } catch (error: any) {
      console.error('Error getting weekly water trend:', error);
      return [];
    }
  }

  /**
   * Delete water intake log
   */
  async deleteLog(logId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('water_intake_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting water log:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete water log'
      };
    }
  }

  /**
   * Format ml to display string with glass equivalent
   */
  formatAmount(ml: number): string {
    const glasses = Math.round(ml / 250); // 1 glass ≈ 250ml
    return `${ml} ml (${glasses} แก้ว)`;
  }

  /**
   * Get reminder times for patient
   */
  async getReminderTimes(patientId: string): Promise<string[]> {
    try {
      const goal = await this.getGoal(patientId);
      return goal?.reminder_times || ['08:00', '12:00', '16:00', '20:00'];
    } catch (error) {
      return ['08:00', '12:00', '16:00', '20:00'];
    }
  }
}

// Export singleton instance
export const waterTrackingService = new WaterTrackingService();
