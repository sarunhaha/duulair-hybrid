// src/agents/specialized/DialogAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';

export class DialogAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'dialog',
      role: 'Handle general conversations',
      model: 'claude-3-haiku-20240307',
      temperature: 0.8,  // สูงหน่อยให้ natural
      maxTokens: 200,
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Dialog Agent initialized');
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();
    
    try {
      const systemPrompt = `You are a caring assistant for elderly Thai patients.
      
Rules:
1. Keep responses under 50 words
2. Use polite Thai language with appropriate pronouns (ค่ะ/ครับ)
3. Be supportive but not overly emotional
4. Don't provide medical advice
5. If they need help, suggest contacting caregivers

Patient context: ${JSON.stringify(message.context)}`;

      const response = await this.askClaude(
        message.content,
        systemPrompt
      );
      
      return {
        success: true,
        data: {
          response,
          intent: 'dialog'
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      // Fallback response
      return {
        success: true,
        data: {
          response: 'ได้รับข้อความแล้วค่ะ ขอบคุณที่แจ้งให้ทราบ หากต้องการความช่วยเหลือ กรุณาพิมพ์ "ช่วย" ค่ะ'
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  getCapabilities(): string[] {
    return [
      'general-conversation',
      'thai-language',
      'elderly-friendly',
      'fallback-handling'
    ];
  }
}