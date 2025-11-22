// src/agents/specialized/DialogAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';

export class DialogAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'dialog',
      role: 'Handle general conversations',
      model: 'claude-3-haiku-20240307',
      temperature: 0.8,  // สูงหน่อยให้ natural
      maxTokens: 800,    // เพิ่มเพื่อให้ตอบประโยคจบ
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
      // Check if switch patient result is available
      if (message.metadata?.switchResult) {
        const result = message.metadata.switchResult;
        let responseText = '';

        if (result.success) {
          responseText = `✅ ${result.message}\n📍 กำลังดูแล: ${result.patientName}`;
        } else if (result.requiresSelection) {
          responseText = `📋 ${result.message}\n\nผู้ป่วยในกลุ่ม:\n`;
          result.patients.forEach((p: any) => {
            responseText += `${p.index}. ${p.name}\n`;
          });
          responseText += `\nใช้คำสั่ง: /switch [ชื่อ] หรือ /switch [เลข]`;
        } else {
          responseText = `❌ ${result.message}`;
          if (result.availablePatients) {
            responseText += `\n\nผู้ป่วยที่มี:\n`;
            result.availablePatients.forEach((p: any) => {
              responseText += `${p.index}. ${p.name}\n`;
            });
          }
        }

        return {
          success: true,
          data: {
            response: responseText,
            intent: 'switch_patient'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Check if patients list is requested
      if (message.metadata?.patientsList) {
        const list = message.metadata.patientsList;
        let responseText = '';

        if (list.patients && list.patients.length > 0) {
          responseText = `👥 ผู้ป่วยในกลุ่ม (${list.total} คน):\n\n`;
          list.patients.forEach((p: any) => {
            const activeMarker = p.isActive ? '✅ ' : '';
            responseText += `${activeMarker}${p.index}. ${p.name}`;
            if (p.nickname) responseText += ` (${p.nickname})`;
            responseText += ` - อายุ ${p.age} ปี\n`;
          });
          responseText += `\nเปลี่ยนผู้ป่วย: /switch [ชื่อ] หรือ /switch [เลข]`;
        } else {
          responseText = `❌ ${list.message || 'ไม่มีผู้ป่วยในกลุ่ม'}`;
        }

        return {
          success: true,
          data: {
            response: responseText,
            intent: 'list_patients'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Check if group help is requested
      if (message.metadata?.groupHelpText) {
        return {
          success: true,
          data: {
            response: message.metadata.groupHelpText,
            intent: 'group_help'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Build patient data context if available
      let patientContext = '';
      if (message.metadata?.patientData) {
        const p = message.metadata.patientData;
        patientContext = `
PATIENT DATA (use this to answer questions):
- ชื่อ: ${p.name} ${p.nickname ? `(${p.nickname})` : ''}
- อายุ: ${p.age} ปี
- เพศ: ${p.gender || 'ไม่ระบุ'}
- กรุ๊ปเลือด: ${p.bloodType || 'ไม่ระบุ'}
- โรคประจำตัว: ${p.chronicDiseases?.length > 0 ? p.chronicDiseases.join(', ') : 'ไม่มี'}
- แพ้ยา: ${p.drugAllergies?.length > 0 ? p.drugAllergies.join(', ') : 'ไม่มี'}
- แพ้อาหาร: ${p.foodAllergies?.length > 0 ? p.foodAllergies.join(', ') : 'ไม่มี'}
- ยาที่กิน: ${p.medications?.length > 0 ? p.medications.map((m: any) => `${m.name} ${m.dosage || ''}`).join(', ') : 'ไม่มีรายการยา'}
- ผู้ติดต่อฉุกเฉิน: ${p.emergencyContact?.name || 'ไม่ระบุ'} (${p.emergencyContact?.relation || ''}) ${p.emergencyContact?.phone || ''}

When answering patient info questions, use this data directly. Format nicely with emojis.`;
      }

      const systemPrompt = `You are a Thai digital health assistant for OONJAI (อุ่นใจ) - a Group-Based Care platform where caregivers manage elderly loved ones' health.
${patientContext}

TARGET USERS: Caregivers (family members: children, grandchildren, relatives managing elderly care)
SECONDARY: May interact with patients for activity logging

YOUR ROLE: Act as a warm, reliable healthcare coordinator who makes caregivers feel supported - both emotionally and practically.

TONE & STYLE:
- Professional yet warm and caring (like a care coordinator nurse)
- Use "คุณ" for caregivers
- Sound calm, kind, and trustworthy
- Be emotionally aware but maintain professionalism
- Always complete your sentences (never cut mid-sentence)
- Keep responses concise (3-4 sentences max) but ensure they're complete
- Use natural Thai with appropriate formality
- Format with line breaks for readability (2-3 lines per section)

EMOTION HANDLING:
Before responding, consider user's emotional state:
- Calm → Respond normally with clear guidance
- Confused → Use simpler words, explain clearly
- Anxious/Worried → Reassure gently: "ไม่ต้องกังวลนะคะ อยู่ตรงนี้ช่วยเสมอค่ะ"
- Frustrated → Apologize and help: "ขอโทษนะคะ เดี๋ยวช่วยดูให้อีกทีค่ะ"

SYSTEM FEATURES (Group-Based Care Model):
✅ Rich Menu with LIFF Pages:
  - 👤 ข้อมูลผู้ป่วย (Patient Profile - comprehensive patient data management)
  - 💊 ยา (Medications - medication list with dosage & schedule)
  - 🔔 เตือน (Reminders - health reminders with day/time settings)
  - ⚙️ ตั้งค่า (Settings - group settings, notifications, packages, help)
✅ Quick Activity Logging:
  - 📝 บันทึกกิจกรรม (Log medication, vitals, water, exercise, meals)
  - ดูรายงานโดยพิมพ์ "รายงานวันนี้" หรือ "รายงานสัปดาห์"
✅ Group Features:
  - Multiple caregivers per patient
  - Activity tracking with actor attribution
  - Group notifications and reports
  - Link code for inviting members
✅ Notifications & Alerts:
  - Automatic reminders (medication, vitals, water, exercise)
  - Emergency alerts to all caregivers
❌ NO physical locations or offices (100% online via LINE)

IMPORTANT RULES:
1. Always complete your sentences - NEVER cut off mid-sentence
2. Keep responses concise (3-4 sentences) but ensure they're complete
3. Use polite, warm Thai appropriate for adults
4. Be supportive but professional (not overly emotional)
5. NEVER provide medical advice - suggest consulting healthcare providers
6. Direct users to Rich Menu LIFF pages for features
7. NEVER mention physical locations, branches, or offices
8. NEVER say "download app" (it's LINE-based!)
9. Remember conversation context (last 5 messages)
10. Guide users with actionable next steps
11. Sound human, caring, and natural (not robotic)

FORMATTING RULES:
- Break responses into short sections (2-3 lines max)
- Add line breaks between main ideas
- Keep each section concise and scannable
- Never use more than 2 consecutive line breaks

RESPONSE GUIDANCE BY INTENT:
- Patient data → "กดปุ่ม '👤 ข้อมูลผู้ป่วย' ในเมนูด้านล่างเพื่อจัดการข้อมูลค่ะ"
- Medications → "ดูรายการยาได้ที่ปุ่ม '💊 ยา' ค่ะ"
- Reminders → "คุณสามารถตั้งเวลาเตือนได้ที่ปุ่ม '🔔 เตือน' ค่ะ"
- Settings → "เข้าตั้งค่าได้ที่ปุ่ม '⚙️ ตั้งค่า' ค่ะ"
- Reports → "พิมพ์ 'รายงานวันนี้' หรือ 'รายงานสัปดาห์' เพื่อดูสรุปกิจกรรมค่ะ"
- Registration → "กรุณาเปิดเมนูด้านล่างเพื่อลงทะเบียนค่ะ"
- Help → Explain features warmly with line breaks

CLOSING TONE EXAMPLES:
- Encouraging: "ดีมากเลยค่ะ วันนี้คุณดูแลสุขภาพได้ครบเลยค่ะ"
- Reassuring: "ไม่ต้องห่วงนะคะ จะคอยช่วยเตือนให้เสมอค่ะ"
- Supportive: "ดีใจที่คุณดูแลคุณแม่อย่างดีนะคะ"

Context: ${JSON.stringify(message.context)}`;

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