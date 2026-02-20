// src/services/supabase.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ActivityLog } from '../types/user.types';
import {
  SymptomInsert,
  SleepLogInsert,
  ExerciseLogInsert,
  HealthEventInsert,
  MedicationLogInsert,
  WaterLogInsert,
  Symptom,
  SleepLog,
  ExerciseLog,
  HealthEvent,
  VitalsLog,
  MoodLog,
  ConversationLog
} from '../types/health.types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
      .from('alert_logs')
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
      .from('patient_profiles')
      .select('*')
      .eq('id', patientId)
      .single();

    if (error) throw error;
    return data;
  }

  // Real-time Subscriptions
  subscribeToAlerts(callback: (payload: any) => void) {
    return this.client
      .channel('alert_logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alert_logs'
      }, callback)
      .subscribe();
  }

  // Get patient medications
  // NOTE: Table is 'medications' (not 'patient_medications')
  // Schema matches medication.service.ts
  async getPatientMedications(patientId: string) {
    const { data, error } = await this.client
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Parse JSON fields (days_of_week, times) if needed
    return (data || []).map((med: any) => ({
      ...med,
      days_of_week: med.days_of_week ? (typeof med.days_of_week === 'string' ? JSON.parse(med.days_of_week) : med.days_of_week) : undefined,
      times: med.times ? (typeof med.times === 'string' ? JSON.parse(med.times) : med.times) : []
    }));
  }

  // ========================================
  // Symptoms (อาการ)
  // ========================================

  async saveSymptom(symptom: SymptomInsert): Promise<string> {
    const { data, error } = await this.client
      .from('symptoms')
      .insert(symptom)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getSymptoms(patientId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('symptoms')
      .select('*')
      .eq('patient_id', patientId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getRecentSymptoms(patientId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getSymptoms(patientId, startDate, new Date());
  }

  // ========================================
  // Sleep Logs (การนอน)
  // ========================================

  async saveSleepLog(sleepLog: SleepLogInsert): Promise<string> {
    const { data, error } = await this.client
      .from('sleep_logs')
      .insert(sleepLog)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getSleepLogs(patientId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('sleep_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('sleep_date', startDate.toISOString().split('T')[0])
      .lte('sleep_date', endDate.toISOString().split('T')[0])
      .order('sleep_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getRecentSleepLogs(patientId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getSleepLogs(patientId, startDate, new Date());
  }

  // ========================================
  // Exercise Logs (การออกกำลังกาย)
  // ========================================

  async saveExerciseLog(exerciseLog: ExerciseLogInsert): Promise<string> {
    const { data, error } = await this.client
      .from('exercise_logs')
      .insert(exerciseLog)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getExerciseLogs(patientId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('exercise_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('exercise_date', startDate.toISOString().split('T')[0])
      .lte('exercise_date', endDate.toISOString().split('T')[0])
      .order('exercise_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getRecentExerciseLogs(patientId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getExerciseLogs(patientId, startDate, new Date());
  }

  // ========================================
  // Medication Logs (การกินยา)
  // ========================================

  async saveMedicationLog(log: MedicationLogInsert): Promise<string> {
    const { data, error } = await this.client
      .from('medication_logs')
      .insert({
        ...log,
        taken_at: log.taken_at || new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  // ========================================
  // Water Logs (การดื่มน้ำ)
  // ========================================

  async saveWaterLog(log: WaterLogInsert): Promise<string> {
    const { data, error } = await this.client
      .from('water_logs')
      .insert({
        ...log,
        log_date: log.log_date || new Date().toISOString().split('T')[0]
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  // ========================================
  // Health Events (Linking Table)
  // ========================================

  async saveHealthEvent(event: HealthEventInsert): Promise<string> {
    const { data, error } = await this.client
      .from('health_events')
      .insert(event)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getHealthEvents(patientId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('health_events')
      .select('*')
      .eq('patient_id', patientId)
      .gte('event_date', startDate.toISOString().split('T')[0])
      .lte('event_date', endDate.toISOString().split('T')[0])
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getHealthEventsByType(patientId: string, eventType: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.client
      .from('health_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('event_type', eventType)
      .gte('event_date', startDate.toISOString().split('T')[0])
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ========================================
  // Vitals Logs (Enhanced)
  // ========================================

  async saveVitalsLog(vitals: Partial<VitalsLog> & { patient_id: string }): Promise<string> {
    const { data, error } = await this.client
      .from('vitals_logs')
      .insert({
        ...vitals,
        measured_at: vitals.measuredAt || new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getVitalsLogs(patientId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('vitals_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('measured_at', startDate.toISOString())
      .lte('measured_at', endDate.toISOString())
      .order('measured_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getRecentVitalsLogs(patientId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getVitalsLogs(patientId, startDate, new Date());
  }

  // ========================================
  // Mood Logs (Enhanced)
  // ========================================

  async saveMoodLog(mood: Partial<MoodLog> & { patient_id: string }): Promise<string> {
    const { data, error } = await this.client
      .from('mood_logs')
      .insert({
        ...mood,
        timestamp: mood.timestamp || new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getMoodLogs(patientId: string, startDate: Date, endDate: Date) {
    const { data, error } = await this.client
      .from('mood_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getRecentMoodLogs(patientId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getMoodLogs(patientId, startDate, new Date());
  }

  // ========================================
  // Conversation Logs (Enhanced)
  // ========================================

  async saveConversationLog(log: Partial<ConversationLog> & { role: string; text: string }): Promise<string> {
    // Convert camelCase to snake_case for database
    const dbLog: Record<string, any> = {
      role: log.role,
      text: log.text,
      timestamp: log.timestamp || new Date().toISOString()
    };

    if (log.userId) dbLog.user_id = log.userId;
    if (log.patientId) dbLog.patient_id = log.patientId;
    if (log.groupId) dbLog.group_id = log.groupId;
    if (log.messageId) dbLog.message_id = log.messageId;
    if (log.replyToken) dbLog.reply_token = log.replyToken;
    if (log.intent) dbLog.intent = log.intent;
    if (log.flags) dbLog.flags = log.flags;
    if (log.mediaUrl) dbLog.media_url = log.mediaUrl;
    if (log.mediaType) dbLog.media_type = log.mediaType;
    if (log.aiExtractedData) dbLog.ai_extracted_data = log.aiExtractedData;
    if (log.aiConfidence !== undefined) dbLog.ai_confidence = log.aiConfidence;
    if (log.aiModel) dbLog.ai_model = log.aiModel;
    if (log.source) dbLog.source = log.source;

    const { data, error } = await this.client
      .from('conversation_logs')
      .insert(dbLog)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async updateConversationLog(id: string, updates: Partial<ConversationLog>) {
    // Convert camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {};

    if (updates.intent) dbUpdates.intent = updates.intent;
    if (updates.aiExtractedData) dbUpdates.ai_extracted_data = updates.aiExtractedData;
    if (updates.aiConfidence !== undefined) dbUpdates.ai_confidence = updates.aiConfidence;
    if (updates.aiModel) dbUpdates.ai_model = updates.aiModel;

    const { error } = await this.client
      .from('conversation_logs')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
  }

  async getConversationLogs(patientId: string, limit: number = 20) {
    const { data, error } = await this.client
      .from('conversation_logs')
      .select('*')
      .eq('patient_id', patientId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ========================================
  // Health Goals
  // ========================================

  async getHealthGoals(patientId: string) {
    const { data, error } = await this.client
      .from('health_goals')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Return defaults if not found
    return data || {
      target_bp_systolic: 120,
      target_bp_diastolic: 80,
      target_blood_sugar_fasting: 100,
      target_blood_sugar_post_meal: 140,
      target_water_ml: 2000,
      target_water_glasses: 8,
      target_exercise_minutes: 30,
      target_exercise_days_per_week: 5,
      target_sleep_hours: 7,
      target_steps: 6000
    };
  }

  async updateHealthGoals(patientId: string, goals: Record<string, any>) {
    const { error } = await this.client
      .from('health_goals')
      .upsert({
        patient_id: patientId,
        ...goals,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  // ========================================
  // Daily Patient Summary
  // ========================================

  async getDailyPatientSummary(patientId: string, date: Date) {
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await this.client
      .from('daily_patient_summaries')
      .select('*')
      .eq('patient_id', patientId)
      .eq('summary_date', dateStr)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async saveDailyPatientSummary(summary: Record<string, any>) {
    const { error } = await this.client
      .from('daily_patient_summaries')
      .upsert(summary);

    if (error) throw error;
  }

  // ========================================
  // Storage: PDF Reports
  // ========================================

  async uploadReportPDF(
    patientId: string,
    pdfBuffer: Buffer,
    filename: string
  ): Promise<{ signedUrl: string; path: string }> {
    const filePath = `${patientId}/${filename}`;

    const { error: uploadError } = await this.client.storage
      .from('reports')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: signedData, error: signError } = await this.client.storage
      .from('reports')
      .createSignedUrl(filePath, 3600); // 1-hour expiry

    if (signError || !signedData?.signedUrl) {
      throw signError || new Error('Failed to create signed URL');
    }

    return { signedUrl: signedData.signedUrl, path: filePath };
  }

  // ========================================
  // Utility Methods
  // ========================================

  // Get client instance (for direct queries)
  getClient() {
    return this.client;
  }
}

// Export singleton instance and client
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.getClient();