// src/services/supabase.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ActivityLog } from '../types/user.types';

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  // Agent State Management
  async saveAgentState(agentName: string, state: any) {
    const { error } = await this.client
      .from('agent_states')
      .upsert({
        agent_name: agentName,
        state,
        updated_at: new Date()
      });
    
    if (error) throw error;
  }

  async loadAgentState(agentName: string) {
    const { data, error } = await this.client
      .from('agent_states')
      .select('state')
      .eq('agent_name', agentName)
      .single();
    
    if (error) return null;
    return data?.state;
  }

  // Agent Specifications
  async getAgentSpecs() {
    const { data, error } = await this.client
      .from('agent_specs')
      .select('*')
      .eq('active', true);
    
    if (error) throw error;
    return data || [];
  }

  // Activity Logging
  async saveActivityLog(log: Partial<ActivityLog>) {
    // Ensure timestamp is set
    const logWithDefaults = {
      ...log,
      timestamp: log.timestamp || new Date(),
      source: log.source || '1:1' // Default to 1:1 if not specified
    };

    const { error } = await this.client
      .from('activity_logs')
      .insert(logWithDefaults);

    if (error) throw error;
  }

  async getActivityLogs(patientId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('activity_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Group Activity Logging (TASK-002)
  async getGroupActivityLogs(groupId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('activity_logs')
      .select('*')
      .eq('group_id', groupId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getActivityLogsByActor(actorLineUserId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('activity_logs')
      .select('*')
      .eq('actor_line_user_id', actorLineUserId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Alert Management
  async saveAlert(alert: any) {
    const { error } = await this.client
      .from('alerts')
      .insert(alert);

    if (error) throw error;
  }

  // Error Logging
  async logError(error: any) {
    try {
      const { error: dbError } = await this.client
        .from('error_logs')
        .insert(error);

      if (dbError) console.error('Failed to log error:', dbError);
    } catch (err) {
      // Silently fail if error_logs table doesn't exist
      // This prevents infinite error loops
    }
  }

  // Patient Management
  async getPatient(patientId: string) {
    const { data, error } = await this.client
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Real-time Subscriptions
  subscribeToAlerts(callback: (payload: any) => void) {
    return this.client
      .channel('alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts'
      }, callback)
      .subscribe();
  }

  // Get client instance (for direct queries)
  getClient() {
    return this.client;
  }
}

// Export singleton instance and client
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.getClient();