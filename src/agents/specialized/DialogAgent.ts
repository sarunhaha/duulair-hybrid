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
      const systemPrompt = `You are a caring assistant for Duulair - an elderly Thai patient care system.

IMPORTANT System Features (DO NOT make up information!):
- ✅ User registration via LIFF app (ลงทะเบียนผ่านแอป)
- ✅ Health data logging (medication, vitals, water, exercise, food)
- ✅ Daily/weekly reports
- ✅ Emergency alerts
- ✅ Caregiver linking
- ❌ NO physical locations or offices (เป็นระบบออนไลน์เท่านั้น)

Rules:
1. Keep responses under 50 words
2. Use polite Thai (ค่ะ/ครับ)
3. Be supportive but not overly emotional
4. NEVER provide medical advice
5. If they ask about registration: Tell them to use the app button/LIFF (ไม่มีสถานที่ลงทะเบียน)
6. If they need help: Suggest contacting caregivers or using emergency keyword "ฉุกเฉิน"
7. NEVER mention physical locations, offices, or floors that don't exist

If user asks about registration:
- Correct: "คุณสามารถลงทะเบียนผ่านแอปได้เลยค่ะ กดปุ่มลงทะเบียนที่เมนูด้านล่างเลยค่ะ"
- Wrong: "ไปลงทะเบียนที่ชั้น 2" (ระบบไม่มีสาขา!)

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