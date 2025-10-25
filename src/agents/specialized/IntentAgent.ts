// src/agents/specialized/IntentAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';

export class IntentAgent extends BaseAgent {
  // กำหนด patterns สำหรับจับ intent
  private patterns = {
    medication: [/ยา/, /กิน.*ยา/, /ทาน.*ยา/, /ลืมยา/, /แล้ว.*ยา/],
    vitals: [/ความดัน/, /วัด/, /bp/, /หัวใจ/, /ชีพจร/, /เบาหวาน/, /น้ำตาล/],
    water: [/น้ำ/, /ดื่ม/, /กระหาย/, /แก้ว/],
    walk: [/เดิน/, /ออกกำลัง/, /วิ่ง/, /กีฬา/, /กายภาพ/],
    food: [/อาหาร/, /กิน/, /ข้าว/, /มื้อ/, /เช้า/, /กลางวัน/, /เย็น/],
    emergency: [/ฉุกเฉิน/, /ช่วย/, /เจ็บ/, /ปวด/, /ล้ม/, /หาย.*ใจ.*ไม่.*ออก/],
    report: [/รายงาน/, /สรุป/, /ดู.*ผล/, /วันนี้/, /สัปดาห์/],
    registration: [/ลงทะเบียน/, /สมัคร/, /ลงชื่อ/, /register/, /สร้างบัญชี/, /เริ่มใช้งาน/, /ลงทะเบียนใหม่/]
  };

  constructor(config?: Partial<Config>) {
    super({
      name: 'intent',
      role: 'Classify user messages into intents',
      model: 'claude-3-haiku-20240307',  // ใช้ haiku เพราะเร็วและถูก
      temperature: 0.1,  // ต่ำเพื่อให้ consistent
      maxTokens: 200,    // ไม่ต้องเยอะ แค่ classify
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Intent Agent initialized');
    await this.loadState();
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();
    
    try {
      // 1. ลอง pattern matching ก่อน (เร็วและฟรี)
      const patternResult = this.matchPattern(message.content);
      
      if (patternResult.confidence > 0.7) {
        // ถ้ามั่นใจจาก pattern ใช้เลย
        return this.createResponse(
          true, 
          patternResult, 
          startTime,
          'pattern'
        );
      }

      // 2. ถ้าไม่แน่ใจ ใช้ Claude
      const claudeResult = await this.classifyWithClaude(message.content);
      
      return this.createResponse(
        true,
        claudeResult,
        startTime,
        'claude'
      );
      
    } catch (error) {
      this.log('error', 'Intent classification failed', error);
      
      return this.createResponse(
        false,
        { intent: 'unknown', confidence: 0 },
        startTime,
        'error'
      );
    }
  }

  private matchPattern(text: string): { intent: string, confidence: number, entities?: any } {
    const normalized = text.toLowerCase();
    const scores: Record<string, number> = {};
    
    // นับคะแนนแต่ละ intent
    for (const [intent, patterns] of Object.entries(this.patterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          score++;
        }
      }
      if (score > 0) {
        scores[intent] = score / patterns.length;
      }
    }

    // หา intent ที่คะแนนสูงสุด
    const bestIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    
    if (bestIntent) {
      return {
        intent: bestIntent[0],
        confidence: bestIntent[1],
        entities: this.extractEntities(text, bestIntent[0])
      };
    }

    return { intent: 'other', confidence: 0 };
  }

  private async classifyWithClaude(text: string) {
    const systemPrompt = `You are an intent classifier for a Thai elderly care system.

IMPORTANT: Respond with ONLY valid JSON, no other text.

Classify into these intents:
- medication (ยา, การกินยา)
- vitals (ความดัน, วัดผลเลือด, น้ำตาล)
- water (น้ำ, การดื่มน้ำ)
- walk (เดิน, ออกกำลังกาย)
- food (อาหาร, มื้ออาหาร)
- emergency (ฉุกเฉิน, ต้องการความช่วยเหลือ)
- report (ขอรายงาน, ดูสรุป)
- registration (ลงทะเบียน, สมัครใช้งาน, เริ่มใช้งาน)
- other (อื่นๆ)`;

    const userPrompt = `Classify this message: "${text}"
    
Output JSON only:
{"intent": "...", "confidence": 0.0-1.0, "entities": {...}}`;

    const response = await this.askClaude(userPrompt, systemPrompt);
    
    try {
      return JSON.parse(response);
    } catch (e) {
      // Fallback ถ้า parse JSON ไม่ได้
      return { intent: 'other', confidence: 0.5, entities: {} };
    }
  }

  private extractEntities(text: string, intent: string): any {
    const entities: any = {};
    
    // Extract numbers (สำหรับความดัน, น้ำตาล)
    const numbers = text.match(/\d+/g);
    if (numbers && intent === 'vitals') {
      if (numbers.length >= 2) {
        entities.systolic = parseInt(numbers[0]);
        entities.diastolic = parseInt(numbers[1]);
      }
    }

    // Extract time (เช้า, กลางวัน, เย็น)
    if (text.includes('เช้า')) entities.time = 'morning';
    if (text.includes('กลางวัน')) entities.time = 'noon';
    if (text.includes('เย็น')) entities.time = 'evening';

    return entities;
  }

  private createResponse(
    success: boolean, 
    data: any, 
    startTime: number,
    method: string
  ): Response {
    return {
      success,
      data: {
        ...data,
        method,
        timestamp: new Date()
      },
      agentName: this.config.name,
      processingTime: Date.now() - startTime,
      metadata: { method }
    };
  }

  getCapabilities(): string[] {
    return [
      'intent-classification',
      'entity-extraction', 
      'pattern-matching',
      'thai-language'
    ];
  }
}