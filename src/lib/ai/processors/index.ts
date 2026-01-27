/**
 * Health Data Processors
 * Process extracted data and save to database
 */

import { supabaseService } from '../../../services/supabase.service';
import {
  AIExtractedData,
  SymptomInsert,
  SleepLogInsert,
  ExerciseLogInsert,
  HealthEventInsert,
  MedicationLogInsert,
  WaterLogInsert,
  ExtractedSymptom,
  ExtractedVitals,
  ExtractedMood,
  ExtractedSleep,
  ExtractedExercise
} from '../../../types/health.types';

export interface ProcessorContext {
  patientId: string;
  conversationLogId?: string;
  activityLogId?: string;
  rawText: string;
  aiConfidence: number;
}

export interface ProcessorResult {
  success: boolean;
  savedRecords: {
    type: string;
    id: string;
    summary: string;
  }[];
  healthEventIds: string[];
  error?: string;
}

/**
 * Process all extracted health data and save to database
 */
export async function processExtractedData(
  data: AIExtractedData,
  context: ProcessorContext
): Promise<ProcessorResult> {
  const savedRecords: { type: string; id: string; summary: string }[] = [];
  const healthEventIds: string[] = [];

  try {
    // Process symptoms
    if (data.symptoms && data.symptoms.length > 0) {
      for (const symptom of data.symptoms) {
        const result = await processSymptom(symptom, context);
        if (result.recordId) {
          savedRecords.push({
            type: 'symptom',
            id: result.recordId,
            summary: result.summary
          });
          if (result.healthEventId) {
            healthEventIds.push(result.healthEventId);
          }
        }
      }
    }

    // Process vitals
    if (data.vitals && hasVitalsData(data.vitals)) {
      const result = await processVitals(data.vitals, context);
      if (result.recordId) {
        savedRecords.push({
          type: 'vital',
          id: result.recordId,
          summary: result.summary
        });
        if (result.healthEventId) {
          healthEventIds.push(result.healthEventId);
        }
      }
    }

    // Process mood
    if (data.mood && data.mood.mood) {
      const result = await processMood(data.mood, context);
      if (result.recordId) {
        savedRecords.push({
          type: 'mood',
          id: result.recordId,
          summary: result.summary
        });
        if (result.healthEventId) {
          healthEventIds.push(result.healthEventId);
        }
      }
    }

    // Process sleep
    if (data.sleep && data.sleep.sleepHours) {
      const result = await processSleep(data.sleep, context);
      if (result.recordId) {
        savedRecords.push({
          type: 'sleep',
          id: result.recordId,
          summary: result.summary
        });
        if (result.healthEventId) {
          healthEventIds.push(result.healthEventId);
        }
      }
    }

    // Process exercise
    if (data.exercise && data.exercise.exerciseType) {
      const result = await processExercise(data.exercise, context);
      if (result.recordId) {
        savedRecords.push({
          type: 'exercise',
          id: result.recordId,
          summary: result.summary
        });
        if (result.healthEventId) {
          healthEventIds.push(result.healthEventId);
        }
      }
    }

    // Process medication (save to activity_logs)
    if (data.medication && data.medication.taken !== null) {
      const result = await processMedication(data.medication, context);
      if (result.recordId) {
        savedRecords.push({
          type: 'medication',
          id: result.recordId,
          summary: result.summary
        });
        if (result.healthEventId) {
          healthEventIds.push(result.healthEventId);
        }
      }
    }

    // Process water (save to activity_logs)
    if (data.water && data.water.amountMl) {
      const result = await processWater(data.water, context);
      if (result.recordId) {
        savedRecords.push({
          type: 'water',
          id: result.recordId,
          summary: result.summary
        });
        if (result.healthEventId) {
          healthEventIds.push(result.healthEventId);
        }
      }
    }

    return {
      success: true,
      savedRecords,
      healthEventIds
    };

  } catch (error: any) {
    console.error('Error processing extracted data:', error);
    return {
      success: false,
      savedRecords,
      healthEventIds,
      error: error.message
    };
  }
}

// ========================================
// Individual Processors
// ========================================

interface ProcessResult {
  recordId?: string;
  healthEventId?: string;
  summary: string;
}

async function processSymptom(
  symptom: ExtractedSymptom,
  context: ProcessorContext
): Promise<ProcessResult> {
  const now = new Date().toISOString();
  const insert: SymptomInsert = {
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    activity_log_id: context.activityLogId,
    symptom_name: symptom.symptomName,
    symptom_name_en: symptom.symptomNameEn || undefined,
    severity_1to5: symptom.severity1to5 || undefined,
    body_location: symptom.bodyLocation || undefined,
    duration_text: symptom.durationText || undefined,
    duration_minutes: symptom.durationMinutes || undefined,
    time_of_day: symptom.timeOfDay || undefined,
    triggers: symptom.triggers || undefined,
    ai_confidence: context.aiConfidence,
    raw_text: context.rawText
  };

  // Add created_at to insert data
  const insertWithTimestamp = { ...insert, created_at: now };
  const recordId = await supabaseService.saveSymptom(insertWithTimestamp as any);

  // Create health event
  const healthEventId = await createHealthEvent({
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    event_type: 'symptom',
    event_subtype: symptom.symptomName,
    reference_table: 'symptoms',
    reference_id: recordId,
    raw_text: context.rawText,
    ai_confidence: context.aiConfidence,
    summary_text: `${symptom.symptomName}${symptom.severity1to5 ? ` (${symptom.severity1to5}/5)` : ''}`
  });

  return {
    recordId,
    healthEventId,
    summary: symptom.symptomName
  };
}

async function processVitals(
  vitals: ExtractedVitals,
  context: ProcessorContext
): Promise<ProcessResult> {
  const vitalsData: any = {
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    source: 'text',
    ai_confidence: context.aiConfidence,
    raw_text: context.rawText,
    measured_at: new Date().toISOString()
  };

  if (vitals.bpSystolic) vitalsData.bp_systolic = vitals.bpSystolic;
  if (vitals.bpDiastolic) vitalsData.bp_diastolic = vitals.bpDiastolic;
  if (vitals.heartRate) vitalsData.heart_rate = vitals.heartRate;
  if (vitals.weight) vitalsData.weight = vitals.weight;
  if (vitals.temperature) vitalsData.temperature = vitals.temperature;
  if (vitals.glucose) vitalsData.glucose = vitals.glucose;
  if (vitals.spo2) vitalsData.spo2 = vitals.spo2;
  if (vitals.measuredAtText) vitalsData.measured_at_text = vitals.measuredAtText;

  const recordId = await supabaseService.saveVitalsLog(vitalsData);

  // Build summary
  const summaryParts: string[] = [];
  if (vitals.bpSystolic && vitals.bpDiastolic) {
    summaryParts.push(`BP ${vitals.bpSystolic}/${vitals.bpDiastolic}`);
  }
  if (vitals.heartRate) summaryParts.push(`HR ${vitals.heartRate}`);
  if (vitals.weight) summaryParts.push(`${vitals.weight} kg`);

  // Create health event
  const healthEventId = await createHealthEvent({
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    event_type: 'vital',
    event_subtype: vitals.bpSystolic ? 'blood_pressure' : 'other',
    reference_table: 'vitals_logs',
    reference_id: recordId,
    raw_text: context.rawText,
    ai_confidence: context.aiConfidence,
    summary_text: summaryParts.join(', ')
  });

  return {
    recordId,
    healthEventId,
    summary: summaryParts.join(', ')
  };
}

async function processMood(
  mood: ExtractedMood,
  context: ProcessorContext
): Promise<ProcessResult> {
  const moodData: any = {
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    mood: mood.mood,
    mood_score: mood.moodScore || null,
    stress_level: mood.stressLevel || null,
    stress_cause: mood.stressCause || null,
    energy_level: mood.energyLevel || null,
    ai_confidence: context.aiConfidence,
    raw_text: context.rawText,
    timestamp: new Date().toISOString()
  };

  const recordId = await supabaseService.saveMoodLog(moodData);

  const summary = `${mood.mood}${mood.stressLevel ? `, stress: ${mood.stressLevel}` : ''}`;

  // Create health event
  const healthEventId = await createHealthEvent({
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    event_type: 'mood',
    event_subtype: mood.mood || undefined,
    reference_table: 'mood_logs',
    reference_id: recordId,
    raw_text: context.rawText,
    ai_confidence: context.aiConfidence,
    summary_text: summary
  });

  return {
    recordId,
    healthEventId,
    summary
  };
}

async function processSleep(
  sleep: ExtractedSleep,
  context: ProcessorContext
): Promise<ProcessResult> {
  const insert: SleepLogInsert = {
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    sleep_date: new Date().toISOString().split('T')[0],
    sleep_hours: sleep.sleepHours || undefined,
    sleep_time: sleep.sleepTime || undefined,
    wake_time: sleep.wakeTime || undefined,
    sleep_quality: sleep.sleepQuality || undefined,
    wake_ups: sleep.wakeUps || undefined,
    ai_confidence: context.aiConfidence,
    raw_text: context.rawText
  };

  const recordId = await supabaseService.saveSleepLog(insert);

  const summary = `${sleep.sleepHours} ชม.${sleep.sleepQuality ? ` (${sleep.sleepQuality})` : ''}`;

  // Create health event
  const healthEventId = await createHealthEvent({
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    event_type: 'sleep',
    reference_table: 'sleep_logs',
    reference_id: recordId,
    raw_text: context.rawText,
    ai_confidence: context.aiConfidence,
    summary_text: summary
  });

  return {
    recordId,
    healthEventId,
    summary
  };
}

async function processExercise(
  exercise: ExtractedExercise,
  context: ProcessorContext
): Promise<ProcessResult> {
  const insert: ExerciseLogInsert = {
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    exercise_date: new Date().toISOString().split('T')[0],
    exercise_type: exercise.exerciseType || undefined,
    duration_minutes: exercise.durationMinutes || undefined,
    intensity: exercise.intensity || undefined,
    time_of_day: exercise.timeOfDay || undefined,
    ai_confidence: context.aiConfidence,
    raw_text: context.rawText
  };

  const recordId = await supabaseService.saveExerciseLog(insert);

  const summary = `${exercise.exerciseType}${exercise.durationMinutes ? ` ${exercise.durationMinutes} นาที` : ''}`;

  // Create health event
  const healthEventId = await createHealthEvent({
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    event_type: 'exercise',
    event_subtype: exercise.exerciseType || undefined,
    reference_table: 'exercise_logs',
    reference_id: recordId,
    raw_text: context.rawText,
    ai_confidence: context.aiConfidence,
    summary_text: summary
  });

  return {
    recordId,
    healthEventId,
    summary
  };
}

async function processMedication(
  medication: { medicationName?: string; taken?: boolean; timeTaken?: string },
  context: ProcessorContext
): Promise<ProcessResult> {
  const now = new Date().toISOString();
  const summary = `${medication.medicationName || 'ยา'}: ${medication.taken ? 'ทานแล้ว' : 'ยังไม่ได้ทาน'}`;

  // Primary: Save to medication_logs
  const medLogInsert: MedicationLogInsert = {
    patient_id: context.patientId,
    medication_name: medication.medicationName || 'ยา',
    taken_at: now,
    status: medication.taken ? 'taken' : 'skipped',
    ai_confidence: context.aiConfidence,
    raw_text: context.rawText,
    conversation_log_id: context.conversationLogId
  };

  const recordId = await supabaseService.saveMedicationLog(medLogInsert);

  // Dual-write: Also save to activity_logs for backwards compatibility
  const client = supabaseService.getClient();
  try {
    await client
      .from('activity_logs')
      .insert({
        patient_id: context.patientId,
        task_type: 'medication',
        value: medication.medicationName || 'ยา',
        metadata: {
          medication_name: medication.medicationName,
          taken: medication.taken,
          time_taken: medication.timeTaken,
          ai_extracted: true,
          medication_log_id: recordId
        },
        ai_confidence: context.aiConfidence,
        raw_text: context.rawText,
        timestamp: now
      });
  } catch (e) {
    console.warn('Dual-write to activity_logs failed (non-critical):', e);
  }

  // Create health event
  const healthEventId = await createHealthEvent({
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    event_type: 'medication',
    event_subtype: medication.medicationName || undefined,
    reference_table: 'medication_logs',
    reference_id: recordId,
    raw_text: context.rawText,
    ai_confidence: context.aiConfidence,
    summary_text: summary
  });

  return {
    recordId,
    healthEventId,
    summary
  };
}

async function processWater(
  water: { amountMl?: number },
  context: ProcessorContext
): Promise<ProcessResult> {
  const now = new Date().toISOString();
  const amountMl = water.amountMl || 0;
  const summary = `${amountMl} ml`;

  // Primary: Save to water_logs
  const waterLogInsert: WaterLogInsert = {
    patient_id: context.patientId,
    log_date: now.split('T')[0],
    amount_ml: amountMl,
    glasses: Math.round(amountMl / 250),
    ai_confidence: context.aiConfidence,
    raw_text: context.rawText,
    conversation_log_id: context.conversationLogId
  };

  const recordId = await supabaseService.saveWaterLog(waterLogInsert);

  // Dual-write: Also save to activity_logs for backwards compatibility
  const client = supabaseService.getClient();
  try {
    await client
      .from('activity_logs')
      .insert({
        patient_id: context.patientId,
        task_type: 'water',
        value: amountMl.toString(),
        metadata: {
          amount_ml: amountMl,
          unit: 'ml',
          ai_extracted: true,
          water_log_id: recordId
        },
        ai_confidence: context.aiConfidence,
        raw_text: context.rawText,
        timestamp: now
      });
  } catch (e) {
    console.warn('Dual-write to activity_logs failed (non-critical):', e);
  }

  // Create health event
  const healthEventId = await createHealthEvent({
    patient_id: context.patientId,
    conversation_log_id: context.conversationLogId,
    event_type: 'water',
    reference_table: 'water_logs',
    reference_id: recordId,
    raw_text: context.rawText,
    ai_confidence: context.aiConfidence,
    summary_text: summary
  });

  return {
    recordId,
    healthEventId,
    summary
  };
}

// ========================================
// Helper Functions
// ========================================

async function createHealthEvent(event: HealthEventInsert): Promise<string> {
  return await supabaseService.saveHealthEvent({
    ...event,
    event_date: new Date().toISOString().split('T')[0],
    event_timestamp: new Date().toISOString()
  });
}

function hasVitalsData(vitals: ExtractedVitals): boolean {
  return !!(
    vitals.bpSystolic ||
    vitals.bpDiastolic ||
    vitals.heartRate ||
    vitals.weight ||
    vitals.temperature ||
    vitals.glucose ||
    vitals.spo2
  );
}
