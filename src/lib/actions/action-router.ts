// src/lib/actions/action-router.ts
// Routes NLU results to appropriate database actions

import { supabaseService } from '../../services/supabase.service';
import { processExtractedData, ProcessorContext } from '../ai/processors';
import { createHealthEventsBatch, checkForAbnormalValues } from '../health/event-creator';
import {
  NLUResult,
  NLUContext,
  ActionResult,
  NLUHealthData,
  AbnormalAlert
} from '../../types/nlu.types';
import { AIExtractedData } from '../../types/health.types';

/**
 * Execute action based on NLU result
 */
export async function executeAction(
  nluResult: NLUResult,
  context: NLUContext
): Promise<ActionResult> {
  const { action, healthData, entities, intent } = nluResult;

  // Early return for no-action types
  if (action.type === 'none' || action.type === 'clarify') {
    return {
      success: true,
      savedRecords: 0,
      alerts: []
    };
  }

  // Require patientId for most actions
  if (!context.patientId && intent !== 'greeting' && intent !== 'general_chat') {
    return {
      success: false,
      savedRecords: 0,
      errors: ['ไม่พบข้อมูลผู้ป่วย กรุณาลงทะเบียนก่อนค่ะ']
    };
  }

  try {
    switch (action.type) {
      case 'save':
        return await handleSaveAction(nluResult, context);

      case 'update':
        return await handleUpdateAction(nluResult, context);

      case 'delete':
        return await handleDeleteAction(nluResult, context);

      case 'query':
        return await handleQueryAction(nluResult, context);

      case 'confirm':
        // Confirmation actions just return pending status
        return {
          success: true,
          savedRecords: 0,
          data: { pendingConfirmation: true, action: nluResult.action }
        };

      default:
        return {
          success: false,
          savedRecords: 0,
          errors: [`Unknown action type: ${action.type}`]
        };
    }
  } catch (error) {
    console.error('[ActionRouter] Error executing action:', error);
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    };
  }
}

/**
 * Handle save actions (new records)
 */
async function handleSaveAction(
  nluResult: NLUResult,
  context: NLUContext
): Promise<ActionResult> {
  const { healthData, action, entities } = nluResult;

  // Health log saves
  if (nluResult.intent === 'health_log' && healthData) {
    return await saveHealthData(healthData, context, nluResult.response);
  }

  // Profile update saves
  if (nluResult.intent === 'profile_update') {
    return await saveProfileUpdate(action.data || {}, context);
  }

  // Medication management
  if (nluResult.intent === 'medication_manage' && nluResult.subIntent === 'add') {
    return await saveMedication(action.data || {}, context);
  }

  // Reminder management
  if (nluResult.intent === 'reminder_manage' && nluResult.subIntent === 'add') {
    return await saveReminder(action.data || {}, context);
  }

  return {
    success: true,
    savedRecords: 0
  };
}

/**
 * Save health data to appropriate tables
 */
async function saveHealthData(
  healthData: NLUHealthData,
  context: NLUContext,
  rawText: string
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  // Convert NLU health data to AIExtractedData format for processors
  const extractedData = convertToExtractedData(healthData);

  const processorContext: ProcessorContext = {
    patientId: context.patientId,
    rawText: rawText,
    aiConfidence: 0.9 // NLU extractions are high confidence
  };

  const result = await processExtractedData(extractedData, processorContext);

  // Check for abnormal values
  const alerts: string[] = [];
  if (healthData.vitals) {
    const abnormalAlerts = checkForAbnormalVitals(healthData.vitals);
    alerts.push(...abnormalAlerts.map(a => a.message));
  }

  return {
    success: result.success,
    savedRecords: result.savedRecords.length,
    data: {
      savedRecords: result.savedRecords,
      healthEventIds: result.healthEventIds
    },
    alerts,
    errors: result.error ? [result.error] : undefined
  };
}

/**
 * Convert NLU health data to AIExtractedData format
 */
function convertToExtractedData(healthData: NLUHealthData): AIExtractedData {
  // Map NLU health type to AIIntent
  const intentMap: Record<string, import('../../types/health.types').AIIntent> = {
    'medication': 'report_medication',
    'vitals': 'report_vital',
    'water': 'report_water',
    'exercise': 'report_exercise',
    'sleep': 'report_sleep',
    'symptom': 'report_symptom',
    'mood': 'report_mood',
    'food': 'general_chat'
  };

  const extracted: AIExtractedData = {
    intent: intentMap[healthData.type] || 'general_chat',
    confidence: 0.9,
    requiresFollowup: false
  };

  switch (healthData.type) {
    case 'medication':
      if (healthData.medication) {
        extracted.medication = {
          medicationName: healthData.medication.medicationName || undefined,
          taken: healthData.medication.taken,
          timeTaken: healthData.medication.time || undefined
        };
      }
      break;

    case 'vitals':
      if (healthData.vitals) {
        extracted.vitals = {
          bpSystolic: healthData.vitals.bloodPressure?.systolic,
          bpDiastolic: healthData.vitals.bloodPressure?.diastolic,
          heartRate: healthData.vitals.heartRate,
          weight: healthData.vitals.weight,
          temperature: healthData.vitals.temperature,
          glucose: healthData.vitals.bloodSugar,
          spo2: healthData.vitals.oxygenSaturation,
          measuredAtText: undefined
        };
      }
      break;

    case 'water':
      if (healthData.water) {
        extracted.water = {
          amountMl: healthData.water.amount_ml || (healthData.water.glasses ? healthData.water.glasses * 250 : undefined)
        };
      }
      break;

    case 'exercise':
      if (healthData.exercise) {
        // Map NLU intensity to ExerciseIntensity
        const intensityMap: Record<string, 'light' | 'medium' | 'intense'> = {
          'light': 'light',
          'moderate': 'medium',
          'vigorous': 'intense'
        };
        extracted.exercise = {
          exerciseType: healthData.exercise.type,
          durationMinutes: healthData.exercise.duration_minutes,
          intensity: healthData.exercise.intensity ? intensityMap[healthData.exercise.intensity] : undefined,
          timeOfDay: undefined
        };
      }
      break;

    case 'sleep':
      if (healthData.sleep) {
        extracted.sleep = {
          sleepHours: healthData.sleep.duration_hours,
          sleepTime: healthData.sleep.bedTime,
          wakeTime: healthData.sleep.wakeTime,
          sleepQuality: healthData.sleep.quality as 'poor' | 'fair' | 'good' | undefined,
          wakeUps: undefined
        };
      }
      break;

    case 'symptom':
      if (healthData.symptom) {
        extracted.symptoms = [{
          symptomName: healthData.symptom.symptom,
          symptomNameEn: undefined,
          severity1to5: healthData.symptom.severity === 'severe' ? 5 :
                        healthData.symptom.severity === 'moderate' ? 3 : 1,
          bodyLocation: healthData.symptom.location,
          durationText: healthData.symptom.duration,
          durationMinutes: undefined,
          timeOfDay: undefined,
          triggers: undefined
        }];
      }
      break;

    case 'mood':
      if (healthData.mood) {
        // Map mood string to MoodType
        const moodMap: Record<string, import('../../types/health.types').MoodType> = {
          'happy': 'happy',
          'ดี': 'happy',
          'สดใส': 'happy',
          'neutral': 'neutral',
          'เฉยๆ': 'neutral',
          'tired': 'tired',
          'เหนื่อย': 'tired',
          'sad': 'sad',
          'เศร้า': 'sad',
          'anxious': 'anxious',
          'กังวล': 'anxious',
          'stressed': 'stressed',
          'เครียด': 'stressed',
          'calm': 'calm',
          'สงบ': 'calm',
          'exhausted': 'exhausted'
        };

        // Map stress/energy level numbers to strings
        const levelMap = (level: number | undefined): 'low' | 'medium' | 'high' | undefined => {
          if (level === undefined) return undefined;
          if (level <= 3) return 'low';
          if (level <= 6) return 'medium';
          return 'high';
        };

        extracted.mood = {
          mood: moodMap[healthData.mood.mood] || 'neutral',
          moodScore: undefined,
          stressLevel: levelMap(healthData.mood.stressLevel),
          stressCause: undefined,
          energyLevel: levelMap(healthData.mood.energyLevel)
        };
      }
      break;

    case 'food':
      // Food is typically logged as activity
      extracted.medication = {
        medicationName: `อาหาร${healthData.food?.mealType ? ` (${healthData.food.mealType})` : ''}`,
        taken: true,
        timeTaken: undefined
      };
      break;
  }

  return extracted;
}

/**
 * Check for abnormal vital values
 */
function checkForAbnormalVitals(vitals: NonNullable<NLUHealthData['vitals']>): AbnormalAlert[] {
  const alerts: AbnormalAlert[] = [];

  // Blood pressure checks
  if (vitals.bloodPressure) {
    const { systolic, diastolic } = vitals.bloodPressure;

    if (systolic >= 180 || diastolic >= 120) {
      alerts.push({
        type: 'blood_pressure',
        value: `${systolic}/${diastolic}`,
        severity: 'critical',
        message: `ความดัน ${systolic}/${diastolic} สูงมาก! ควรพบแพทย์ทันทีค่ะ`
      });
    } else if (systolic >= 140 || diastolic >= 90) {
      alerts.push({
        type: 'blood_pressure',
        value: `${systolic}/${diastolic}`,
        severity: 'warning',
        message: `ความดัน ${systolic}/${diastolic} สูงกว่าปกตินิดหน่อย ดูแลตัวเองด้วยนะคะ`
      });
    } else if (systolic < 90 || diastolic < 60) {
      alerts.push({
        type: 'blood_pressure',
        value: `${systolic}/${diastolic}`,
        severity: 'warning',
        message: `ความดัน ${systolic}/${diastolic} ต่ำกว่าปกติ ถ้ามีอาการวิงเวียนให้พักผ่อนนะคะ`
      });
    }
  }

  // Heart rate checks
  if (vitals.heartRate) {
    if (vitals.heartRate > 100) {
      alerts.push({
        type: 'heart_rate',
        value: vitals.heartRate.toString(),
        severity: 'warning',
        message: `ชีพจร ${vitals.heartRate} ครั้ง/นาที เร็วกว่าปกติ พักผ่อนให้เพียงพอนะคะ`
      });
    } else if (vitals.heartRate < 60) {
      alerts.push({
        type: 'heart_rate',
        value: vitals.heartRate.toString(),
        severity: 'warning',
        message: `ชีพจร ${vitals.heartRate} ครั้ง/นาที ช้ากว่าปกติ ถ้ามีอาการผิดปกติควรพบแพทย์ค่ะ`
      });
    }
  }

  // Blood sugar checks
  if (vitals.bloodSugar) {
    if (vitals.bloodSugar > 180) {
      alerts.push({
        type: 'blood_sugar',
        value: vitals.bloodSugar.toString(),
        severity: 'warning',
        message: `น้ำตาล ${vitals.bloodSugar} mg/dL สูงกว่าปกติ ระวังอาหารและกินยาให้ครบนะคะ`
      });
    } else if (vitals.bloodSugar < 70) {
      alerts.push({
        type: 'blood_sugar',
        value: vitals.bloodSugar.toString(),
        severity: 'critical',
        message: `น้ำตาล ${vitals.bloodSugar} mg/dL ต่ำมาก! กินอะไรหวานๆ เช่น น้ำหวาน ลูกอม ทันทีค่ะ`
      });
    }
  }

  // Oxygen saturation checks
  if (vitals.oxygenSaturation) {
    if (vitals.oxygenSaturation < 95) {
      alerts.push({
        type: 'oxygen',
        value: vitals.oxygenSaturation.toString(),
        severity: vitals.oxygenSaturation < 90 ? 'critical' : 'warning',
        message: vitals.oxygenSaturation < 90
          ? `ออกซิเจน ${vitals.oxygenSaturation}% ต่ำมาก! ควรพบแพทย์ทันทีค่ะ`
          : `ออกซิเจน ${vitals.oxygenSaturation}% ต่ำกว่าปกติ พักผ่อนและหายใจลึกๆ นะคะ`
      });
    }
  }

  return alerts;
}

/**
 * Handle update actions
 */
async function handleUpdateAction(
  nluResult: NLUResult,
  context: NLUContext
): Promise<ActionResult> {
  const { action } = nluResult;

  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  // Profile updates
  if (nluResult.intent === 'profile_update') {
    return await saveProfileUpdate(action.data || {}, context);
  }

  // Medication updates
  if (nluResult.intent === 'medication_manage' && nluResult.subIntent === 'edit') {
    return await updateMedication(action.data || {}, context);
  }

  // Reminder updates
  if (nluResult.intent === 'reminder_manage' && nluResult.subIntent === 'edit') {
    return await updateReminder(action.data || {}, context);
  }

  return { success: true, savedRecords: 0 };
}

/**
 * Handle delete actions
 */
async function handleDeleteAction(
  nluResult: NLUResult,
  context: NLUContext
): Promise<ActionResult> {
  const { action } = nluResult;

  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  // Medication deletion
  if (nluResult.intent === 'medication_manage' && nluResult.subIntent === 'delete') {
    return await deleteMedication(action.data || {}, context);
  }

  // Reminder deletion
  if (nluResult.intent === 'reminder_manage' && nluResult.subIntent === 'delete') {
    return await deleteReminder(action.data || {}, context);
  }

  return { success: true, savedRecords: 0 };
}

/**
 * Handle query actions
 */
async function handleQueryAction(
  nluResult: NLUResult,
  context: NLUContext
): Promise<ActionResult> {
  // Queries are handled by generating response, not database actions
  // The response is already generated by Claude in nluResult.response
  return {
    success: true,
    savedRecords: 0,
    data: { queryExecuted: true }
  };
}

// ========================================
// Profile Operations
// ========================================

async function saveProfileUpdate(
  data: Record<string, any>,
  context: NLUContext
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  try {
    const client = supabaseService.getClient();

    // Build update object from data
    const updateData: Record<string, any> = {};

    // Name fields
    if (data.firstName) updateData.first_name = data.firstName;
    if (data.lastName) updateData.last_name = data.lastName;
    if (data.nickname) updateData.nickname = data.nickname;

    // Basic info
    if (data.weight) updateData.weight_kg = data.weight;
    if (data.height) updateData.height_cm = data.height;
    if (data.phone) updateData.phone = data.phone;
    if (data.address) updateData.address = data.address;
    if (data.bloodType) updateData.blood_type = data.bloodType;
    if (data.dateOfBirth) updateData.date_of_birth = data.dateOfBirth;
    if (data.gender) updateData.gender = data.gender;

    // Medical info
    if (data.medicalCondition) updateData.medical_condition = data.medicalCondition;
    if (data.drugAllergies) updateData.drug_allergies = data.drugAllergies;
    if (data.foodAllergies) updateData.food_allergies = data.foodAllergies;
    if (data.emergencyContact) updateData.emergency_contact = data.emergencyContact;

    if (Object.keys(updateData).length === 0) {
      return { success: true, savedRecords: 0 };
    }

    updateData.updated_at = new Date().toISOString();

    const { error } = await client
      .from('patient_profiles')
      .update(updateData)
      .eq('id', context.patientId);

    if (error) throw error;

    return { success: true, savedRecords: 1 };
  } catch (error) {
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Failed to update profile']
    };
  }
}

// ========================================
// Medication Operations
// ========================================

async function saveMedication(
  data: Record<string, any>,
  context: NLUContext
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  try {
    const client = supabaseService.getClient();

    const { error } = await client
      .from('medications')
      .insert({
        patient_id: context.patientId,
        medication_name: data.name,
        dosage_amount: data.dosage,
        dosage_unit: data.unit || 'mg',
        frequency: data.frequency || 'daily',
        times: data.times || [],
        is_active: true,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true, savedRecords: 1 };
  } catch (error) {
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Failed to save medication']
    };
  }
}

async function updateMedication(
  data: Record<string, any>,
  context: NLUContext
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  // Need either medicationId or medicationName to find the medication
  if (!data.medicationId && !data.medicationName) {
    return { success: false, savedRecords: 0, errors: ['ไม่ทราบว่าจะแก้ยาตัวไหนค่ะ'] };
  }

  try {
    const client = supabaseService.getClient();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name) updateData.medication_name = data.name;
    if (data.dosage) updateData.dosage_amount = data.dosage;
    if (data.unit) updateData.dosage_unit = data.unit;
    if (data.frequency) updateData.frequency = data.frequency;
    if (data.times) updateData.times = data.times;

    if (Object.keys(updateData).length === 1) {
      // Only updated_at, nothing to update
      return { success: true, savedRecords: 0 };
    }

    // Update by ID or by name
    let query = client
      .from('medications')
      .update(updateData)
      .eq('patient_id', context.patientId)
      .eq('is_active', true);

    if (data.medicationId) {
      query = query.eq('id', data.medicationId);
    } else if (data.medicationName) {
      query = query.ilike('medication_name', `%${data.medicationName}%`);
    }

    const { error } = await query;

    if (error) throw error;

    return { success: true, savedRecords: 1 };
  } catch (error) {
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Failed to update medication']
    };
  }
}

async function deleteMedication(
  data: Record<string, any>,
  context: NLUContext
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  try {
    const client = supabaseService.getClient();

    // If medication name is provided, find and deactivate
    if (data.medicationName) {
      const { error } = await client
        .from('medications')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('patient_id', context.patientId)
        .ilike('medication_name', `%${data.medicationName}%`);

      if (error) throw error;
    } else if (data.medicationId) {
      const { error } = await client
        .from('medications')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', data.medicationId)
        .eq('patient_id', context.patientId);

      if (error) throw error;
    }

    return { success: true, savedRecords: 1 };
  } catch (error) {
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Failed to delete medication']
    };
  }
}

// ========================================
// Reminder Operations
// ========================================

async function saveReminder(
  data: Record<string, any>,
  context: NLUContext
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  try {
    const client = supabaseService.getClient();

    const { error } = await client
      .from('reminders')
      .insert({
        patient_id: context.patientId,
        reminder_type: data.type || 'custom',
        message: data.message || 'เตือนความจำ',
        custom_time: data.time,
        is_active: true,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true, savedRecords: 1 };
  } catch (error) {
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Failed to save reminder']
    };
  }
}

async function updateReminder(
  data: Record<string, any>,
  context: NLUContext
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  // Need either reminderId or type to find the reminder
  if (!data.reminderId && !data.type && !data.oldTime) {
    return { success: false, savedRecords: 0, errors: ['ไม่ทราบว่าจะแก้เตือนตัวไหนค่ะ'] };
  }

  try {
    const client = supabaseService.getClient();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.newTime || data.time) updateData.custom_time = data.newTime || data.time;
    if (data.message) updateData.message = data.message;
    if (data.newType) updateData.reminder_type = data.newType;

    if (Object.keys(updateData).length === 1) {
      return { success: true, savedRecords: 0 };
    }

    // Build query
    let query = client
      .from('reminders')
      .update(updateData)
      .eq('patient_id', context.patientId)
      .eq('is_active', true);

    if (data.reminderId) {
      query = query.eq('id', data.reminderId);
    } else {
      if (data.type) query = query.eq('reminder_type', data.type);
      if (data.oldTime) query = query.eq('custom_time', data.oldTime);
    }

    const { error } = await query;

    if (error) throw error;

    return { success: true, savedRecords: 1 };
  } catch (error) {
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Failed to update reminder']
    };
  }
}

async function deleteReminder(
  data: Record<string, any>,
  context: NLUContext
): Promise<ActionResult> {
  if (!context.patientId) {
    return { success: false, savedRecords: 0, errors: ['No patient ID'] };
  }

  try {
    const client = supabaseService.getClient();

    // Build query for deactivating reminder
    let query = client
      .from('reminders')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('patient_id', context.patientId)
      .eq('is_active', true);

    if (data.reminderId) {
      query = query.eq('id', data.reminderId);
    } else if (data.type || data.time) {
      if (data.type) query = query.eq('reminder_type', data.type);
      if (data.time) query = query.eq('custom_time', data.time);
    } else {
      return { success: false, savedRecords: 0, errors: ['ไม่ทราบว่าจะลบเตือนตัวไหนค่ะ'] };
    }

    const { error } = await query;

    if (error) throw error;

    return { success: true, savedRecords: 1 };
  } catch (error) {
    return {
      success: false,
      savedRecords: 0,
      errors: [error instanceof Error ? error.message : 'Failed to delete reminder']
    };
  }
}

export default {
  executeAction
};
