/**
 * AI Health Data Extraction
 * Extract structured health data from Thai conversation text
 *
 * Uses OpenRouter API with AI_CONFIG model (see openrouter.service.ts)
 */

import { openRouterService, AI_CONFIG, ChatMessage } from '../../services/openrouter.service';
import { buildExtractionPrompt } from './prompts/extraction';
import { AIExtractedData } from '../../types/health.types';

// Uses AI_CONFIG.model from central config
const DEFAULT_EXTRACTION_MODEL = AI_CONFIG.model;

export interface ExtractionResult {
  success: boolean;
  data?: AIExtractedData;
  error?: string;
  rawResponse?: string;
}

export interface ExtractionOptions {
  patient?: any;
  conversationHistory?: Array<{ role: string; text: string }>;
  model?: string;
  temperature?: number;
}

/**
 * Extract health data from user message using Claude via OpenRouter
 */
export async function extractHealthData(
  message: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const {
    patient,
    conversationHistory = [],
    model = DEFAULT_EXTRACTION_MODEL,
    temperature = 0.1
  } = options;

  try {
    // Build system prompt with patient context
    const systemPrompt = buildExtractionPrompt(patient);

    // Build messages array for OpenRouter
    const messages: ChatMessage[] = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    // Add conversation history if available (last 5 messages)
    const recentHistory = conversationHistory.slice(-5);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // Call OpenRouter API
    const response = await openRouterService.createChatCompletion({
      model,
      messages,
      max_tokens: AI_CONFIG.maxTokens,
      temperature,
      response_format: { type: 'json_object' }
    });

    // Extract text content
    const rawResponse = response.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenRouter');
    }

    // Parse JSON response
    const extractedData = parseExtractionResponse(rawResponse);

    console.log(`✅ Extraction complete using ${model} (tokens: ${response.usage?.total_tokens || 'N/A'})`);

    return {
      success: true,
      data: extractedData,
      rawResponse
    };

  } catch (error: any) {
    console.error('AI extraction error:', error);
    return {
      success: false,
      error: error.message || 'Failed to extract health data'
    };
  }
}

/**
 * Parse Claude's JSON response into AIExtractedData
 */
function parseExtractionResponse(response: string): AIExtractedData {
  // Try to extract JSON from response
  let jsonStr = response.trim();

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Parse JSON
  const parsed = JSON.parse(jsonStr);

  // Normalize and validate
  return normalizeExtractedData(parsed);
}

/**
 * Normalize extracted data to ensure correct types
 */
function normalizeExtractedData(data: any): AIExtractedData {
  return {
    intent: data.intent || 'general_chat',

    symptoms: Array.isArray(data.symptoms) ? data.symptoms.map((s: any) => ({
      symptomName: s.symptom_name || s.symptomName || '',
      symptomNameEn: s.symptom_name_en || s.symptomNameEn || null,
      severity1to5: s.severity_1to5 || s.severity1to5 || null,
      bodyLocation: s.body_location || s.bodyLocation || null,
      durationText: s.duration_text || s.durationText || null,
      durationMinutes: s.duration_minutes || s.durationMinutes || null,
      timeOfDay: s.time_of_day || s.timeOfDay || null,
      triggers: s.triggers || null
    })) : [],

    vitals: data.vitals ? {
      bpSystolic: data.vitals.bp_systolic || data.vitals.bpSystolic || null,
      bpDiastolic: data.vitals.bp_diastolic || data.vitals.bpDiastolic || null,
      heartRate: data.vitals.heart_rate || data.vitals.heartRate || null,
      weight: data.vitals.weight || null,
      temperature: data.vitals.temperature || null,
      glucose: data.vitals.glucose || null,
      spo2: data.vitals.spo2 || null,
      measuredAtText: data.vitals.measured_at_text || data.vitals.measuredAtText || null
    } : undefined,

    mood: data.mood ? {
      mood: data.mood.mood || null,
      moodScore: data.mood.mood_score || data.mood.moodScore || null,
      stressLevel: data.mood.stress_level || data.mood.stressLevel || null,
      stressCause: data.mood.stress_cause || data.mood.stressCause || null,
      energyLevel: data.mood.energy_level || data.mood.energyLevel || null
    } : undefined,

    sleep: data.sleep ? {
      sleepHours: data.sleep.sleep_hours || data.sleep.sleepHours || null,
      sleepTime: data.sleep.sleep_time || data.sleep.sleepTime || null,
      wakeTime: data.sleep.wake_time || data.sleep.wakeTime || null,
      sleepQuality: data.sleep.sleep_quality || data.sleep.sleepQuality || null,
      wakeUps: data.sleep.wake_ups || data.sleep.wakeUps || null
    } : undefined,

    exercise: data.exercise ? {
      exerciseType: data.exercise.exercise_type || data.exercise.exerciseType || null,
      durationMinutes: data.exercise.duration_minutes || data.exercise.durationMinutes || null,
      intensity: data.exercise.intensity || null,
      timeOfDay: data.exercise.time_of_day || data.exercise.timeOfDay || null
    } : undefined,

    medication: data.medication ? {
      medicationName: data.medication.medication_name || data.medication.medicationName || null,
      taken: data.medication.taken ?? null,
      timeTaken: data.medication.time_taken || data.medication.timeTaken || null
    } : undefined,

    water: data.water ? {
      amountMl: data.water.amount_ml || data.water.amountMl || null
    } : undefined,

    confidence: data.confidence || 0.5,
    requiresFollowup: Boolean(data.requires_followup || data.requiresFollowup || false),
    followupQuestion: data.followup_question || data.followupQuestion || undefined
  };
}

/**
 * Check if extracted data has any health information
 */
export function hasHealthData(data: AIExtractedData): boolean {
  return Boolean(
    (data.symptoms && data.symptoms.length > 0) ||
    (data.vitals && Object.values(data.vitals).some(v => v !== null)) ||
    (data.mood && data.mood.mood !== null) ||
    (data.sleep && data.sleep.sleepHours !== null) ||
    (data.exercise && data.exercise.exerciseType !== null) ||
    (data.medication && data.medication.taken !== null) ||
    (data.water && data.water.amountMl !== null)
  );
}

/**
 * Get summary of extracted data for logging
 */
export function getExtractionSummary(data: AIExtractedData): string {
  const parts: string[] = [];

  if (data.symptoms && data.symptoms.length > 0) {
    parts.push(`อาการ: ${data.symptoms.map(s => s.symptomName).join(', ')}`);
  }

  if (data.vitals?.bpSystolic && data.vitals?.bpDiastolic) {
    parts.push(`ความดัน: ${data.vitals.bpSystolic}/${data.vitals.bpDiastolic}`);
  }

  if (data.vitals?.heartRate) {
    parts.push(`ชีพจร: ${data.vitals.heartRate}`);
  }

  if (data.mood?.mood) {
    parts.push(`อารมณ์: ${data.mood.mood}`);
  }

  if (data.sleep?.sleepHours) {
    parts.push(`นอน: ${data.sleep.sleepHours} ชม.`);
  }

  if (data.exercise?.exerciseType) {
    parts.push(`ออกกำลังกาย: ${data.exercise.exerciseType}`);
  }

  if (data.medication && data.medication.taken !== null && data.medication.taken !== undefined) {
    parts.push(`ยา: ${data.medication.taken ? 'ทานแล้ว' : 'ยังไม่ได้ทาน'}`);
  }

  if (data.water?.amountMl) {
    parts.push(`น้ำ: ${data.water.amountMl} ml`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'ไม่พบข้อมูลสุขภาพ';
}
