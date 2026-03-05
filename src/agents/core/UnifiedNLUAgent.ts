// src/agents/core/UnifiedNLUAgent.ts
// Claude-First Natural Language Understanding Agent
// Replaces pattern matching with semantic understanding

import { BaseAgent, Message, Response, Config } from './BaseAgent';
import { AGENT_MODELS } from '../../services/openrouter.service';
import {
  NLUResult,
  NLUContext,
  NLUInput,
  MainIntent,
  NLUHealthData
} from '../../types/nlu.types';
import {
  UNIFIED_NLU_SYSTEM_PROMPT,
  getSystemPrompt,
  buildUnifiedNLUPrompt,
  buildPatientContextString,
  buildRecentActivitiesString,
  buildConversationHistoryString
} from '../../lib/ai/prompts/unified-nlu';

/**
 * Default NLU result for error/fallback cases
 */
const DEFAULT_NLU_RESULT: NLUResult = {
  intent: 'general_chat',
  subIntent: null,
  confidence: 0.5,
  entities: {},
  healthData: null,
  action: { type: 'none' },
  response: 'ขอโทษค่ะ ไม่เข้าใจข้อความ ช่วยอธิบายเพิ่มเติมได้ไหมคะ?',
  followUp: null
};

/**
 * UnifiedNLUAgent - Single Claude call for intent + extraction + response
 *
 * This agent replaces the pattern-matching IntentAgent with a Claude-first
 * approach that understands natural Thai language conversations.
 */
export class UnifiedNLUAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'UnifiedNLUAgent',
      role: 'Natural Language Understanding with Claude-first approach',
      ...AGENT_MODELS.UnifiedNLUAgent,
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'UnifiedNLUAgent initialized');
    return true;
  }

  getCapabilities(): string[] {
    return [
      'intent_classification',
      'entity_extraction',
      'health_data_extraction',
      'response_generation',
      'context_awareness',
      'natural_thai_understanding'
    ];
  }

  /**
   * Main process method - required by BaseAgent
   */
  async process(message: Message): Promise<Response> {
    const startTime = Date.now();

    try {
      // Build NLU context from message
      const nluContext: NLUContext = {
        userId: message.context.userId || '',
        patientId: message.context.patientId,
        groupId: message.context.groupId,
        isGroupChat: message.context.source === 'group' || !!message.context.groupId,
        voiceConfirmed: message.context.confirmedVoice === true, // Voice already confirmed - execute immediately
        onboardingCompleted: message.metadata?.onboardingContext?.completed ?? true,
        onboardingStep: message.metadata?.onboardingContext?.step ?? 'complete',
        patientData: message.metadata?.patientData,
        conversationHistory: message.metadata?.conversationHistory
      };

      // Process message through NLU (pass onboarding context)
      const nluResult = await this.processNLU({
        message: message.content,
        context: nluContext
      }, message.metadata?.onboardingContext);

      return {
        success: true,
        data: nluResult,
        agentName: this.config.name,
        processingTime: Date.now() - startTime,
        metadata: {
          intent: nluResult.intent,
          subIntent: nluResult.subIntent,
          confidence: nluResult.confidence,
          hasHealthData: !!nluResult.healthData
        }
      };
    } catch (error) {
      this.log('error', 'NLU processing failed', { error, message: message.content });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: DEFAULT_NLU_RESULT,
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process message through Claude-first NLU
   */
  async processNLU(
    input: NLUInput,
    onboardingContext?: { completed: boolean; step: string } | null
  ): Promise<NLUResult> {
    const { message, context } = input;

    // Build context strings for the prompt
    const patientContext = context.patientData
      ? buildPatientContextString(context.patientData)
      : 'ไม่มีข้อมูลสมาชิก';

    const recentActivities = context.patientData?.recentActivities
      ? buildRecentActivitiesString(context.patientData.recentActivities)
      : 'ยังไม่มีกิจกรรมวันนี้';

    const conversationHistory = context.conversationHistory
      ? buildConversationHistoryString(context.conversationHistory)
      : 'ไม่มีประวัติการสนทนา';

    // Build the user prompt (with onboarding context if provided)
    let userPrompt = buildUnifiedNLUPrompt(
      message,
      patientContext,
      recentActivities,
      conversationHistory,
      onboardingContext
    );

    // If voice was already confirmed, add instruction to execute immediately
    if (context.voiceConfirmed) {
      userPrompt = `⚡ VOICE CONFIRMED: ผู้ใช้ยืนยันคำพูดแล้ว ให้ทำคำสั่งเลยทันที ห้ามถามยืนยันซ้ำ!
ใช้ action.type: "save" หรือ "update" (ไม่ใช่ "confirm" หรือ "clarify")
ตอบว่า "ทำให้แล้วค่ะ" ไม่ใช่ "ใช่ไหมคะ?"

${userPrompt}`;
    }

    // Call Claude with unified NLU prompt (strip onboarding section if completed)
    const onboardingCompleted = onboardingContext?.completed ?? true;
    const systemPrompt = getSystemPrompt(onboardingCompleted);
    console.log(`🔍 [NLU] onboardingCompleted=${onboardingCompleted}, promptHasOnboarding=${systemPrompt.includes('### onboarding')}, onboardingContext=${JSON.stringify(onboardingContext)}`);
    const response = await this.askClaude(userPrompt, systemPrompt);

    // Parse Claude's JSON response
    const nluResult = this.parseNLUResponse(response, message);

    // Log for debugging
    this.log('debug', 'NLU result', {
      message: message.substring(0, 50),
      intent: nluResult.intent,
      subIntent: nluResult.subIntent,
      confidence: nluResult.confidence
    });

    // Enhanced debug logging for health data extraction
    if (nluResult.intent === 'health_log') {
      console.log(`🔍 [UnifiedNLU] Health data extraction:`, {
        message: message.substring(0, 80),
        healthDataType: nluResult.healthData?.type || 'null',
        hasHealthData: !!nluResult.healthData,
        hasHealthDataArray: !!(nluResult as any).healthDataArray,
        medicationName: nluResult.healthData?.medication?.medicationName || 'none',
        actionType: nluResult.action?.type
      });
    }

    return nluResult;
  }

  /**
   * Parse Claude's JSON response into NLUResult
   */
  private parseNLUResponse(response: string, originalMessage: string): NLUResult {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // No code block — try to find first complete JSON object in response
        const braceStart = response.indexOf('{');
        if (braceStart !== -1) {
          // Find the matching closing brace
          let depth = 0;
          let braceEnd = -1;
          for (let i = braceStart; i < response.length; i++) {
            if (response[i] === '{') depth++;
            else if (response[i] === '}') {
              depth--;
              if (depth === 0) { braceEnd = i; break; }
            }
          }
          if (braceEnd !== -1) {
            jsonStr = response.substring(braceStart, braceEnd + 1);
          }
        }
      }

      // Try to parse as JSON
      const parsed = JSON.parse(jsonStr);

      // Validate required fields and return NLUResult
      return this.validateAndNormalize(parsed);
    } catch (error) {
      this.log('warn', 'Failed to parse NLU response as JSON', {
        error,
        response: response.substring(0, 200)
      });

      // If JSON parsing fails, try to extract intent from response
      return this.inferFromFreeText(response, originalMessage);
    }
  }

  /**
   * Validate and normalize parsed NLU result
   */
  private validateAndNormalize(parsed: any): NLUResult {
    return {
      intent: this.normalizeIntent(parsed.intent),
      subIntent: parsed.subIntent || null,
      confidence: typeof parsed.confidence === 'number'
        ? Math.min(Math.max(parsed.confidence, 0), 1)
        : 0.7,
      entities: parsed.entities || {},
      healthData: this.normalizeHealthData(parsed.healthData),
      action: {
        type: parsed.action?.type || 'none',
        target: parsed.action?.target,
        data: parsed.action?.data,
        requireConfirmation: parsed.action?.requireConfirmation || false
      },
      response: parsed.response || 'ได้รับข้อความแล้วค่ะ',
      followUp: parsed.followUp || null
    };
  }

  /**
   * Normalize intent to valid MainIntent
   */
  private normalizeIntent(intent: string): MainIntent {
    const validIntents: MainIntent[] = [
      'health_log',
      'profile_update',
      'medication_manage',
      'reminder_manage',
      'query',
      'emergency',
      'greeting',
      'general_chat',
      'onboarding'
    ];

    const normalized = (intent || '').toLowerCase().replace(/-/g, '_');

    if (validIntents.includes(normalized as MainIntent)) {
      return normalized as MainIntent;
    }

    // Map common variations
    const intentMap: Record<string, MainIntent> = {
      'health': 'health_log',
      'medication': 'health_log',
      'vitals': 'health_log',
      'profile': 'profile_update',
      'reminder': 'reminder_manage',
      'query_data': 'query',
      'ask': 'query',
      'emergency_alert': 'emergency',
      'greet': 'greeting',
      'chat': 'general_chat'
    };

    return intentMap[normalized] || 'general_chat';
  }

  /**
   * Normalize health data structure
   */
  private normalizeHealthData(healthData: any): NLUHealthData | null {
    if (!healthData) return null;

    // Infer type from data present if not explicitly set
    const type = healthData.type || this.inferHealthDataType(healthData);

    if (!healthData.type && type !== 'medication') {
      console.log(`🔄 [UnifiedNLU] Type inferred from data: "${type}" (Claude didn't set type explicitly)`);
    }

    return {
      type,
      medication: healthData.medication,
      vitals: healthData.vitals,
      water: healthData.water,
      exercise: healthData.exercise,
      food: healthData.food,
      sleep: healthData.sleep,
      symptom: healthData.symptom,
      mood: healthData.mood
    };
  }

  /**
   * Infer health data type from which fields have data
   */
  private inferHealthDataType(healthData: any): string {
    if (healthData.vitals && (healthData.vitals.bloodPressure || healthData.vitals.heartRate || healthData.vitals.bloodSugar || healthData.vitals.weight || healthData.vitals.temperature || healthData.vitals.oxygenSaturation)) return 'vitals';
    if (healthData.sleep && (healthData.sleep.duration_hours || healthData.sleep.bedTime || healthData.sleep.wakeTime)) return 'sleep';
    if (healthData.mood && healthData.mood.mood) return 'mood';
    if (healthData.symptom && healthData.symptom.symptom) return 'symptom';
    if (healthData.exercise && (healthData.exercise.type || healthData.exercise.duration_minutes)) return 'exercise';
    if (healthData.water && (healthData.water.glasses || healthData.water.amount_ml)) return 'water';
    if (healthData.food) return 'food';
    if (healthData.medication) return 'medication';
    return 'medication'; // final fallback
  }

  /**
   * Infer NLU result from free text response when JSON parsing fails
   */
  private inferFromFreeText(response: string, originalMessage: string): NLUResult {
    // Safety net: if response looks like JSON, try to extract the "response" field
    // to prevent raw JSON from being sent to the user
    let cleanResponse = response;
    if (response.includes('"response"') && response.includes('"intent"')) {
      try {
        const responseMatch = response.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (responseMatch) {
          cleanResponse = responseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          this.log('warn', 'Extracted response field from raw JSON fallback');
        }
      } catch {
        // Keep original response
      }
    }

    // Check for emergency keywords first
    if (/ฉุกเฉิน|ช่วยด้วย|หมดสติ|ไม่หายใจ/.test(originalMessage)) {
      return {
        ...DEFAULT_NLU_RESULT,
        intent: 'emergency',
        confidence: 0.9,
        response: cleanResponse || 'โปรดโทร 1669 ทันทีค่ะ นี่คือกรณีฉุกเฉิน!',
        action: { type: 'none' }
      };
    }

    // Check for greeting
    if (/^(สวัสดี|หวัดดี|ดีค่ะ|ดีครับ|hello|hi)/i.test(originalMessage)) {
      return {
        ...DEFAULT_NLU_RESULT,
        intent: 'greeting',
        confidence: 0.85,
        response: cleanResponse || 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?'
      };
    }

    // Check for health-related keywords
    const healthKeywords = /ยา|ความดัน|น้ำตาล|กิน|ดื่มน้ำ|ออกกำลังกาย|นอน|ปวด|เจ็บ|อาการ/;
    if (healthKeywords.test(originalMessage)) {
      return {
        ...DEFAULT_NLU_RESULT,
        intent: 'health_log',
        confidence: 0.6,
        response: cleanResponse,
        action: { type: 'clarify' }
      };
    }

    // Default to general chat with Claude's response
    return {
      ...DEFAULT_NLU_RESULT,
      response: cleanResponse
    };
  }

  /**
   * Check if the NLU result requires a database action
   */
  static requiresAction(nluResult: NLUResult): boolean {
    return nluResult.action.type !== 'none' && nluResult.action.type !== 'clarify';
  }

  /**
   * Check if the NLU result has extractable health data
   */
  static hasHealthData(nluResult: NLUResult): boolean {
    return !!nluResult.healthData && nluResult.intent === 'health_log';
  }

  /**
   * Get a summary of what was extracted for logging
   */
  static getExtractionSummary(nluResult: NLUResult): string {
    const parts: string[] = [
      `intent: ${nluResult.intent}`,
      `subIntent: ${nluResult.subIntent || 'none'}`,
      `confidence: ${(nluResult.confidence * 100).toFixed(0)}%`
    ];

    if (nluResult.entities.patientName) {
      parts.push(`patient: ${nluResult.entities.patientName}`);
    }

    if (nluResult.healthData) {
      parts.push(`healthData: ${nluResult.healthData.type}`);
    }

    if (nluResult.action.type !== 'none') {
      parts.push(`action: ${nluResult.action.type} → ${nluResult.action.target || 'n/a'}`);
    }

    return parts.join(' | ');
  }
}

export default UnifiedNLUAgent;
