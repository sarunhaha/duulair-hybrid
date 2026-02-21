/**
 * Health Event Creator
 * Creates and manages health events from extracted data
 */

import { supabaseService } from '../../services/supabase.service';
import { AI_CONFIG } from '../../services/openrouter.service';
import { HealthEventInsert } from '../../types/health.types';

export interface CreateHealthEventOptions {
  patientId: string;
  conversationLogId?: string;
  activityLogId?: string;
  eventType: string;
  eventSubtype?: string;
  referenceTable?: string;
  referenceId?: string;
  rawText?: string;
  aiConfidence?: number;
  extractionModel?: string;
  summaryText?: string;
  summaryJson?: Record<string, any>;
}

/**
 * Create a health event record
 */
export async function createHealthEvent(options: CreateHealthEventOptions): Promise<string> {
  const now = new Date();

  const event: HealthEventInsert = {
    patient_id: options.patientId,
    conversation_log_id: options.conversationLogId,
    activity_log_id: options.activityLogId,
    event_type: options.eventType,
    event_subtype: options.eventSubtype,
    event_date: now.toISOString().split('T')[0],
    event_time: now.toTimeString().split(' ')[0].substring(0, 5), // HH:MM
    event_timestamp: now.toISOString(),
    reference_table: options.referenceTable,
    reference_id: options.referenceId,
    raw_text: options.rawText,
    ai_confidence: options.aiConfidence,
    extraction_model: options.extractionModel || AI_CONFIG.model,
    summary_text: options.summaryText,
    summary_json: options.summaryJson
  };

  return await supabaseService.saveHealthEvent(event);
}

/**
 * Create multiple health events from a batch
 */
export async function createHealthEventsBatch(
  events: CreateHealthEventOptions[]
): Promise<string[]> {
  const eventIds: string[] = [];

  for (const event of events) {
    try {
      const id = await createHealthEvent(event);
      eventIds.push(id);
    } catch (error) {
      console.error('Error creating health event:', error);
    }
  }

  return eventIds;
}

/**
 * Get health events summary for a patient
 */
export async function getHealthEventsSummary(
  patientId: string,
  days: number = 7
): Promise<{
  total: number;
  byType: Record<string, number>;
  recentEvents: any[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const events = await supabaseService.getHealthEvents(patientId, startDate, new Date());

  // Count by type
  const byType: Record<string, number> = {};
  for (const event of events) {
    const type = event.event_type;
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    total: events.length,
    byType,
    recentEvents: events.slice(0, 10)
  };
}

/**
 * Check for abnormal health events
 */
export function checkForAbnormalValues(data: {
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  spo2?: number;
  glucose?: number;
}): { isAbnormal: boolean; alerts: string[] } {
  const alerts: string[] = [];

  // Blood pressure
  if (data.bpSystolic && data.bpDiastolic) {
    if (data.bpSystolic >= 140 || data.bpDiastolic >= 90) {
      alerts.push(`ความดันสูง (${data.bpSystolic}/${data.bpDiastolic})`);
    } else if (data.bpSystolic < 90 || data.bpDiastolic < 60) {
      alerts.push(`ความดันต่ำ (${data.bpSystolic}/${data.bpDiastolic})`);
    }
  }

  // Heart rate
  if (data.heartRate) {
    if (data.heartRate > 100) {
      alerts.push(`ชีพจรเร็ว (${data.heartRate} bpm)`);
    } else if (data.heartRate < 60) {
      alerts.push(`ชีพจรช้า (${data.heartRate} bpm)`);
    }
  }

  // Temperature
  if (data.temperature) {
    if (data.temperature >= 37.5) {
      alerts.push(`มีไข้ (${data.temperature}°C)`);
    } else if (data.temperature < 36) {
      alerts.push(`อุณหภูมิต่ำ (${data.temperature}°C)`);
    }
  }

  // SpO2
  if (data.spo2) {
    if (data.spo2 < 95) {
      alerts.push(`ออกซิเจนในเลือดต่ำ (${data.spo2}%)`);
    }
  }

  // Glucose
  if (data.glucose) {
    if (data.glucose > 180) {
      alerts.push(`น้ำตาลสูง (${data.glucose} mg/dL)`);
    } else if (data.glucose < 70) {
      alerts.push(`น้ำตาลต่ำ (${data.glucose} mg/dL)`);
    }
  }

  return {
    isAbnormal: alerts.length > 0,
    alerts
  };
}
