/**
 * Water Tracking Service (Refactored)
 *
 * Now uses activity_logs for water intake data (water_intake_logs was removed)
 * Uses health_goals for daily goals (water_intake_goals was removed)
 *
 * Features:
 * - Log water intake via activity_logs
 * - Track daily total from activity_logs
 * - Get goals from health_goals table
 * - Calculate progress percentage
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

export interface DailyWaterSummary {
  total_ml: number;
  goal_ml: number;
  progress_percentage: number;
  remaining_ml: number;
  logs: WaterIntakeLog[];
}

export class WaterTrackingService {
  /**
   * Log water intake (saves to activity_logs)
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

      const logEntry = {
        patient_id: data.patient_id,
        group_id: data.group_id,
        task_type: 'water',
        value: data.amount_ml.toString(),
        metadata: {
          amount_ml: data.amount_ml,
          unit: 'ml',
          notes: data.notes,
          logged_by: data.logged_by_display_name
        },
        actor_line_user_id: data.logged_by_line_user_id,
        actor_display_name: data.logged_by_display_name,
        source: data.group_id ? 'group' : '1:1',
        timestamp: data.logged_at ? new Date(data.logged_at).toISOString() : new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from('activity_logs')
        .insert([logEntry])
        .select()
        .single();

      if (error) throw error;

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
   * Get daily water intake summary from activity_logs
   */
  async getDailySummary(patientId: string, date: Date = new Date()): Promise<DailyWaterSummary> {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get water logs from activity_logs for the day
      const { data: logs, error: logsError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('task_type', 'water')
        .gte('timestamp', `${dateStr}T00:00:00`)
        .lt('timestamp', `${dateStr}T23:59:59`)
        .order('timestamp', { ascending: true });

      if (logsError) throw logsError;

      // Get daily goal from health_goals
      const { data: goals } = await supabase
        .from('health_goals')
        .select('target_water_ml')
        .eq('patient_id', patientId)
        .single();

      const goalMl = goals?.target_water_ml || 2000; // Default 2000ml

      // Calculate total from metadata or value
      const totalMl = (logs || []).reduce((sum, log) => {
        const amount = log.metadata?.amount_ml || parseInt(log.value) || 0;
        return sum + amount;
      }, 0);

      const progressPercentage = Math.round((totalMl / goalMl) * 100);
      const remainingMl = Math.max(0, goalMl - totalMl);

      // Convert activity_logs to WaterIntakeLog format
      const waterLogs: WaterIntakeLog[] = (logs || []).map(log => ({
        id: log.id,
        patient_id: log.patient_id,
        group_id: log.group_id,
        amount_ml: log.metadata?.amount_ml || parseInt(log.value) || 0,
        logged_at: new Date(log.timestamp),
        logged_by_line_user_id: log.actor_line_user_id,
        logged_by_display_name: log.actor_display_name,
        notes: log.metadata?.notes
      }));

      return {
        total_ml: totalMl,
        goal_ml: goalMl,
        progress_percentage: Math.min(100, progressPercentage),
        remaining_ml: remainingMl,
        logs: waterLogs
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
   * Set or update daily water goal (in health_goals table)
   */
  async setDailyGoal(patientId: string, goalMl: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('health_goals')
        .upsert({
          patient_id: patientId,
          target_water_ml: goalMl || 2000,
          updated_at: new Date().toISOString()
        }, {
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
   * Get water intake goal from health_goals
   */
  async getGoal(patientId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('health_goals')
        .select('target_water_ml')
        .eq('patient_id', patientId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data?.target_water_ml || 2000;
    } catch (error: any) {
      console.error('Error getting water goal:', error);
      return 2000;
    }
  }

  /**
   * Get weekly water intake trend from activity_logs
   */
  async getWeeklyTrend(patientId: string): Promise<Array<{ date: string; total_ml: number }>> {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const { data: logs, error } = await supabase
        .from('activity_logs')
        .select('timestamp, value, metadata')
        .eq('patient_id', patientId)
        .eq('task_type', 'water')
        .gte('timestamp', sevenDaysAgo.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Group by date
      const dailyTotals = new Map<string, number>();

      (logs || []).forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        const amount = log.metadata?.amount_ml || parseInt(log.value) || 0;
        const current = dailyTotals.get(date) || 0;
        dailyTotals.set(date, current + amount);
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
   * Delete water intake log from activity_logs
   */
  async deleteLog(logId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', logId)
        .eq('task_type', 'water'); // Safety: only delete water logs

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
}

// Export singleton instance
export const waterTrackingService = new WaterTrackingService();
