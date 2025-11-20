// src/agents/specialized/IntentAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';

export class IntentAgent extends BaseAgent {
  // กำหนด patterns สำหรับจับ intent (Group-Based Care Model)
  private patterns = {
    // Activity logging intents (Message commands)
    medication: [/ยา/, /กิน.*ยา/, /ทาน.*ยา/, /ลืมยา/, /แล้ว.*ยา/, /บันทึกยา/],
    vitals: [/ความดัน/, /วัด/, /bp/, /หัวใจ/, /ชีพจร/, /เบาหวาน/, /น้ำตาล/, /บันทึกความดัน/],
    water: [/น้ำ/, /ดื่ม/, /กระหาย/, /แก้ว/, /บันทึกน้ำ/],
    walk: [/เดิน/, /ออกกำลัง/, /วิ่ง/, /กีฬา/, /กายภาพ/, /บันทึกการเดิน/],
    food: [/อาหาร/, /กิน/, /ข้าว/, /มื้อ/, /เช้า/, /กลางวัน/, /เย็น/, /บันทึกอาหาร/],

    // Emergency & alerts
    emergency: [/ฉุกเฉิน/, /ช่วย/, /เจ็บ/, /ปวด/, /ล้ม/, /หาย.*ใจ.*ไม่.*ออก/, /ไม่สบาย/],

    // Reports (Message command)
    report_menu: [/^ดูรายงาน$/, /^รายงาน$/],
    report: [/รายงานวันนี้/, /รายงานสัปดาห์/, /รายงานเดือน/, /สรุปวันนี้/, /สรุปสัปดาห์/, /📊.*รายงาน/],

    // LIFF page intents
    view_patient_profile: [/ข้อมูลผู้ป่วย/, /โปรไฟล์/, /ดูข้อมูล/, /แก้ไขข้อมูล/, /👤/],
    view_medications: [/รายการยา/, /ยาทั้งหมด/, /จัดการยา/, /💊/],
    view_reminders: [/เตือน/, /ตั้งเวลา/, /เวลาเตือน/, /🔔/],
    view_settings: [/ตั้งค่า/, /การแจ้งเตือน/, /กลุ่ม/, /⚙️/],

    // Registration & group management
    registration: [/ลงทะเบียน/, /สมัคร/, /ลงชื่อ/, /register/, /สร้างกลุ่ม/, /เริ่มใช้งาน/],
    join_group: [/เข้ากลุ่ม/, /ลิงก์/, /link code/, /รหัสกลุ่ม/],

    // Help & support
    package: [/แพ็กเกจ/, /บริการ/, /ราคา/, /package/, /ฟรี/, /pro/],
    help: [/ช่วยเหลือ/, /help/, /วิธีใช้/, /คำถาม/, /faq/, /ไม่เข้าใจ/],

    // Quick actions from Rich Menu
    quick_log: [/^📝.*บันทึก/, /^บันทึกกิจกรรม$/],

    // Patient info queries (for group)
    patient_info: [/ข้อมูล.*ผู้ป่วย/, /โปรไฟล์.*ผู้ป่วย/, /รายละเอียด.*ผู้ป่วย/, /ข้อมูล.*ทั้งหมด/],
    patient_name: [/ชื่อ.*อะไร/, /ชื่อ.*ผู้ป่วย/, /ชื่อ.*ใคร/, /ผู้ป่วย.*ชื่อ/],
    patient_age: [/อายุ.*เท่าไหร่/, /อายุ.*กี่.*ปี/, /ผู้ป่วย.*อายุ/, /แก่.*แค่ไหน/],
    patient_conditions: [/โรค.*ประจำตัว/, /โรค.*อะไร/, /ป่วย.*เป็น.*อะไร/, /มี.*โรค/],
    patient_medications: [/กิน.*ยา.*อะไร/, /ยา.*ที่.*กิน/, /รายการ.*ยา/, /ยา.*อะไร.*บ้าง/],
    patient_allergies: [/แพ้.*อะไร/, /อาการ.*แพ้/, /แพ้.*ยา/, /แพ้.*อาหาร/],
    group_help: [/ถาม.*อะไร.*ได้/, /ทำ.*อะไร.*ได้/, /คำสั่ง/, /สิ่งที่.*ถาม/, /ช่วย.*อะไร.*ได้/, /วิธีใช้/, /^help$/, /เมนู/]
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
    const systemPrompt = `You are an intent classifier for OONJAI - a Group-Based Care platform where CAREGIVERS manage patient care.

IMPORTANT: Respond with ONLY valid JSON, no other text.

Classify into these intents:

ACTIVITY LOGGING (caregivers log patient activities):
- medication (ยา, กินยา, บันทึกยา)
- vitals (ความดัน, วัดความดัน, น้ำตาล, บันทึกความดัน)
- water (น้ำ, ดื่มน้ำ, บันทึกน้ำ)
- walk (เดิน, ออกกำลังกาย, บันทึกการเดิน)
- food (อาหาร, มื้ออาหาร, บันทึกอาหาร)

ALERTS:
- emergency (ฉุกเฉิน, ช่วย, ไม่สบาย, เจ็บ, ล้ม)

REPORTS:
- report (รายงาน, สรุป, ดูรายงาน, วันนี้, สัปดาห์)

LIFF PAGES (caregiver wants to open feature):
- view_patient_profile (ข้อมูลผู้ป่วย, โปรไฟล์, ดูข้อมูล)
- view_medications (รายการยา, จัดการยา, ยาทั้งหมด)
- view_reminders (เตือน, ตั้งเวลา, เวลาเตือน)
- view_settings (ตั้งค่า, การแจ้งเตือน, กลุ่ม)

GROUP MANAGEMENT:
- registration (ลงทะเบียน, สมัคร, สร้างกลุ่ม)
- join_group (เข้ากลุ่ม, ลิงก์, link code)

SUPPORT:
- package (แพ็กเกจ, บริการ, ราคา, ฟรี, pro)
- help (ช่วยเหลือ, วิธีใช้, faq)

PATIENT INFO QUERIES (for group chat):
- patient_info (ข้อมูลผู้ป่วย, โปรไฟล์, รายละเอียด, ข้อมูลทั้งหมด)
- patient_name (ชื่อผู้ป่วย, ชื่ออะไร)
- patient_age (อายุเท่าไหร่, กี่ปี)
- patient_conditions (โรคประจำตัว, โรคอะไร)
- patient_medications (ยาที่กิน, รายการยา)
- patient_allergies (แพ้อะไร, แพ้ยา, แพ้อาหาร)
- group_help (ถามอะไรได้, ทำอะไรได้บ้าง, คำสั่ง)

OTHER:
- other (อื่นๆ ที่ไม่ตรงกับข้างบน)`;

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