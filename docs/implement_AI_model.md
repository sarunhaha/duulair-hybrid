# OONJAI AI Architecture & Implementation Guide

คู่มือนี้สรุปการทำงานของ AI และ Agent ในระบบ OONJAI เพื่อให้ทีมเข้าใจและสามารถแก้ไข Intent ได้

---

## Overview

ระบบใช้ **Claude Sonnet 4.5** เป็น AI Model หลักตัวเดียว ผ่าน **OpenRouter API**

```
User Message (LINE)
        ↓
┌──────────────────────────────────────────────────────────────┐
│                    OrchestratorAgent                         │
│                  (Main Coordinator)                          │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                    UnifiedNLUAgent                           │
│              (Claude Sonnet 4.5 - Single Call)               │
│                                                              │
│  Input: message + patient context + conversation history     │
│                                                              │
│  Output:                                                     │
│  - intent: "health_log" / "profile_update" / "emergency"     │
│  - subIntent: "medication" / "vitals" / "symptom"            │
│  - healthData: { ... extracted data ... }                    │
│  - action: { type: "save", target: "activity_logs" }         │
│  - response: "บันทึกให้แล้วค่ะ 💊"                            │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                    ActionRouter                              │
│           (Execute DB actions based on NLU)                  │
│                                                              │
│  - save → Insert to database                                 │
│  - update → Update existing record                           │
│  - delete → Remove record                                    │
│  - query → Fetch and return data                             │
└──────────────────────────────────────────────────────────────┘
                         ↓
               Response to User (LINE)
```

---

## AI Model Configuration

| Setting | Value |
|---------|-------|
| Model | `anthropic/claude-sonnet-4.5` |
| Temperature | `0.3` (Low for consistent output) |
| Max Tokens | `1500` |
| API Provider | OpenRouter |

**Configuration File:** `src/services/openrouter.service.ts`

```typescript
export const OPENROUTER_MODELS = {
  CLAUDE_SONNET_4_5: 'anthropic/claude-sonnet-4.5',  // Default - ใช้ตัวนี้
  CLAUDE_HAIKU_4_5: 'anthropic/claude-haiku-4.5',    // Fast but less accurate
  // ...
};
```

---

## Agents - รายละเอียดและวิธีแก้ไข

### Agent Dependencies Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       OrchestratorAgent                         │
│                    (เรียกใช้ agents อื่นๆ)                       │
└────────────┬───────────────┬────────────────┬───────────────────┘
             │               │                │
    ┌────────▼────────┐ ┌────▼─────┐    ┌─────▼──────┐
    │ UnifiedNLUAgent │ │ Report   │    │ Alert      │
    │ (Claude API)    │ │ Agent    │    │ Agent      │
    └────────┬────────┘ └────┬─────┘    └─────┬──────┘
             │               │                │
    ┌────────▼────────┐      │                │
    │  ActionRouter   │◄─────┴────────────────┘
    │  (Database)     │
    └─────────────────┘
```

---

## 1. OrchestratorAgent (Main Coordinator)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/core/OrchestratorAgent.ts` |
| **Model** | claude-sonnet-4.5 |
| **Temperature** | 0.5 |
| **Role** | Main coordinator - รับ message และกระจายงานไปยัง agents อื่น |

### หน้าที่หลัก
1. รับ message จาก LINE webhook
2. ตรวจสอบ special requests (report menu, health log menu)
3. ส่งต่อให้ UnifiedNLUAgent ประมวลผล
4. บันทึก conversation log ลง database
5. เรียก ActionRouter ถ้าต้อง save/update/delete
6. ส่ง response กลับไปยัง user

### Key Methods
```typescript
// Entry point - รับ message และเลือก mode
process(message: Message): Promise<Response>

// Mode หลัก - ใช้ Claude NLU
processWithNaturalConversation(message, startTime): Promise<Response>

// Legacy mode - ใช้ pattern matching (fallback)
processWithIntentRouting(message, startTime): Promise<Response>

// Handle report requests
handleReportQuery(message, nluResult, patientData, startTime): Promise<Response>

// Check for special menu requests
isReportMenuRequest(content: string): boolean
isHealthLogMenuRequest(content: string): boolean
```

### การแก้ไข

#### เปลี่ยน Mode (Claude-first vs Legacy)
```typescript
// Line 15
const USE_NATURAL_CONVERSATION_MODE = true;  // Claude-first (recommended)
// เปลี่ยนเป็น false เพื่อใช้ pattern matching แบบเก่า
```

#### เพิ่ม Special Request ใหม่
```typescript
// เพิ่ม method ตรวจสอบ
private isNewMenuRequest(content: string): boolean {
  return /^เมนูใหม่$|^new menu$/i.test(content);
}

// เพิ่มใน processWithNaturalConversation()
if (this.isNewMenuRequest(message.content)) {
  return this.handleNewMenuRequest(message, startTime);
}
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เปลี่ยน mode | เปลี่ยนวิธีการ detect intent ทั้งหมด | 🔴 สูง |
| เพิ่ม special request | กระทบเฉพาะ request ใหม่ | 🟢 ต่ำ |
| แก้ไข routing logic | กระทบทุก message | 🔴 สูง |

---

## 2. UnifiedNLUAgent (Natural Language Understanding)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/core/UnifiedNLUAgent.ts` |
| **Model** | claude-sonnet-4.5 |
| **Temperature** | 0.3 (ต่ำเพื่อความ consistent) |
| **Role** | เข้าใจ message ภาษาไทยธรรมชาติ + Extract ข้อมูล + สร้าง response |

### หน้าที่หลัก
1. รับ message + patient context + conversation history
2. เรียก Claude API เพื่อ:
   - ระบุ intent (health_log, profile_update, emergency, etc.)
   - Extract entities (ชื่อผู้ป่วย, เวลา, ค่าต่างๆ)
   - Extract health data (ความดัน, อาการ, ยา)
   - กำหนด action ที่ต้องทำ (save, update, delete, query)
   - สร้าง response ภาษาไทยที่เป็นธรรมชาติ
3. Return ผลลัพธ์เป็น NLUResult

### Output Format
```typescript
interface NLUResult {
  intent: MainIntent;        // 'health_log', 'profile_update', 'emergency', etc.
  subIntent: SubIntent;      // 'medication', 'vitals', 'symptom', etc.
  confidence: number;        // 0.0 - 1.0
  entities: NLUEntities;     // { patientName, time, values... }
  healthData: NLUHealthData; // { type, medication?, vitals?, symptom? }
  action: NLUAction;         // { type: 'save', target: 'activity_logs' }
  response: string;          // "บันทึกให้แล้วค่ะ 💊"
  followUp: string | null;   // คำถามติดตาม (ถ้ามี)
}
```

### Key Methods
```typescript
// Main processing
process(message: Message): Promise<Response>

// Call Claude API and parse response
processNLU(input: NLUInput): Promise<NLUResult>

// Parse JSON from Claude response
parseNLUResponse(response: string, originalMessage: string): NLUResult

// Normalize intent/healthData
normalizeIntent(intent: string): MainIntent
normalizeHealthData(healthData: any): NLUHealthData | null

// Static helpers
static requiresAction(nluResult: NLUResult): boolean
static hasHealthData(nluResult: NLUResult): boolean
```

### การแก้ไข

#### เปลี่ยน AI Model
```typescript
// Line 47
model: OPENROUTER_MODELS.CLAUDE_SONNET_4_5, // เปลี่ยนตรงนี้
// Options: CLAUDE_SONNET_4_5, CLAUDE_HAIKU_4_5, GPT_4O
```

#### เปลี่ยน Temperature
```typescript
// Line 48 - ค่าต่ำ = consistent, ค่าสูง = creative
temperature: 0.3, // 0.1-0.4 recommended สำหรับ NLU
```

#### เปลี่ยน Response Style
**File:** `src/lib/ai/prompts/unified-nlu.ts` (ไม่ใช่ไฟล์นี้)

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เปลี่ยน model | เปลี่ยนคุณภาพ/ความเร็ว response | 🟡 กลาง |
| เปลี่ยน temperature | เปลี่ยนความ consistent ของ output | 🟡 กลาง |
| แก้ไข parseNLUResponse | กระทบการ parse JSON ทั้งหมด | 🔴 สูง |

---

## 3. IntentAgent (Legacy Pattern Matching)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/specialized/IntentAgent.ts` |
| **Status** | ⚠️ LEGACY - ใช้เฉพาะเมื่อ `USE_NATURAL_CONVERSATION_MODE = false` |
| **Role** | ใช้ regex pattern matching จับ intent |

### Pattern Categories
```typescript
private patterns = {
  // Activity logging
  medication: [/ยา/, /กิน.*ยา/, /ทาน.*ยา/, /ลืมยา/, /บันทึกยา/, ...],
  vitals: [/ความดัน/, /วัด/, /bp/, /หัวใจ/, /ชีพจร/, /\d+\/\d+/, ...],
  water: [/น้ำ/, /ดื่ม/, /กระหาย/, /แก้ว/, /ml/, ...],
  walk: [/เดิน/, /ออกกำลัง/, /วิ่ง/, /กีฬา/, /นาที/, ...],
  food: [/อาหาร/, /กิน/, /ข้าว/, /มื้อ/, ...],

  // Emergency
  emergency: [/ฉุกเฉิน/, /ช่วย/, /เจ็บ/, /ปวด/, /ล้ม/, /หมด.*สติ/, ...],

  // Reports
  report_menu: [/^ดูรายงาน$/, /^รายงาน$/, /^รายงานสุขภาพ$/],
  report: [/รายงานวันนี้/, /รายงานสัปดาห์/, /สรุป/, ...],

  // Patient queries
  patient_info: [/ข้อมูล.*ผู้ป่วย/, /โปรไฟล์/, ...],
  patient_medications: [/ยา.*อะไร/, /รายการ.*ยา/, ...],

  // Profile edits
  edit_weight: [/เปลี่ยน.*น้ำหนัก/, /น้ำหนัก\s*\d+/, ...],
  edit_height: [/เปลี่ยน.*ส่วนสูง/, /ส่วนสูง\s*\d+/, ...],
  add_medication: [/เพิ่ม.*ยา/, /ยา.*ใหม่/, ...],
  // ...
};
```

### การแก้ไข (Legacy Mode เท่านั้น)

#### เพิ่ม Pattern ใหม่
```typescript
// เพิ่มใน patterns object
new_intent: [
  /pattern1/,
  /pattern2.*ยืดหยุ่น/,
  /^exact pattern$/
],
```

#### เพิ่ม High Confidence Intent
```typescript
// Line ~180 - Intent ที่ต้อง match แน่นอน
const highConfidenceIntents = [
  'emergency', 'report', 'report_menu', 'patient_info',
  'edit_weight', 'add_medication',
  'new_intent'  // เพิ่มตรงนี้
];
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เพิ่ม pattern | เฉพาะ Legacy mode | 🟢 ต่ำ |
| แก้ไข pattern ที่มี | อาจ match ผิดพลาด | 🟡 กลาง |

> **หมายเหตุ:** ปัจจุบันใช้ Natural Conversation Mode เป็นหลัก ไม่แนะนำให้แก้ไขไฟล์นี้

---

## 4. HealthAgent (Health Data Processing)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/specialized/HealthAgent.ts` |
| **Model** | claude-sonnet-4.5 |
| **Temperature** | 0.3 |
| **Role** | Validate และบันทึก health data |

### หน้าที่หลัก
1. รับ health data จาก orchestrator
2. Validate ค่าสุขภาพ (ความดัน, ชีพจร, น้ำตาล)
3. Check abnormal values (ค่าผิดปกติ)
4. Save to database (activity_logs, vitals_logs)
5. Generate response พร้อม alert ถ้าจำเป็น

### Validation Rules
```typescript
private validationRules = {
  bloodPressure: {
    systolic: { min: 70, max: 200 },   // ความดันบน
    diastolic: { min: 40, max: 130 }   // ความดันล่าง
  },
  heartRate: { min: 40, max: 200 },    // ชีพจร (bpm)
  bloodSugar: { min: 50, max: 400 },   // น้ำตาล (mg/dL)
  water: { min: 0, max: 5000 }         // น้ำ (ml)
};
```

### Key Methods
```typescript
// Main processing
process(message: Message): Promise<Response>

// Process by intent type
processMedication(message, logData): Promise<any>
processVitals(message, logData): Promise<any>
processWater(message, logData): Promise<any>
processFood(message, logData): Promise<any>
processExercise(message, logData): Promise<any>

// Validation
validateVitals(entities: any): boolean
checkVitalAlert(entities: any): string | null
```

### Alert Conditions
```typescript
// High blood pressure
if (systolic >= 140 || diastolic >= 90) → 'high_blood_pressure'

// Low blood pressure
if (systolic <= 90 || diastolic <= 60) → 'low_blood_pressure'

// High heart rate
if (heartRate > 100) → 'high_heart_rate'

// Low heart rate
if (heartRate < 60) → 'low_heart_rate'
```

### การแก้ไข

#### เปลี่ยน Validation Range
```typescript
// Line 6-14
private validationRules = {
  bloodPressure: {
    systolic: { min: 80, max: 180 },  // เปลี่ยน range
    diastolic: { min: 50, max: 120 }
  },
  // ...
};
```

#### เพิ่ม Alert Condition
```typescript
// ใน checkVitalAlert()
if (temperature >= 38.5) {
  return 'high_fever';
}
```

#### เพิ่ม Process Type ใหม่
```typescript
// เพิ่ม case ใน process()
case 'new_type':
  logData = await this.processNewType(message, logData);
  break;

// เพิ่ม method
private async processNewType(message: Message, logData: any) {
  // Extract and validate data
  return logData;
}
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เปลี่ยน validation range | เปลี่ยนเกณฑ์ปกติ/ผิดปกติ | 🟡 กลาง |
| เพิ่ม alert condition | แจ้งเตือนใหม่ | 🟢 ต่ำ |
| เพิ่ม process type | ต้องแก้ routing ด้วย | 🟡 กลาง |

---

## 5. ReportAgent (Report Generation)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/specialized/ReportAgent.ts` |
| **Model** | claude-3-sonnet-20240229 |
| **Temperature** | 0.7 (สูงกว่าปกติเพื่อความ creative) |
| **Role** | สร้างรายงานสุขภาพ daily/weekly/monthly |

### หน้าที่หลัก
1. รับ request พร้อม reportType
2. ดึงข้อมูลจาก database ตาม period
3. สร้าง Flex Message หรือ text report
4. Handle กรณีไม่มีข้อมูล

### Report Types
| Type | Description | Period |
|------|-------------|--------|
| `report_menu` | เมนูเลือกประเภท | - |
| `daily` | รายงานวันนี้ | 24 ชั่วโมง |
| `weekly` | รายงานสัปดาห์ | 7 วัน |
| `monthly` | รายงานเดือน | 30 วัน |

### Key Methods
```typescript
// Main processing
process(message: Message): Promise<Response>

// Fetch data from DB
fetchReportData(patientId, type): Promise<any>

// Create Flex Message for menu
createReportMenuFlexMessage(): FlexMessage

// Check if report has data
checkReportHasData(reportData, reportType): boolean

// Get "no data" message
getNoDataMessage(reportType): string
```

### การแก้ไข

#### เปลี่ยน Report Period
```typescript
// ใน fetchReportData() ~line 136
if (type === 'weekly') {
  startDate.setDate(startDate.getDate() - 7);  // เปลี่ยนเป็น -14 = 2 สัปดาห์
}
```

#### เปลี่ยน Report Menu Design
```typescript
// ใน createReportMenuFlexMessage()
// แก้ไข Flex Message JSON ตามต้องการ
```

#### เพิ่ม Report Type ใหม่
```typescript
// 1. เพิ่มใน process()
} else if (reportType === 'quarterly') {
  reportData = await reportService.generateQuarterlyReport(patientId);
  reportText = reportService.formatQuarterlyReportText(reportData);
}

// 2. เพิ่มใน report.service.ts (ไฟล์อื่น)
async generateQuarterlyReport(patientId: string) {
  // ...
}
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เปลี่ยน period | เปลี่ยนข้อมูลที่แสดง | 🟢 ต่ำ |
| เปลี่ยน Flex design | เปลี่ยน UI | 🟢 ต่ำ |
| เพิ่ม report type | ต้องแก้ service ด้วย | 🟡 กลาง |

---

## 6. AlertAgent (Emergency & Alerts)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/specialized/AlertAgent.ts` |
| **Model** | claude-sonnet-4.5 |
| **Temperature** | 0.1 (ต่ำมากเพื่อความแม่นยำ) |
| **Role** | ตรวจจับฉุกเฉินและส่ง alert |

### Alert Levels
```typescript
private alertLevels = {
  INFO: 1,      // บันทึกเฉยๆ
  WARNING: 2,   // แจ้งเตือน
  URGENT: 3,    // เร่งด่วน
  CRITICAL: 4   // ฉุกเฉินมาก
};
```

### Emergency Keywords
```typescript
const emergencyKeywords = ['ฉุกเฉิน', 'ช่วย', 'เจ็บ', 'ล้ม', 'หายใจไม่ออก'];
const warningKeywords = ['ไม่สบาย', 'ปวด', 'เหนื่อย', 'มึน'];
```

### Key Methods
```typescript
// Main processing
process(message: Message): Promise<Response>

// Detect alert type from content
detectAlertType(content: string): string

// Determine level based on type
determineAlertLevel(type: string, message: Message): number

// Send alert to caregivers
sendAlert(message: Message, level: number): Promise<void>

// Format alert message
formatAlertMessage(message, level, patient, group): string

// Handle realtime alerts
handleRealtimeAlert(payload: any): void
```

### Escalation Matrix
| Level | Condition | Action | Notification |
|-------|-----------|--------|--------------|
| INFO (1) | Missed activity | Log | None |
| WARNING (2) | No response 4h | Remind | Patient |
| URGENT (3) | No response 8h | Alert | Primary caregiver |
| CRITICAL (4) | Emergency keyword | Urgent | All caregivers + 1669 |

### การแก้ไข

#### เพิ่ม Emergency Keyword
```typescript
// Line 102
const emergencyKeywords = [
  'ฉุกเฉิน', 'ช่วย', 'เจ็บ', 'ล้ม', 'หายใจไม่ออก',
  'หมดสติ', 'ช็อก'  // เพิ่มตรงนี้
];
```

#### เปลี่ยน Alert Level Logic
```typescript
// ใน determineAlertLevel()
case 'no_response':
  const hours = message.metadata?.hoursNoResponse || 0;
  if (hours > 12) return this.alertLevels.CRITICAL;  // เปลี่ยนเป็น 12 ชม.
  if (hours > 6) return this.alertLevels.URGENT;     // เปลี่ยนเป็น 6 ชม.
  if (hours > 2) return this.alertLevels.WARNING;    // เปลี่ยนเป็น 2 ชม.
```

#### เปลี่ยน Alert Message
```typescript
// Line 71 - Emergency response
responseText = `🆘 ได้รับแจ้งฉุกเฉินแล้วค่ะ!

✅ กำลังแจ้งเตือนผู้ดูแลทุกคนในกลุ่ม
⏰ เวลา: ${new Date().toLocaleTimeString('th-TH')} น.

📞 หากเป็นกรณีฉุกเฉินร้ายแรง กรุณาโทร 1669`;
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เพิ่ม keyword | แจ้งเตือนง่ายขึ้น | 🟢 ต่ำ |
| เปลี่ยน level logic | เปลี่ยนความเร็วแจ้งเตือน | 🟡 กลาง |
| เปลี่ยน message | เปลี่ยน UX | 🟢 ต่ำ |

---

## 7. DialogAgent (General Conversation)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/specialized/DialogAgent.ts` |
| **Model** | claude-sonnet-4.5 |
| **Temperature** | 0.8 (สูงเพื่อความ natural) |
| **Role** | ตอบคำถามทั่วไป, greeting, help |

### หน้าที่หลัก
1. Handle greeting (สวัสดี, หวัดดี)
2. Handle help requests (ใช้งานยังไง)
3. ตอบคำถามทั่วไปที่ไม่ใช่ health logging
4. Provide intent suggestions (Legacy mode เท่านั้น)

### Intent Suggestions (Legacy Mode)
```typescript
private intentSuggestions = [
  {
    pattern: /อยาก.*บันทึก.*ยา/i,
    intent: 'medication',
    suggestion: 'บันทึกยา',
    action: 'พิมพ์ "กินยาแล้ว" ได้เลยค่ะ'
  },
  {
    pattern: /อยาก.*ดู.*รายงาน/i,
    intent: 'report',
    suggestion: 'ดูรายงาน',
    action: 'พิมพ์ "รายงานวันนี้" ได้เลยค่ะ'
  },
  // ...
];
```

### Key Methods
```typescript
// Main processing
process(message: Message): Promise<Response>

// Check for intent suggestion (Legacy)
checkIntentSuggestion(text: string): object | null

// Build system prompt for Claude
buildSystemPrompt(isGroupChat: boolean, patientData: any): string

// Build patient context for prompt
buildPatientContext(patientData: any): string
```

### การแก้ไข

#### เปลี่ยน Mode Flag
```typescript
// Line 5
const USE_NATURAL_CONVERSATION_MODE = true;
// เปลี่ยนเป็น false เพื่อใช้ intent suggestions
```

#### เพิ่ม Intent Suggestion (Legacy Mode)
```typescript
// เพิ่มใน intentSuggestions array
{
  pattern: /อยาก.*ดู.*ยา/i,
  intent: 'medication_list',
  suggestion: 'ดูรายการยา',
  action: 'พิมพ์ "ยาอะไรบ้าง" ได้เลยค่ะ'
},
```

#### เปลี่ยน Temperature (ความ creative)
```typescript
// Line 79
temperature: 0.8,  // 0.7-0.9 recommended
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เปลี่ยน mode | เปลี่ยนพฤติกรรม response | 🟡 กลาง |
| เพิ่ม suggestion | Legacy mode เท่านั้น | 🟢 ต่ำ |
| เปลี่ยน temperature | เปลี่ยนความ natural | 🟢 ต่ำ |

---

## 8. ProfileEditAgent (Profile CRUD)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/agents/specialized/ProfileEditAgent.ts` |
| **Model** | claude-sonnet-4.5 |
| **Temperature** | 0.3 |
| **Role** | แก้ไขข้อมูลส่วนตัว, ยา, reminders ผ่าน chat |

### หน้าที่หลัก
1. รับ edit intent จาก orchestrator
2. Extract ค่าจาก message
3. Validate ค่า (น้ำหนัก, ส่วนสูง, เบอร์โทร)
4. Update database
5. Return success/error response

### Validation Rules
```typescript
const VALIDATION_RULES = {
  weight_kg: { min: 20, max: 200, unit: 'กก.' },
  height_cm: { min: 50, max: 250, unit: 'ซม.' },
  phone_number: { pattern: /^0\d{8,9}$/, format: '0XX-XXX-XXXX' },
  blood_type: { valid: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }
};
```

### Handlers
| Intent | Method | Example Input |
|--------|--------|---------------|
| `edit_weight` | handleEditWeight() | "น้ำหนัก 65 กิโล" |
| `edit_height` | handleEditHeight() | "ส่วนสูง 170 ซม." |
| `edit_phone` | handleEditPhone() | "เปลี่ยนเบอร์ 0891234567" |
| `edit_name` | handleEditName() | "ชื่อใหม่คือ สมศรี" |
| `edit_address` | handleEditAddress() | "ที่อยู่ใหม่คือ 123 ถ.สุขุมวิท" |
| `edit_blood_type` | handleEditBloodType() | "กรุ๊ปเลือด O+" |
| `edit_medical_condition` | handleEditMedicalCondition() | "เพิ่มโรคเบาหวาน" |
| `edit_allergies` | handleEditAllergies() | "แพ้ยาเพนนิซิลิน" |
| `add_medication` | handleAddMedication() | "เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น" |
| `edit_medication` | handleEditMedication() | "แก้ยาเมทฟอร์มินเป็น 1000mg" |
| `delete_medication` | handleDeleteMedication() | "ลบยาพาราเซตามอล" |
| `add_reminder` | handleAddReminder() | "ตั้งเตือนกินยา 8 โมง" |
| `edit_reminder` | handleEditReminder() | "เปลี่ยนเวลาเตือนเป็น 9 โมง" |
| `delete_reminder` | handleDeleteReminder() | "ลบเตือนกินยาเช้า" |

### Key Methods
```typescript
// Main processing
process(message: Message): Promise<Response>

// Profile handlers
handleEditWeight(message, patientId, startTime): Promise<Response>
handleEditHeight(message, patientId, startTime): Promise<Response>
handleEditPhone(message, patientId, startTime): Promise<Response>
// ... etc

// Medication handlers
handleAddMedication(message, patientId, startTime): Promise<Response>
handleEditMedication(message, patientId, startTime): Promise<Response>
handleDeleteMedication(message, patientId, startTime): Promise<Response>

// Reminder handlers
handleAddReminder(message, patientId, startTime): Promise<Response>
handleEditReminder(message, patientId, startTime): Promise<Response>
handleDeleteReminder(message, patientId, startTime): Promise<Response>

// Helpers
extractNumber(text: string): number | null
askForValue(field, unit, example, startTime): Response
invalidValue(field, validRange, startTime): Response
successResponse(field, value, startTime): Response
```

### การแก้ไข

#### เปลี่ยน Validation Range
```typescript
// Line 17
const VALIDATION_RULES = {
  weight_kg: { min: 30, max: 150, unit: 'กก.' },  // เปลี่ยน range
  // ...
};
```

#### เพิ่ม Field ใหม่
```typescript
// 1. เพิ่มใน FIELD_MAPPINGS
const FIELD_MAPPINGS = {
  // ...
  'newfield': 'new_field_in_db'
};

// 2. เพิ่ม handler
private async handleEditNewField(message: Message, patientId: string, startTime: number) {
  const value = this.extractValue(message.content);
  // validate...
  await userService.updatePatientProfile(patientId, { new_field_in_db: value });
  return this.successResponse('New Field', value, startTime);
}

// 3. เพิ่มใน switch case ของ process()
case 'edit_new_field':
  return await this.handleEditNewField(message, patientId, startTime);
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เปลี่ยน validation | เปลี่ยนเกณฑ์ยอมรับ | 🟡 กลาง |
| เพิ่ม field | ต้องแก้ DB schema ด้วย | 🔴 สูง |
| แก้ success message | เปลี่ยน UX | 🟢 ต่ำ |

---

## NLU Prompt (หัวใจของ Natural Conversation)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/lib/ai/prompts/unified-nlu.ts` |
| **Role** | กำหนดบุคลิก, Intent categories, ตัวอย่างการ extract |

### Structure
```
UNIFIED_NLU_SYSTEM_PROMPT
├── บุคลิกของคุณ
├── หลักการสนทนาธรรมชาติ
├── น้ำเสียงและภาษา
├── การเข้าใจภาษาธรรมชาติ (ตัวอย่าง)
├── Multi-Data Extraction
├── Intent Categories
│   ├── health_log (medication, vitals, symptom, water, exercise, sleep, mood)
│   ├── profile_update (name, weight, height, phone, address, blood_type, allergies)
│   ├── medication_manage (add, edit, delete, list)
│   ├── reminder_manage (add, edit, delete, list)
│   ├── query (patient_info, report, history)
│   ├── emergency
│   ├── greeting
│   └── general_chat
├── การ Extract ข้อมูล (ชื่อผู้ป่วย, เวลา, ค่าสุขภาพ)
├── Action Types
└── Output Format (JSON)
```

### การแก้ไข Intent

#### เพิ่ม Intent ใหม่
```typescript
// 1. เพิ่มใน UNIFIED_NLU_SYSTEM_PROMPT
`
### new_category - คำอธิบาย
SubIntents:
- sub1: คำอธิบาย
- sub2: คำอธิบาย

ตัวอย่าง new_category:
- "ข้อความ 1" → action: { type: "save", target: "new_table" }
- "ข้อความ 2" → action: { type: "query", target: "new_table" }
`

// 2. เพิ่ม Type ใน src/types/nlu.types.ts
export type MainIntent =
  | 'health_log'
  | 'new_category'  // เพิ่ม
  | ...;

// 3. เพิ่ม Handler ใน src/lib/actions/action-router.ts
case 'new_category':
  return await handleNewCategoryAction(nluResult, context);
```

#### เพิ่ม SubIntent
```typescript
// เพิ่มใน health_log section
`
- new_sub: คำอธิบาย

ตัวอย่าง:
- "ข้อความ" → healthData: { type: "new_sub", new_sub: { value: 123 } }
`
```

#### เปลี่ยน Personality
```typescript
// เปลี่ยนใน "บุคลิกของคุณ" section
`
## บุคลิกของคุณ
- เป็นกันเอง อบอุ่น ใส่ใจ เหมือนหลานสาวที่ดูแลผู้ใหญ่ในบ้าน
// เปลี่ยนตรงนี้ตามต้องการ
`
```

#### เพิ่มตัวอย่าง Extract
```typescript
// เพิ่มใน section ที่เกี่ยวข้อง
`
ตัวอย่าง health_log:
- "กินยาแล้วค่ะ" → healthData: { type: "medication", medication: { taken: true } }
- "ข้อความใหม่" → healthData: { type: "xxx", xxx: { ... } }  // เพิ่มตรงนี้
`
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เปลี่ยน personality | เปลี่ยน tone ทั้งระบบ | 🟡 กลาง |
| เพิ่ม intent | ต้องแก้ types + router | 🟡 กลาง |
| เพิ่มตัวอย่าง | ช่วย Claude เข้าใจดีขึ้น | 🟢 ต่ำ |
| ลบ intent | ระบบอาจไม่เข้าใจ | 🔴 สูง |

---

## Action Router (Database Actions)

### ข้อมูลพื้นฐาน
| Item | Value |
|------|-------|
| **File** | `src/lib/actions/action-router.ts` |
| **Role** | Execute database actions based on NLU result |

### Action Types
| Type | Function | Description |
|------|----------|-------------|
| `save` | handleSaveAction() | Insert new record |
| `update` | handleUpdateAction() | Update existing record |
| `delete` | handleDeleteAction() | Delete record |
| `query` | handleQueryAction() | Fetch and return data |
| `confirm` | (pending) | Return pending status |
| `clarify` | (none) | Just respond |
| `none` | (none) | Just respond |

### Database Tables
| Table | ใช้บันทึก | Save Method |
|-------|-----------|-------------|
| `activity_logs` | กินยา, ดื่มน้ำ, ออกกำลังกาย | saveActivityLog() |
| `vitals_logs` | ความดัน, ชีพจร, น้ำตาล | saveVitalsLog() |
| `mood_logs` | อารมณ์, ความเครียด | saveMoodLog() |
| `symptoms` | อาการป่วย | saveSymptom() |
| `sleep_logs` | การนอน | saveSleepLog() |
| `exercise_logs` | การออกกำลังกาย | saveExerciseLog() |
| `medications` | รายการยา | saveMedication() |
| `reminders` | การเตือน | saveReminder() |
| `patient_profiles` | ข้อมูลส่วนตัว | updatePatientProfile() |
| `conversation_logs` | บทสนทนา | saveConversationLog() |
| `health_events` | Linking table | saveHealthEvent() |

### Key Methods
```typescript
// Main entry point
executeAction(nluResult: NLUResult, context: NLUContext): Promise<ActionResult>

// Action handlers
handleSaveAction(nluResult, context): Promise<ActionResult>
handleUpdateAction(nluResult, context): Promise<ActionResult>
handleDeleteAction(nluResult, context): Promise<ActionResult>
handleQueryAction(nluResult, context): Promise<ActionResult>

// Health data processing
saveHealthData(healthData, context, rawText): Promise<ActionResult>
saveMultipleHealthData(healthDataArray, context, rawText): Promise<ActionResult>

// Profile/Medication/Reminder
saveProfileUpdate(data, context): Promise<ActionResult>
saveMedication(data, context): Promise<ActionResult>
updateMedication(data, context): Promise<ActionResult>
deleteMedication(data, context): Promise<ActionResult>
saveReminder(data, context): Promise<ActionResult>
updateReminder(data, context): Promise<ActionResult>
deleteReminder(data, context): Promise<ActionResult>

// Helpers
convertToExtractedData(healthData): AIExtractedData
checkForAbnormalVitals(vitals): AbnormalAlert[]
```

### การแก้ไข

#### เพิ่ม Action Type ใหม่
```typescript
// เพิ่มใน executeAction()
case 'new_action':
  return await handleNewAction(nluResult, context);

// เพิ่ม function
async function handleNewAction(nluResult, context): Promise<ActionResult> {
  // implement...
}
```

#### เพิ่ม Table ใหม่
```typescript
// 1. เพิ่มใน supabase.service.ts
async saveNewTable(data: NewTableData): Promise<string> {
  const { data: result, error } = await this.client
    .from('new_table')
    .insert(data)
    .select('id')
    .single();
  return result?.id;
}

// 2. เรียกใช้ใน action-router.ts
await supabaseService.saveNewTable(data);
```

### ผลกระทบจากการแก้ไข
| การแก้ไข | ผลกระทบ | ระดับความเสี่ยง |
|----------|---------|----------------|
| เพิ่ม action type | ต้องแก้ NLU prompt ด้วย | 🟡 กลาง |
| เพิ่ม table | ต้องสร้าง table ใน DB | 🔴 สูง |
| แก้ save logic | กระทบการบันทึกทั้งหมด | 🔴 สูง |

---

## Quick Reference

### Files ที่ต้องแก้บ่อย

| Task | File | ความเสี่ยง |
|------|------|-----------|
| เปลี่ยนบุคลิก/tone | `src/lib/ai/prompts/unified-nlu.ts` | 🟡 |
| เพิ่ม Intent | `unified-nlu.ts` + `nlu.types.ts` + `action-router.ts` | 🟡 |
| เพิ่มตัวอย่าง extract | `src/lib/ai/prompts/unified-nlu.ts` | 🟢 |
| เปลี่ยน validation rules | `HealthAgent.ts` หรือ `ProfileEditAgent.ts` | 🟡 |
| เปลี่ยน alert keywords | `src/agents/specialized/AlertAgent.ts` | 🟢 |
| เปลี่ยน AI model | `src/agents/core/UnifiedNLUAgent.ts` | 🟡 |
| เพิ่ม DB action | `src/lib/actions/action-router.ts` | 🔴 |
| เพิ่ม special request | `src/agents/core/OrchestratorAgent.ts` | 🟢 |

### Risk Legend
- 🟢 ต่ำ: กระทบเฉพาะส่วน, ง่ายต่อการ rollback
- 🟡 กลาง: กระทบหลายส่วน, ต้อง test ดี
- 🔴 สูง: กระทบทั้งระบบ, ต้อง test อย่างละเอียด

### Commands

```bash
# Build TypeScript
npm run build

# Run locally
npm run dev

# Deploy (auto on push to main)
git push origin main
```

---

## Architecture Files Summary

```
src/
├── agents/
│   ├── core/
│   │   ├── BaseAgent.ts              # Base class for all agents
│   │   ├── OrchestratorAgent.ts      # Main coordinator ⭐
│   │   └── UnifiedNLUAgent.ts        # Claude-first NLU ⭐
│   └── specialized/
│       ├── IntentAgent.ts            # Legacy pattern matching
│       ├── HealthAgent.ts            # Health data validation
│       ├── ReportAgent.ts            # Report generation
│       ├── AlertAgent.ts             # Emergency/alerts
│       ├── DialogAgent.ts            # General conversation
│       └── ProfileEditAgent.ts       # Profile CRUD
│
├── lib/
│   ├── ai/
│   │   └── prompts/
│   │       └── unified-nlu.ts        # NLU prompt ⭐⭐ (MAIN FILE)
│   └── actions/
│       └── action-router.ts          # DB action execution ⭐
│
├── types/
│   ├── nlu.types.ts                  # NLU type definitions
│   └── health.types.ts               # Health data types
│
└── services/
    ├── openrouter.service.ts         # AI API client
    └── supabase.service.ts           # Database client
```

**Legend:**
- ⭐⭐ = แก้ไขบ่อยที่สุด
- ⭐ = แก้ไขบ่อย

---

*Last Updated: 2025-12-26*
