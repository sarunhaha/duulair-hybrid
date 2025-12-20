// src/agents/specialized/DialogAgent.ts
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';

// Natural conversation mode flag - when true, don't teach commands
const USE_NATURAL_CONVERSATION_MODE = true;

export class DialogAgent extends BaseAgent {
  // Smart intent suggestions - map similar phrases to actions
  // DEPRECATED: Only used in legacy mode when USE_NATURAL_CONVERSATION_MODE = false
  private intentSuggestions: { pattern: RegExp; intent: string; suggestion: string; action?: string }[] = [
    // Medication-related
    { pattern: /อยาก.*บันทึก.*ยา|จะ.*บันทึก.*ยา|บันทึก.*ยา.*ยังไง/i, intent: 'medication', suggestion: 'บันทึกยา', action: 'พิมพ์ "กินยาแล้ว" หรือ "ทานยาเช้าแล้ว" ได้เลยค่ะ' },
    { pattern: /ยา.*กิน.*ยัง|กิน.*ยา.*หรือยัง|ทาน.*ยา.*รึยัง/i, intent: 'medication', suggestion: 'เช็คการกินยา', action: 'พิมพ์ "รายงานวันนี้" เพื่อดูว่ากินยาครบหรือยังค่ะ' },

    // Vitals-related
    { pattern: /อยาก.*วัด.*ความดัน|จะ.*วัด.*ความดัน|บันทึก.*ความดัน.*ยังไง/i, intent: 'vitals', suggestion: 'บันทึกความดัน', action: 'พิมพ์ค่าความดัน เช่น "ความดัน 120/80" หรือส่งรูปเครื่องวัดมาได้เลยค่ะ' },
    { pattern: /ความดัน.*เท่าไหร่|ความดัน.*ล่าสุด|เช็ค.*ความดัน/i, intent: 'vitals', suggestion: 'ดูความดันล่าสุด', action: 'พิมพ์ "รายงานวันนี้" เพื่อดูค่าความดันล่าสุดค่ะ' },

    // Water-related
    { pattern: /อยาก.*บันทึก.*น้ำ|จะ.*บันทึก.*น้ำ|ดื่ม.*น้ำ.*ยังไง/i, intent: 'water', suggestion: 'บันทึกน้ำ', action: 'พิมพ์ "ดื่มน้ำแล้ว" หรือ "ดื่มน้ำ 500ml" ได้เลยค่ะ' },
    { pattern: /น้ำ.*วันนี้|ดื่ม.*น้ำ.*เท่าไหร่|น้ำ.*กี่.*แก้ว/i, intent: 'water', suggestion: 'ดูปริมาณน้ำ', action: 'พิมพ์ "รายงานวันนี้" เพื่อดูปริมาณน้ำที่ดื่มค่ะ' },

    // Exercise-related
    { pattern: /อยาก.*บันทึก.*ออกกำลัง|จะ.*บันทึก.*เดิน|บันทึก.*เดิน.*ยังไง/i, intent: 'walk', suggestion: 'บันทึกออกกำลังกาย', action: 'พิมพ์ "เดินแล้ว 30 นาที" หรือ "ออกกำลังกายแล้ว" ได้เลยค่ะ' },

    // Food-related
    { pattern: /อยาก.*บันทึก.*อาหาร|จะ.*บันทึก.*กิน|บันทึก.*มื้อ.*ยังไง/i, intent: 'food', suggestion: 'บันทึกอาหาร', action: 'พิมพ์ "กินข้าวแล้ว" หรือ "ทานอาหารเช้าแล้ว" ได้เลยค่ะ' },

    // Report-related
    { pattern: /อยาก.*ดู.*รายงาน|จะ.*ดู.*รายงาน|ดู.*สรุป.*ยังไง|เช็ค.*กิจกรรม/i, intent: 'report', suggestion: 'ดูรายงาน', action: 'พิมพ์ "รายงานวันนี้" หรือ "รายงานสัปดาห์" ได้เลยค่ะ' },
    { pattern: /วันนี้.*ทำ.*อะไร|กิจกรรม.*วันนี้|สรุป.*วันนี้/i, intent: 'report', suggestion: 'สรุปวันนี้', action: 'พิมพ์ "รายงานวันนี้" ค่ะ' },

    // Reminders
    { pattern: /อยาก.*ตั้ง.*เตือน|จะ.*ตั้ง.*เวลา|เตือน.*ยังไง/i, intent: 'reminder', suggestion: 'ตั้งเตือน', action: 'พิมพ์ "ตั้งเตือนกินยา 8 โมง" หรือ "เพิ่มเตือนวัดความดัน 09:00" ได้เลยค่ะ' },

    // ========================================
    // Profile Edit Suggestions (Chat-based Editing)
    // ========================================
    // Profile edits
    { pattern: /อยาก.*เปลี่ยน.*ข้อมูล|จะ.*แก้ไข.*ข้อมูล|อัพเดต.*ข้อมูล.*ยังไง/i, intent: 'edit_profile', suggestion: 'แก้ไขข้อมูล', action: 'พิมพ์สิ่งที่ต้องการแก้ไขได้เลยค่ะ เช่น "น้ำหนัก 65 กก." หรือ "เปลี่ยนเบอร์ 0891234567"' },
    { pattern: /อยาก.*เปลี่ยน.*น้ำหนัก|จะ.*แก้.*น้ำหนัก|น้ำหนัก.*เปลี่ยน/i, intent: 'edit_weight', suggestion: 'แก้ไขน้ำหนัก', action: 'พิมพ์ "น้ำหนัก 65 กิโล" หรือ "เปลี่ยนน้ำหนักเป็น 65 กก." ได้เลยค่ะ' },
    { pattern: /อยาก.*เปลี่ยน.*ส่วนสูง|จะ.*แก้.*สูง|ส่วนสูง.*เปลี่ยน/i, intent: 'edit_height', suggestion: 'แก้ไขส่วนสูง', action: 'พิมพ์ "สูง 165 ซม." หรือ "เปลี่ยนส่วนสูงเป็น 165" ได้เลยค่ะ' },
    { pattern: /อยาก.*เปลี่ยน.*เบอร์|จะ.*แก้.*เบอร์|เบอร์.*เปลี่ยน/i, intent: 'edit_phone', suggestion: 'แก้ไขเบอร์โทร', action: 'พิมพ์ "เบอร์ใหม่ 0891234567" หรือ "เปลี่ยนเบอร์เป็น 0891234567" ได้เลยค่ะ' },
    { pattern: /อยาก.*เปลี่ยน.*ชื่อ|จะ.*แก้.*ชื่อ|ชื่อ.*เปลี่ยน/i, intent: 'edit_name', suggestion: 'แก้ไขชื่อ', action: 'พิมพ์ "ชื่อใหม่คือ สมศรี มงคล" หรือ "เปลี่ยนชื่อเล่นเป็น แม่" ได้เลยค่ะ' },

    // Medication management
    { pattern: /อยาก.*เพิ่ม.*ยา|จะ.*เพิ่ม.*ยา|ยา.*ใหม่.*ยังไง/i, intent: 'add_medication', suggestion: 'เพิ่มยา', action: 'พิมพ์ "เพิ่มยา [ชื่อยา] [ขนาด] [เวลา]" เช่น "เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น"' },
    { pattern: /อยาก.*ลบ.*ยา|จะ.*ลบ.*ยา|เอา.*ยา.*ออก|หยุด.*ยา/i, intent: 'delete_medication', suggestion: 'ลบยา', action: 'พิมพ์ "ลบยา [ชื่อยา]" หรือ "หยุดกินยา [ชื่อยา]" ได้เลยค่ะ' },
    { pattern: /อยาก.*แก้.*ยา|จะ.*เปลี่ยน.*ยา|ยา.*แก้ไข/i, intent: 'edit_medication', suggestion: 'แก้ไขยา', action: 'พิมพ์ "แก้ยา [ชื่อยา] เป็น [ข้อมูลใหม่]" ได้เลยค่ะ' },

    // Reminder management (new)
    { pattern: /อยาก.*ลบ.*เตือน|จะ.*ลบ.*เตือน|ยกเลิก.*เตือน/i, intent: 'delete_reminder', suggestion: 'ลบการเตือน', action: 'พิมพ์ "ลบเตือน [ชื่อเตือน]" หรือ "ยกเลิกเตือนกินยาเช้า" ได้เลยค่ะ' },
    { pattern: /อยาก.*แก้.*เตือน|จะ.*เปลี่ยน.*เตือน|เตือน.*แก้ไข/i, intent: 'edit_reminder', suggestion: 'แก้ไขการเตือน', action: 'พิมพ์ "แก้เตือนกินยา เป็น 9 โมง" ได้เลยค่ะ' },

    // Allergies & Medical conditions
    { pattern: /อยาก.*เพิ่ม.*แพ้|จะ.*บันทึก.*แพ้|แพ้.*ใหม่/i, intent: 'edit_allergies', suggestion: 'เพิ่มการแพ้', action: 'พิมพ์ "แพ้ยา [ชื่อยา]" หรือ "แพ้อาหาร [ชนิดอาหาร]" ได้เลยค่ะ' },
    { pattern: /อยาก.*เพิ่ม.*โรค|จะ.*บันทึก.*โรค|โรค.*ใหม่/i, intent: 'edit_medical_condition', suggestion: 'เพิ่มโรคประจำตัว', action: 'พิมพ์ "เพิ่มโรค [ชื่อโรค]" หรือ "โรคประจำตัวคือ [รายละเอียด]" ได้เลยค่ะ' },

    // Help-related
    { pattern: /ทำ.*อะไร.*ได้|ช่วย.*อะไร.*ได้|มี.*ฟีเจอร์.*อะไร|ใช้.*งาน.*ยังไง/i, intent: 'help', suggestion: 'วิธีใช้งาน', action: 'พิมพ์ "ช่วยเหลือ" หรือ "วิธีใช้" เพื่อดูคำแนะนำทั้งหมดค่ะ' },

    // Greetings
    { pattern: /^(สวัสดี|หวัดดี|ดี|hi|hello|hey)$/i, intent: 'greeting', suggestion: 'ทักทาย', action: undefined },
    { pattern: /สบายดี.*ไหม|เป็น.*ไง|ว่าไง/i, intent: 'greeting', suggestion: 'ทักทาย', action: undefined },

    // Thanks
    { pattern: /ขอบคุณ|ขอบใจ|thanks|thank you|thx/i, intent: 'thanks', suggestion: 'ขอบคุณ', action: undefined },

    // Emergency guidance - more specific patterns to avoid matching "ผู้ป่วย"
    // Use negative lookahead to exclude "ผู้ป่วย" context
    { pattern: /^ไม่สบาย|รู้สึก.*ไม่สบาย|เจ็บ.*ตัว|มี.*อาการ.*แปลก/i, intent: 'health_concern', suggestion: 'ปัญหาสุขภาพ', action: 'ถ้าเป็นเรื่องฉุกเฉิน พิมพ์ "ฉุกเฉิน" ได้เลยค่ะ ระบบจะแจ้งผู้ดูแลทันที' },
  ];

  constructor(config?: Partial<Config>) {
    super({
      name: 'dialog',
      role: 'Handle general conversations',
      model: 'anthropic/claude-sonnet-4.5',  // OpenRouter: Claude Sonnet 4.5
      temperature: 0.8,  // สูงหน่อยให้ natural
      maxTokens: 800,    // เพิ่มเพื่อให้ตอบประโยคจบ
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Dialog Agent initialized');
    return true;
  }

  // Check if message matches any intent suggestion pattern
  private checkIntentSuggestion(text: string): { intent: string; suggestion: string; action: string | null } | null {
    for (const item of this.intentSuggestions) {
      if (item.pattern.test(text)) {
        return {
          intent: item.intent,
          suggestion: item.suggestion,
          action: item.action || null
        };
      }
    }
    return null;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();

    try {
      // Skip command suggestions in natural conversation mode
      // In natural mode, the UnifiedNLUAgent handles everything naturally
      if (!USE_NATURAL_CONVERSATION_MODE) {
        // LEGACY MODE: Check if this is a patient data query first (has patientData metadata)
        // This takes priority over smart intent suggestions
        if (message.metadata?.patientData) {
          // Skip smart suggestions - let Claude handle with patient context
          // This will be processed in the main Claude call below
        } else {
          // Check for smart intent suggestion only if NOT a patient data query
          const intentSuggestion = this.checkIntentSuggestion(message.content);
          if (intentSuggestion && intentSuggestion.action) {
            // Return helpful guidance instead of generic response
            return {
              success: true,
              data: {
                response: `💡 ${intentSuggestion.action}`,
                intent: intentSuggestion.intent,
                suggestedAction: intentSuggestion.suggestion
              },
              agentName: this.config.name,
              processingTime: Date.now() - startTime
            };
          }
        }
      }

      // Check if patient selection is required
      if (message.metadata?.patientSelectionData) {
        const data = message.metadata.patientSelectionData;
        let responseText = `👥 กลุ่มนี้มีหลายผู้ป่วย กรุณาเลือกผู้ป่วยที่ต้องการบันทึก:`;

        return {
          success: true,
          data: {
            response: responseText,
            intent: 'patient_selection'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

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

      // Check if set default patient result is available (Phase 4)
      if (message.metadata?.setDefaultResult) {
        const result = message.metadata.setDefaultResult;
        let responseText = '';

        if (result.success) {
          responseText = `✅ ${result.message}\n💡 ตั้งค่า ${result.patientName} เป็นผู้ป่วยหลักของคุณแล้ว\n\nเมื่อคุณบันทึกข้อมูลโดยไม่ระบุชื่อ ระบบจะบันทึกให้ ${result.patientName} โดยอัตโนมัติค่ะ\n\n💬 ต้องการบันทึกให้คนอื่น: ระบุชื่อในข้อความ เช่น "ปู่วิชัยกินยา"`;
        } else if (result.requiresSelection) {
          responseText = `📋 ${result.message}\n\n`;
          result.patients.forEach((p: any) => {
            responseText += `${p.index}. ${p.name}\n`;
          });
          responseText += `\nใช้คำสั่ง: /setdefault [ชื่อ] หรือ /setdefault [เลข]`;
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
            intent: 'set_default_patient'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Check if remove default patient result is available (Phase 4)
      if (message.metadata?.removeDefaultResult) {
        const result = message.metadata.removeDefaultResult;
        let responseText = '';

        if (result.success) {
          responseText = `✅ ${result.message}\n\nตอนนี้เมื่อคุณบันทึกข้อมูลโดยไม่ระบุชื่อ ระบบจะถามให้คุณเลือกผู้ป่วยทุกครั้งค่ะ\n\n💡 ต้องการตั้งผู้ป่วยหลักใหม่: พิมพ์ "/setdefault [ชื่อ]"`;
        } else {
          responseText = `❌ ${result.message}`;
        }

        return {
          success: true,
          data: {
            response: responseText,
            intent: 'remove_default_patient'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Build patient data context if available
      let patientContext = '';
      if (message.metadata?.patientData) {
        const p = message.metadata.patientData;

        // Format medications list
        // Schema: name, dosage_amount, dosage_unit, dosage_form, frequency, times, instructions
        const medicationsList = p.medications?.length > 0
          ? p.medications.map((m: any) => {
              // Format dosage (e.g., "1 tablet", "5 ml")
              let dosage = '';
              if (m.dosage_amount) {
                const unit = m.dosage_unit || m.dosage_form || 'เม็ด';
                dosage = ` ${m.dosage_amount} ${unit}`;
              }
              // Format schedule from times array
              let schedule = '';
              if (m.times && Array.isArray(m.times) && m.times.length > 0) {
                const timesStr = m.times.map((t: string) => t.substring(0, 5)).join(', ');
                schedule = ` (${timesStr})`;
              } else if (m.frequency) {
                const freqMap: Record<string, string> = {
                  'daily': 'ทุกวัน',
                  'weekly': 'สัปดาห์ละครั้ง',
                  'as_needed': 'เมื่อจำเป็น'
                };
                schedule = ` (${freqMap[m.frequency] || m.frequency})`;
              }
              // Add instructions if available
              const instructions = m.instructions ? ` - ${m.instructions}` : '';
              return `${m.name}${dosage}${schedule}${instructions}`;
            }).join('\n  • ')
          : 'ไม่มีรายการยา';

        // Format reminders list
        const remindersList = p.reminders?.length > 0
          ? p.reminders.map((r: any) => {
              const time = r.custom_time || r.time || '';
              const type = r.type || r.reminder_type || 'general';
              const typeIcon = type === 'medication' ? '💊' : type === 'vitals' ? '🩺' : type === 'water' ? '💧' : type === 'exercise' ? '🚶' : '🔔';
              return `${typeIcon} ${r.title} - ${time}`;
            }).join('\n  • ')
          : 'ไม่มีการตั้งเตือน';

        // Format recent activities (today only for relevance)
        const today = new Date().toDateString();
        const todayActivities = p.recentActivities?.filter((a: any) =>
          new Date(a.created_at).toDateString() === today
        ) || [];

        const activitiesList = todayActivities.length > 0
          ? todayActivities.slice(0, 5).map((a: any) => {
              const time = new Date(a.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
              const type = a.activity_type || a.type || 'unknown';
              const typeIcon = type === 'medication' ? '💊' : type === 'vitals' ? '🩺' : type === 'water' ? '💧' : type === 'walk' ? '🚶' : type === 'food' ? '🍚' : '📝';
              return `${typeIcon} ${a.description || type} (${time})`;
            }).join('\n  • ')
          : 'ยังไม่มีกิจกรรมวันนี้';

        patientContext = `
PATIENT DATA (use this to answer questions):
👤 ข้อมูลพื้นฐาน:
- ชื่อ: ${p.name} ${p.nickname ? `(${p.nickname})` : ''}
- อายุ: ${p.age} ปี
- เพศ: ${p.gender || 'ไม่ระบุ'}
- กรุ๊ปเลือด: ${p.bloodType || 'ไม่ระบุ'}

🏥 ประวัติสุขภาพ:
- โรคประจำตัว: ${p.chronicDiseases?.length > 0 ? p.chronicDiseases.join(', ') : 'ไม่มี'}
- แพ้ยา: ${p.drugAllergies?.length > 0 ? p.drugAllergies.join(', ') : 'ไม่มี'}
- แพ้อาหาร: ${p.foodAllergies?.length > 0 ? p.foodAllergies.join(', ') : 'ไม่มี'}

💊 ยาที่กินประจำ:
  • ${medicationsList}

🔔 การแจ้งเตือนที่ตั้งไว้:
  • ${remindersList}

📋 กิจกรรมวันนี้:
  • ${activitiesList}

📞 ผู้ติดต่อฉุกเฉิน: ${p.emergencyContact?.name || 'ไม่ระบุ'} (${p.emergencyContact?.relation || ''}) ${p.emergencyContact?.phone || ''}

INSTRUCTIONS:
- Use this data to answer questions about the patient
- When asked about medications, list them from the data above
- When asked about reminders, show what's been set up
- When asked about today's activities, show what's been done
- Format responses nicely with emojis`;
      }

      // Detect if this is a group chat context
      const isGroupChat = message.context?.source === 'group' || message.context?.groupId;

      // Build context-specific system prompt
      const systemPrompt = `You are a Thai digital health assistant for OONJAI (อุ่นใจ) - a Group-Based Care platform where caregivers manage elderly loved ones' health.
${patientContext}

CURRENT CONTEXT: ${isGroupChat ? 'LINE GROUP CHAT' : 'LINE OA (1:1 CHAT)'}
${isGroupChat ? `
⚠️ CRITICAL - GROUP CHAT RULES:
- This is a LINE GROUP - there is NO Rich Menu, NO buttons, NO LIFF pages available
- Users can ONLY interact by typing text commands
- NEVER mention "เมนูด้านล่าง", "กดปุ่ม", "Rich Menu", or any button/menu references
- ONLY suggest text commands that users can type
- Keep responses SHORT and conversational (2-3 sentences max)
` : `
📱 LINE OA CONTEXT:
- User has access to Rich Menu with LIFF pages
- Can reference menu buttons: 👤 ข้อมูลผู้ป่วย, 💊 ยา, 🔔 เตือน, ⚙️ ตั้งค่า
`}

TARGET USERS: Caregivers (family members managing elderly care)

TONE & STYLE:
- Warm, friendly, and conversational (like chatting with a helpful friend)
- Use "คุณ" or casual Thai
- Keep responses SHORT (2-3 sentences for greetings, max 4 for help)
- Sound natural, not robotic
- Be emotionally aware but not overly formal

${isGroupChat ? `
GROUP CHAT NATURAL CONVERSATION:
- Users can speak naturally in Thai - no need to teach specific commands
- Example: "ยายกินยาเสร็จแล้วค่ะ" → understand and log medication
- Example: "วัดความดันได้ 140 กับ 90" → understand and log vitals
- Example: "ดื่มน้ำไป 2 แก้วแล้ว" → understand and log water intake
- Respond naturally and confirm what was understood/recorded
- NEVER say "พิมพ์..." or "กรุณาระบุ..."
- NEVER teach command formats - just understand and respond naturally
` : `
RICH MENU FEATURES:
- 👤 ข้อมูลผู้ป่วย - จัดการข้อมูลผู้ป่วย
- 💊 ยา - รายการยาและการตั้งเวลา
- 🔔 เตือน - ตั้งเวลาเตือน
- ⚙️ ตั้งค่า - การตั้งค่าต่างๆ
`}

GREETING RESPONSES (${isGroupChat ? 'GROUP' : '1:1'}):
- Keep it SHORT and warm
- Example: "สวัสดีค่ะ! วันนี้ช่วยอะไรได้บ้างคะ?"
- ${isGroupChat ? 'NEVER mention menu buttons or Rich Menu' : 'Can mention menu if relevant'}

IMPORTANT:
1. Keep responses concise (2-4 sentences max)
2. Be warm but not overly formal
3. ${isGroupChat ? 'ONLY suggest TEXT COMMANDS - no buttons/menus!' : 'Can reference Rich Menu buttons'}
4. Sound natural and conversational
5. If greeting, just greet warmly and offer help briefly

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