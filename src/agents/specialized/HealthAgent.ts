// src/agents/specialized/HealthAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';
import { SupabaseService } from '../../services/supabase.service';

export class HealthAgent extends BaseAgent {
  private validationRules = {
    bloodPressure: {
      systolic: { min: 70, max: 200 },
      diastolic: { min: 40, max: 130 }
    },
    heartRate: { min: 40, max: 200 },
    bloodSugar: { min: 50, max: 400 },
    water: { min: 0, max: 5000 }
  };

  constructor(config?: Partial<Config>) {
    super({
      name: 'health',
      role: 'Process and log health data',
      model: 'claude-3-haiku-20240307',
      temperature: 0.3,
      maxTokens: 1000,
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Health Agent initialized');
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();

    try {
      const intent = message.metadata?.intent || 'unknown';
      const patientId = message.context.patientId;

      if (!patientId) {
        throw new Error('Patient ID required for health logging');
      }

      let logData: any = {
        patient_id: patientId,
        task_type: intent,
        timestamp: new Date()
      };

      // Add group context and actor info (TASK-002)
      if (message.context.source === 'group') {
        logData.group_id = message.context.groupId || null;
        logData.actor_line_user_id = message.context.actorLineUserId || null;
        logData.actor_display_name = message.context.actorDisplayName || null;
        logData.source = 'group';
      } else {
        logData.source = '1:1';
      }

      // Process based on intent type
      switch(intent) {
        case 'medication':
          logData = await this.processMedication(message, logData);
          break;
          
        case 'vitals':
          logData = await this.processVitals(message, logData);
          break;
          
        case 'water':
          logData = await this.processWater(message, logData);
          break;
          
        case 'food':
          logData = await this.processFood(message, logData);
          break;
          
        case 'walk':
          logData = await this.processExercise(message, logData);
          break;
          
        default:
          logData.value = message.content;
      }

      // Save to database
      await this.supabase.saveActivityLog(logData);
      
      return {
        success: true,
        data: {
          logged: true,
          logType: intent,
          ...logData
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.log('error', 'Health logging failed', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  private async processMedication(message: Message, logData: any) {
    // Check if contains confirmation
    if (message.content.includes('แล้ว') || 
        message.content.includes('กิน') || 
        message.content.includes('ทาน')) {
      
      logData.value = 'completed';
      logData.metadata = {
        confirmed: true,
        time: new Date()
      };
    }
    
    return logData;
  }

  private async processVitals(message: Message, logData: any) {
    const entities = message.metadata?.entities || {};
    
    // Validate blood pressure
    if (entities.systolic && entities.diastolic) {
      const isValid = this.validateVitals(entities);
      
      logData.value = `${entities.systolic}/${entities.diastolic}`;
      logData.metadata = {
        systolic: entities.systolic,
        diastolic: entities.diastolic,
        valid: isValid,
        alert: this.checkVitalAlert(entities)
      };
    }

    // ถ้ามีรูปภาพ (สำหรับ OCR)
    if (message.metadata?.imageUrl) {
      const ocrResult = await this.processOCR(message.metadata.imageUrl);
      logData.metadata = { ...logData.metadata, ...ocrResult };
    }
    
    return logData;
  }

  private async processWater(message: Message, logData: any) {
    // Extract amount
    const numbers = message.content.match(/\d+/g);
    if (numbers) {
      const amount = parseInt(numbers[0]);
      logData.value = `${amount} ml`;
      logData.metadata = { amount };
    } else {
      logData.value = '1 glass (250ml)';
      logData.metadata = { amount: 250 };
    }
    
    return logData;
  }

  private async processFood(message: Message, logData: any) {
    const systemPrompt = `Extract food information from Thai text.
Output JSON only: {"meal": "breakfast/lunch/dinner", "items": [...], "calories": number}`;

    const result = await this.askClaude(
      `Extract food info: "${message.content}"`,
      systemPrompt
    );

    try {
      const foodData = JSON.parse(result);
      logData.value = foodData.items?.join(', ') || message.content;
      logData.metadata = foodData;
    } catch (e) {
      logData.value = message.content;
    }
    
    return logData;
  }

  private async processExercise(message: Message, logData: any) {
    // Extract duration or distance
    const numbers = message.content.match(/\d+/g);
    if (numbers) {
      logData.metadata = {
        duration: parseInt(numbers[0]),
        unit: message.content.includes('นาที') ? 'minutes' : 'steps'
      };
    }
    
    logData.value = 'completed';
    return logData;
  }

  private async processOCR(imageUrl: string) {
    // ถ้าจะทำ OCR จริง ต้องใช้ Claude Vision หรือ Google Vision API
    // ตัวอย่างนี้เป็น placeholder
    
    const prompt = `Extract blood pressure or health metrics from this image: ${imageUrl}`;
    const result = await this.askClaude(prompt);
    
    return { ocrResult: result };
  }

  private validateVitals(data: any): boolean {
    const { systolic, diastolic } = data;
    const rules = this.validationRules.bloodPressure;
    
    return (
      systolic >= rules.systolic.min &&
      systolic <= rules.systolic.max &&
      diastolic >= rules.diastolic.min &&
      diastolic <= rules.diastolic.max
    );
  }

  private checkVitalAlert(data: any): string | null {
    const { systolic, diastolic } = data;
    
    if (systolic > 140 || diastolic > 90) {
      return 'high_blood_pressure';
    }
    if (systolic < 90 || diastolic < 60) {
      return 'low_blood_pressure';
    }
    
    return null;
  }

  getCapabilities(): string[] {
    return [
      'health-logging',
      'vital-validation',
      'ocr-processing',
      'nutrition-tracking'
    ];
  }
}