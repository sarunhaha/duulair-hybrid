/**
 * AI Health Extraction Pipeline
 * Main entry point for AI-powered health data extraction
 */

import { extractHealthData, hasHealthData, getExtractionSummary, ExtractionResult } from './extraction';
import { processExtractedData, ProcessorResult, ProcessorContext } from './processors';
import { supabaseService } from '../../services/supabase.service';
import { AI_CONFIG } from '../../services/openrouter.service';
import { checkForAbnormalValues } from '../health/event-creator';
import { AIExtractedData } from '../../types/health.types';

export interface HealthExtractionPipelineOptions {
  patientId: string;
  patient?: any;
  groupId?: string;
  lineUserId?: string;
  displayName?: string;
  conversationHistory?: Array<{ role: string; text: string }>;
}

export interface HealthExtractionPipelineResult {
  success: boolean;
  hasHealthData: boolean;
  extractedData?: AIExtractedData;
  processorResult?: ProcessorResult;
  responseMessage?: string;
  followupQuestion?: string;
  alerts?: string[];
  conversationLogId?: string;
  error?: string;
}

/**
 * Main pipeline: Extract health data from message and save to database
 */
export async function runHealthExtractionPipeline(
  message: string,
  options: HealthExtractionPipelineOptions
): Promise<HealthExtractionPipelineResult> {
  const { patientId, patient, groupId, lineUserId, displayName, conversationHistory } = options;

  try {
    // Step 1: Save conversation log (user message)
    const conversationLogId = await supabaseService.saveConversationLog({
      patientId: patientId,
      groupId: groupId,
      role: 'user',
      text: message,
      source: groupId ? 'group' : '1:1'
    } as any);

    // Step 2: Extract health data using AI
    const extractionResult: ExtractionResult = await extractHealthData(message, {
      patient,
      conversationHistory
    });

    if (!extractionResult.success || !extractionResult.data) {
      return {
        success: false,
        hasHealthData: false,
        conversationLogId,
        error: extractionResult.error || 'Extraction failed'
      };
    }

    const extractedData = extractionResult.data;
    const hasData = hasHealthData(extractedData);

    // Step 3: Update conversation log with extracted data
    await supabaseService.updateConversationLog(conversationLogId, {
      intent: extractedData.intent,
      aiExtractedData: extractedData,
      aiConfidence: extractedData.confidence,
      aiModel: AI_CONFIG.model
    } as any);

    // Step 4: Process and save health data if found
    let processorResult: ProcessorResult | undefined;
    let alerts: string[] = [];

    if (hasData) {
      const context: ProcessorContext = {
        patientId,
        conversationLogId,
        rawText: message,
        aiConfidence: extractedData.confidence
      };

      processorResult = await processExtractedData(extractedData, context);

      // Check for abnormal values
      if (extractedData.vitals) {
        const abnormalCheck = checkForAbnormalValues({
          bpSystolic: extractedData.vitals.bpSystolic || undefined,
          bpDiastolic: extractedData.vitals.bpDiastolic || undefined,
          heartRate: extractedData.vitals.heartRate || undefined,
          temperature: extractedData.vitals.temperature || undefined,
          spo2: extractedData.vitals.spo2 || undefined,
          glucose: extractedData.vitals.glucose || undefined
        });

        if (abnormalCheck.isAbnormal) {
          alerts = abnormalCheck.alerts;
        }
      }
    }

    // Step 5: Generate response message
    const responseMessage = generateResponseMessage(extractedData, processorResult, alerts);

    return {
      success: true,
      hasHealthData: hasData,
      extractedData,
      processorResult,
      responseMessage,
      followupQuestion: extractedData.followupQuestion || undefined,
      alerts: alerts.length > 0 ? alerts : undefined,
      conversationLogId
    };

  } catch (error: any) {
    console.error('Health extraction pipeline error:', error);
    return {
      success: false,
      hasHealthData: false,
      error: error.message || 'Pipeline error'
    };
  }
}

/**
 * Generate response message based on extracted data
 */
function generateResponseMessage(
  data: AIExtractedData,
  processorResult?: ProcessorResult,
  alerts?: string[]
): string {
  const parts: string[] = [];

  // Acknowledge what was recorded
  if (processorResult?.savedRecords && processorResult.savedRecords.length > 0) {
    const recordSummaries = processorResult.savedRecords.map(r => r.summary);
    parts.push(`บันทึกแล้วค่ะ: ${recordSummaries.join(', ')}`);
  }

  // Add alerts if any
  if (alerts && alerts.length > 0) {
    parts.push(`\n\n⚠️ แจ้งเตือน: ${alerts.join(', ')} - กรุณาปรึกษาแพทย์หากมีอาการผิดปกติค่ะ`);
  }

  // Add followup question if needed
  if (data.requiresFollowup && data.followupQuestion) {
    parts.push(`\n\n${data.followupQuestion}`);
  }

  // Default response if nothing was recorded
  if (parts.length === 0) {
    if (data.intent === 'greeting') {
      return 'สวัสดีค่ะ อุ่นใจพร้อมช่วยดูแลสุขภาพนะคะ';
    } else if (data.intent === 'question') {
      return 'มีคำถามอะไรให้อุ่นใจช่วยไหมคะ?';
    }
    return 'รับทราบค่ะ';
  }

  return parts.join('');
}

// Re-export utilities
export { extractHealthData, hasHealthData, getExtractionSummary } from './extraction';
export { processExtractedData } from './processors';
export { checkForAbnormalValues } from '../health/event-creator';
