# Claude Development Session Log

## Session: 2025-11-23

### Issue: Report Menu Not Displaying as Flex Message
**Problem:** When users typed "ดูรายงาน", the system returned plain text instead of the expected Flex Message menu.

### Root Cause Analysis (Multiple Iterations)

#### First Analysis (Incorrect):
1. **Low Intent Confidence (0.5):** IntentAgent correctly detected `report_menu` but with low confidence
2. **Missing PatientId:** ReportAgent required `patientId` for all operations, causing error for menu display
3. **Empty Agent Routing:** OrchestratorAgent had `plan.agents = []` for `report_menu`, preventing ReportAgent from being called

#### Second Analysis (Correct):
**The real problem:** Intent confidence = 0.5, but `report_menu` case was inside `if (confidence > 0.8)` block
- When confidence < 0.8, code fell through to else block using `['health', 'dialog']` instead of `['report']`
- This is why production logs showed: `agentsInvolved: ['health', 'dialog']` and `flexMessageType: undefined`

### Solution Implemented

#### 1. ReportAgent Enhancement (`src/agents/specialized/ReportAgent.ts`)
- Added special handling for `report_menu` intent that doesn't require `patientId`
- Created `createReportMenuFlexMessage()` method with beautiful interactive menu
- Menu features:
  - Modern green header matching OONJAI theme (#10b981)
  - Three clickable buttons: Daily, Weekly, Monthly reports
  - Each button has icon, title, description, and arrow indicator
  - Clean gray background (#f3f4f6) for buttons with rounded corners

#### 2. OrchestratorAgent Fix (`src/agents/core/OrchestratorAgent.ts`) - Commit 2306c23 (DIDN'T WORK)
- Changed `plan.agents = []` to `['report']` for `report_menu` intent
- **Problem:** Still inside confidence > 0.8 check, so didn't execute when confidence = 0.5

#### 3. OrchestratorAgent Real Fix (`src/agents/core/OrchestratorAgent.ts`) - Commit 24947b1 (WORKS)
- **Moved `report_menu` as special case BEFORE confidence check**
- Now works regardless of confidence level
- Always routes to `['report']` and sets `flexMessageType = 'report_menu'`

#### 4. Index.ts Enhancement (`src/index.ts`)
- Modified to use Flex Message from ReportAgent instead of old `createReportMenuFlexMessage()` function
- Checks `result.data?.flexMessage` first before falling back to old function

### Testing & Deployment
- Built TypeScript successfully
- Server running on port 3003 for testing
- Code committed and pushed to GitHub

### Files Modified
1. `src/agents/specialized/ReportAgent.ts` - Added menu handling
2. `src/agents/core/OrchestratorAgent.ts` - Fixed agent routing
3. `CHANGELOG.md` - Documented the fix
4. `claude.md` - Created this session log

### Commit History
```
Commit 1: 2306c23 (DIDN'T WORK)
Message: Fix: Report menu Flex Message properly displays with menu options
- Modified OrchestratorAgent to route report_menu intent to ReportAgent
- Added report_menu handling in ReportAgent without requiring patientId
- Created interactive Flex Message menu with daily, weekly, and monthly report options
Problem: Still inside confidence check, so didn't work in production

Commit 2: 24947b1 (WORKS)
Message: Fix: Handle report_menu intent regardless of confidence level
- Moved report_menu as special case BEFORE confidence check
- Modified index.ts to use Flex Message from ReportAgent
- Now works with any confidence level
```

### Key Lessons Learned
1. **Check code logic thoroughly before blaming external systems**
   - Initially thought Vercel wasn't deploying
   - Actually, the first fix didn't address the root cause

2. **Test with actual production conditions**
   - Local testing might not catch confidence-level issues
   - Production logs revealed the real problem: `agentsInvolved: ['health', 'dialog']`

3. **Understanding control flow is critical**
   - The `report_menu` case was unreachable when confidence < 0.8
   - Moving it outside the confidence check fixed the issue

### Next Steps
- ✅ Monitor production deployment (Vercel auto-deploys from GitHub)
- Test all report types (daily, weekly, monthly) work correctly
- Consider adding patient selection for multi-patient groups

### Additional Notes
- SQL script `fix-group-data.sql` exists but not committed (contains data fixes for adding Popp and Goy to group)
- Migration file `COMBINED_MIGRATION_003_004_005.sql` was deleted (needs review if still needed)

---
*Session started: 2025-11-23 11:35 (Bangkok Time)*
*Final fix deployed: 2025-11-23 13:00 (Bangkok Time)*

---

## Session: 2025-11-29

### Issues Fixed

#### Issue 1: Remove @mention Requirement in Group Chat
**Problem:** Users had to @mention the bot before every message in group chat - bad UX

**Solution:**
- Removed mention check in `src/index.ts` (lines 1113-1129)
- Bot now responds to ALL messages in group chat
- Updated welcome message to reflect no-mention policy
- Updated help text in OrchestratorAgent

**Files Modified:**
- `src/index.ts` - Removed hasMention check
- `src/agents/core/OrchestratorAgent.ts` - Updated help text
- `src/agents/specialized/HealthAgent.ts` - Removed @oonjai from examples

#### Issue 2: Smart Intent Suggestions
**Problem:** Users didn't know exact commands to type

**Solution:**
- Added `intentSuggestions` array in DialogAgent with common patterns
- When user types similar phrases, bot suggests exact commands
- Examples:
  - "อยากบันทึกยา" → "พิมพ์ 'กินยาแล้ว' ได้เลยค่ะ"
  - "จะวัดความดัน" → "พิมพ์ 'ความดัน 120/80' ได้เลยค่ะ"

#### Issue 3: Group Chat vs 1:1 Context Differentiation
**Problem:** Bot mentioned "เมนูด้านล่าง" in group chat where there's no Rich Menu

**Solution:**
- Added `isGroupChat` detection in DialogAgent
- Created separate system prompts for group vs 1:1
- Group chat: NEVER mentions Rich Menu, buttons, LIFF pages
- Group chat: Only suggests text commands

#### Issue 4: "ข้อมูลผู้ป่วย" Returning Emergency Message
**Problem:** Pattern `ป่วย` in health_concern matched "ผู้ป่วย"

**Solution:**
- Removed `ป่วย` from health_concern pattern
- Used more specific pattern: `/^ไม่สบาย|รู้สึก.*ไม่สบาย|เจ็บ.*ตัว|มี.*อาการ.*แปลก/`
- DialogAgent now skips intentSuggestion when patientData is available

#### Issue 5: Registration Flex Card for Already Registered Users
**Problem:** Bot sent registration flex even when user was already registered

**Solution:**
- Check if user is already registered before showing registration flex
- In group: check if patientId exists
- In 1:1: check caregivers table
- Show "คุณลงทะเบียนแล้วค่ะ" message instead

#### Issue 6: Bot Not Using Caregiver's Saved Data (Medications, Reminders)
**Problem:** Bot didn't use medications/reminders that caregiver set up in LINE OA

**Root Cause:**
- `fetchPatientDataForQuery()` only fetched patient_profiles and medications (for some intents)
- No reminders data
- No recent activity logs
- patientData only fetched for specific intents, not general group chat

**Solution:**

1. **Enhanced `fetchPatientDataForQuery()`:**
```typescript
// Now fetches:
✅ patient_profiles
✅ medications (always, not just some intents)
✅ reminders (new!)
✅ recentActivities - last 3 days (new!)
```

2. **Always Fetch patientData for Group Chat:**
```typescript
if (patientId && (requiresPatientData || isGroupChat)) {
  patientData = await fetchPatientDataForQuery(...)
}
```

3. **Enhanced DialogAgent patientContext:**
```
👤 ข้อมูลพื้นฐาน: ชื่อ, อายุ, เพศ, กรุ๊ปเลือด
🏥 ประวัติสุขภาพ: โรคประจำตัว, แพ้ยา, แพ้อาหาร
💊 ยาที่กินประจำ: รายการยาพร้อม dosage และ schedule
🔔 การแจ้งเตือนที่ตั้งไว้: reminders พร้อมเวลา
📋 กิจกรรมวันนี้: สิ่งที่ทำไปแล้ว (พร้อมเวลา)
📞 ผู้ติดต่อฉุกเฉิน
```

### Files Modified
1. `src/index.ts` - Removed mention check, added registration check
2. `src/agents/core/OrchestratorAgent.ts` - Enhanced patientData fetching, updated help text
3. `src/agents/specialized/DialogAgent.ts` - Smart suggestions, group context, enhanced patientContext
4. `src/agents/specialized/HealthAgent.ts` - Removed @oonjai from examples

### Commit History
```
7fd0014 - Feat: Remove @mention requirement & add smart intent suggestions
289a9a1 - Fix: DialogAgent now differentiates group vs 1:1 context
0f2adca - Fix: Multiple agent response issues
[pending] - Feat: Enhanced patient data with reminders and activities
[pending] - Fix: Medications & Report intent issues
```

### Testing Notes
- Build successful: `npm run build`
- All TypeScript errors resolved
- Ready for Vercel deployment

### Issue 7: Medications Not Displaying in Bot Responses
**Problem:** Bot said "ตอนนี้คุณ เอ ไม่ได้กินยาประจำเลย" even though medications existed

**Root Cause (Multiple Issues):**
1. **Table Name Mismatch:** `supabase.service.ts` queried `patient_medications` table, but medications are stored in `medications` table
2. **Field Name Mismatch:** DialogAgent used `m.dosage` and `m.schedule`, but actual schema uses:
   - `dosage_amount`, `dosage_unit`, `dosage_form` for dosage
   - `times` array and `frequency` for schedule

**Solution:**
1. Fixed `supabase.service.ts` to query `medications` table (line 162)
2. Added JSON parsing for `days_of_week` and `times` fields
3. Fixed `DialogAgent.ts` to use correct field names

**Files Modified:**
- `src/services/supabase.service.ts` - Fixed table name and JSON parsing
- `src/agents/specialized/DialogAgent.ts` - Fixed field names for medications formatting

### Issue 8: Report Intent Not Showing Actual Data
**Problem:** When user typed "รายงานวันนี้", bot returned generic dialog response instead of actual report data

**Root Cause (Deeper Issue):**
- IntentAgent confidence calculation: `score / patterns.length`
- "รายงานวันนี้" matches 1 pattern out of 11 in `report` array
- **Confidence = 1/11 ≈ 0.09** (WAY below 0.5 threshold!)
- Falls back to Claude API which doesn't return "report" intent correctly
- Then in OrchestratorAgent, `report` was inside `if (confidence > 0.8)` block

**Solution:**
1. **Fixed IntentAgent pattern matching** (`src/agents/specialized/IntentAgent.ts`):
   - Created `highConfidenceIntents` list for specific action intents
   - These intents get 0.9 confidence on ANY pattern match
   - Other intents get minimum 0.6 confidence if any pattern matches

2. **Fixed OrchestratorAgent routing** (lines 261-278):
   - Moved `report` intent handling BEFORE confidence check
   - Added automatic reportType detection from message content
   - Pass `reportType` through metadata to ReportAgent

**Files Modified:**
- `src/agents/specialized/IntentAgent.ts` - Fixed confidence calculation
- `src/agents/core/OrchestratorAgent.ts` - Moved report handling, added reportType detection

---
*Session: 2025-11-29*
*Issues fixed: 8 major improvements*

---

## Session: 2025-12-20

### Project Status: AI Extraction Pipeline (Schema Restructure)

**Goal:** ยกระดับจาก "ระบบบันทึกแบบกรอก" → "ระบบบันทึกสุขภาพผ่านบทสนทนาธรรมชาติ" (AI Extract)

### Database Migration Status: ✅ COMPLETE

All 4 phases have been migrated successfully:

| Phase | File | Status |
|-------|------|--------|
| Phase 1 | `001_restructure_phase1_new_tables.sql` | ✅ Done |
| Phase 2 | `002_restructure_phase2_alter_tables.sql` | ✅ Done |
| Phase 3 | `003_restructure_phase3_migrate_data.sql` | ✅ Done |
| Phase 4 | `004_restructure_phase4_cleanup.sql` | ✅ Done |

**New Tables Created:**
- `symptoms` - เก็บอาการที่ extract จากบทสนทนา
- `sleep_logs` - ข้อมูลการนอน
- `exercise_logs` - ข้อมูลการออกกำลังกาย
- `health_events` - Linking table เชื่อม conversation → health data

**Altered Tables:**
- `conversation_logs` - +patient_id, +group_id, +media_url, +ai_extracted_data, +ai_confidence
- `vitals_logs` - +patient_id, +conversation_log_id, +source, +ai_confidence
- `mood_logs` - +patient_id, +stress_level, +energy_level, +ai_confidence
- `activity_logs` - +conversation_log_id, +ai_confidence, +raw_text, +health_event_id
- `health_goals` - +target_sleep_hours, +target_water_glasses, +target_steps

**Backup Tables:** 11 tables backed up with `_backup_` prefix

---

### AI Extraction Pipeline Status: ✅ CODE COMPLETE

All code files have been created:

#### 1. Core Extraction (`src/lib/ai/extraction.ts`)
- `extractHealthData()` - Main extraction function using Claude Haiku
- `parseExtractionResponse()` - Parse JSON from Claude response
- `normalizeExtractedData()` - Normalize snake_case/camelCase
- `hasHealthData()` - Check if extracted data contains health info
- `getExtractionSummary()` - Get summary string for logging

#### 2. Prompts (`src/lib/ai/prompts/extraction.ts`)
- `EXTRACTION_SYSTEM_PROMPT` - Thai health data extraction prompt
- `RESPONSE_GENERATION_PROMPT` - Response generation prompt
- `buildPatientContext()` - Build patient context string
- `buildExtractionPrompt()` - Build full prompt with patient context

#### 3. Processors (`src/lib/ai/processors/index.ts`)
- `processExtractedData()` - Main processor for all data types
- Individual processors:
  - `processSymptom()` → saves to `symptoms` table
  - `processVitals()` → saves to `vitals_logs` table
  - `processMood()` → saves to `mood_logs` table
  - `processSleep()` → saves to `sleep_logs` table
  - `processExercise()` → saves to `exercise_logs` table
  - `processMedication()` → saves to `activity_logs` table
  - `processWater()` → saves to `activity_logs` table
- All processors create `health_events` records for linking

#### 4. Pipeline Entry Point (`src/lib/ai/index.ts`)
- `runHealthExtractionPipeline()` - Main pipeline function
  1. Save conversation log
  2. Extract health data using AI
  3. Update conversation log with extracted data
  4. Process and save health data
  5. Check for abnormal values
  6. Generate response message

#### 5. Event Creator (`src/lib/health/event-creator.ts`)
- `createHealthEvent()` - Create single health event
- `createHealthEventsBatch()` - Create multiple events
- `getHealthEventsSummary()` - Get summary by type
- `checkForAbnormalValues()` - Check for abnormal BP, HR, temp, SpO2, glucose

#### 6. Types (`src/types/health.types.ts`)
- All types defined:
  - `Symptom`, `SleepLog`, `ExerciseLog`, `HealthEvent`
  - `VitalsLog`, `MoodLog`, `ConversationLog`
  - `AIExtractedData`, `ExtractedSymptom`, `ExtractedVitals`, etc.
  - Insert types: `SymptomInsert`, `SleepLogInsert`, etc.

#### 7. Supabase Service (`src/services/supabase.service.ts`)
All CRUD methods implemented:
- `saveSymptom()`, `getSymptoms()`, `getRecentSymptoms()`
- `saveSleepLog()`, `getSleepLogs()`, `getRecentSleepLogs()`
- `saveExerciseLog()`, `getExerciseLogs()`, `getRecentExerciseLogs()`
- `saveHealthEvent()`, `getHealthEvents()`, `getHealthEventsByType()`
- `saveVitalsLog()`, `getVitalsLogs()`, `getRecentVitalsLogs()`
- `saveMoodLog()`, `getMoodLogs()`, `getRecentMoodLogs()`
- `saveConversationLog()`, `updateConversationLog()`, `getConversationLogs()`
- `getHealthGoals()`, `updateHealthGoals()`

---

### ⚠️ PENDING: Webhook Integration (Phase 3)

**Current State:**
- `runHealthExtractionPipeline()` exists but is **NOT USED** in webhook
- Webhook (`src/index.ts`) still uses `orchestrator.process()` without AI extraction

**To Complete:**

```typescript
// In src/index.ts - handleTextMessage()
// Add this before or alongside orchestrator.process()

import { runHealthExtractionPipeline } from './lib/ai';

// Run extraction pipeline
const extractionResult = await runHealthExtractionPipeline(message.text, {
  patientId: context.patientId,
  patient: patientData,
  groupId: context.groupId,
  lineUserId: userId,
  displayName: displayName
});

if (extractionResult.hasHealthData) {
  // Use extracted data response
  // Or combine with orchestrator response
}
```

**Integration Options:**
1. **Replace**: Use extraction pipeline instead of orchestrator for health messages
2. **Hybrid**: Run extraction pipeline first, then orchestrator for dialog
3. **Parallel**: Run both and merge results

---

### Next Steps

1. **Integrate AI Extraction into Webhook**
   - Add `runHealthExtractionPipeline()` call in `handleTextMessage()`
   - Decide on integration strategy (replace/hybrid/parallel)
   - Handle errors gracefully (fallback to orchestrator)

2. **Test End-to-End Flow**
   - Test with Thai health messages
   - Verify data saved correctly to new tables
   - Test abnormal value alerts

3. **Polish & Monitoring**
   - Add logging for extraction results
   - Monitor AI confidence scores
   - Adjust prompts based on real usage

---

### Files Structure

```
src/lib/
├── ai/
│   ├── index.ts              # runHealthExtractionPipeline() ✅
│   ├── extraction.ts         # extractHealthData() ✅
│   ├── processors/
│   │   └── index.ts          # processExtractedData() ✅
│   └── prompts/
│       └── extraction.ts     # EXTRACTION_SYSTEM_PROMPT ✅
└── health/
    └── event-creator.ts      # createHealthEvent() ✅

src/types/
└── health.types.ts           # All types ✅

src/services/
└── supabase.service.ts       # All CRUD methods ✅
```

---
*Session: 2025-12-20 (Morning)*
*Status: AI Extraction Pipeline code complete, pending webhook integration*

---

## Session: 2025-12-20 (Afternoon) - Chat-based Profile Editing System

### Goal
เพิ่มความสามารถให้ผู้ใช้แก้ไข/อัพเดตข้อมูลส่วนตัวผ่าน LINE Chat โดยไม่ต้องเข้า LIFF pages

### Implementation Summary

#### 1. ProfileEditAgent (NEW)
**File:** `src/agents/specialized/ProfileEditAgent.ts` (~700 lines)

Main agent for handling all profile edits via chat:

```typescript
export class ProfileEditAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'profile_edit',
      role: 'Handle profile and data editing via chat',
      model: 'anthropic/claude-sonnet-4.5',
      temperature: 0.3,
      maxTokens: 1000,
      ...config
    });
  }
}
```

**Features:**
- Claude-based entity extraction for Thai natural language
- Validation rules (weight 20-200kg, height 50-250cm, phone format, blood type)
- Handlers for 16 different edit intents

**Handlers Implemented:**
| Handler | Example Input |
|---------|---------------|
| `handleEditWeight` | "น้ำหนัก 65 กิโล" |
| `handleEditHeight` | "ส่วนสูง 170 ซม." |
| `handleEditPhone` | "เปลี่ยนเบอร์ 0891234567" |
| `handleEditName` | "ชื่อใหม่คือ สมศรี มงคล" |
| `handleEditAddress` | "ที่อยู่ใหม่คือ 123 ถ.สุขุมวิท" |
| `handleEditBloodType` | "กรุ๊ปเลือด O+" |
| `handleEditMedicalCondition` | "เพิ่มโรคเบาหวาน" |
| `handleEditAllergies` | "แพ้ยาเพนนิซิลิน" |
| `handleEditEmergencyContact` | "ผู้ติดต่อฉุกเฉิน 0812345678" |
| `handleAddMedication` | "เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น" |
| `handleEditMedication` | "แก้ยาเมทฟอร์มินเป็น 1000mg" |
| `handleDeleteMedication` | "ลบยาพาราเซตามอล" |
| `handleAddReminder` | "ตั้งเตือนกินยา 8 โมง" |
| `handleEditReminder` | "เปลี่ยนเวลาเตือนกินยาเป็น 9 โมง" |
| `handleDeleteReminder` | "ลบเตือนกินยาเช้า" |
| `handleGenericEdit` | General edit with Claude extraction |

#### 2. Intent Patterns (IntentAgent.ts)

Added 17 new edit intent patterns:

```typescript
// Profile Edit Intents
edit_profile: [/แก้ไข.*ข้อมูล/, /อัพเดต.*ข้อมูล/, ...],
edit_name: [/เปลี่ยน.*ชื่อ/, /แก้.*ชื่อ/, ...],
edit_weight: [/เปลี่ยน.*น้ำหนัก/, /น้ำหนัก\s*\d+/, ...],
edit_height: [/เปลี่ยน.*ส่วนสูง/, /ส่วนสูง\s*\d+/, ...],
edit_phone: [/เปลี่ยน.*เบอร์/, /เบอร์.*ใหม่/, ...],
edit_address: [/เปลี่ยน.*ที่อยู่/, /แก้.*ที่อยู่/, ...],
edit_blood_type: [/เปลี่ยน.*กรุ๊ปเลือด/, /กรุ๊ปเลือด.*เป็น/, ...],
edit_medical_condition: [/เพิ่ม.*โรค/, /แก้.*โรค/, ...],
edit_allergies: [/เพิ่ม.*แพ้/, /แก้.*แพ้/, ...],
edit_emergency_contact: [/เปลี่ยน.*ผู้ติดต่อ.*ฉุกเฉิน/, ...],

// Medication Intents
add_medication: [/เพิ่ม.*ยา/, /ยา.*ใหม่/, ...],
edit_medication: [/แก้.*ยา/, /เปลี่ยน.*ยา/, ...],
delete_medication: [/ลบ.*ยา/, /หยุด.*ยา/, ...],

// Reminder Intents
add_reminder: [/เพิ่ม.*เตือน/, /ตั้ง.*เตือน/, ...],
edit_reminder: [/แก้.*เตือน/, /เปลี่ยน.*เวลา.*เตือน/, ...],
delete_reminder: [/ลบ.*เตือน/, /ยกเลิก.*เตือน/, ...]
```

**highConfidenceIntents updated:**
```typescript
const highConfidenceIntents = [
  'emergency', 'report', 'report_menu', 'patient_info', 'greeting',
  'log_medication', 'log_blood_pressure', 'log_water',
  // NEW: Edit intents
  'edit_profile', 'edit_name', 'edit_weight', 'edit_height',
  'edit_phone', 'edit_address', 'edit_blood_type', 'edit_medical_condition',
  'edit_allergies', 'edit_emergency_contact',
  'add_medication', 'edit_medication', 'delete_medication',
  'add_reminder', 'edit_reminder', 'delete_reminder'
];
```

#### 3. OrchestratorAgent Routing

Added routing for edit intents BEFORE confidence check:

```typescript
// Route edit intents to ProfileEditAgent
const profileEditIntents = [
  'edit_profile', 'edit_name', 'edit_weight', 'edit_height',
  'edit_phone', 'edit_address', 'edit_blood_type',
  'edit_medical_condition', 'edit_allergies', 'edit_emergency_contact'
];
const medicationEditIntents = ['add_medication', 'edit_medication', 'delete_medication'];
const reminderEditIntents = ['add_reminder', 'edit_reminder', 'delete_reminder'];

if (profileEditIntents.includes(intent) ||
    medicationEditIntents.includes(intent) ||
    reminderEditIntents.includes(intent)) {
  plan.agents = ['profile_edit'];
  plan.requiresPatientData = true;
  return plan;
}
```

#### 4. DialogAgent Suggestions

Added edit suggestions to guide users:

```typescript
// Profile edit suggestions
{ pattern: /อยาก.*เปลี่ยน.*ข้อมูล|อยาก.*แก้.*ข้อมูล/i,
  intent: 'edit_profile',
  suggestion: 'แก้ไขข้อมูล',
  action: 'พิมพ์สิ่งที่ต้องการแก้ไขได้เลยค่ะ เช่น "น้ำหนัก 65 กิโล" หรือ "เปลี่ยนเบอร์ 0891234567"' },

// Medication suggestions
{ pattern: /อยาก.*เพิ่ม.*ยา|จะ.*เพิ่ม.*ยา/i,
  intent: 'add_medication',
  suggestion: 'เพิ่มยา',
  action: 'พิมพ์ "เพิ่มยา [ชื่อยา] [ขนาด] [เวลา]" เช่น "เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น"' },

// Reminder suggestions
{ pattern: /อยาก.*ลบ.*เตือน|จะ.*ยกเลิก.*เตือน/i,
  intent: 'delete_reminder',
  suggestion: 'ลบการเตือน',
  action: 'พิมพ์ "ลบเตือน [ชื่อเตือน]" เช่น "ลบเตือนกินยาเช้า"' },
```

### TypeScript Error Fixed

**Error:** `Property 'drug_allergies' does not exist on type 'PatientProfile'. Did you mean 'drugAllergies'?`

**Fix:** Used type assertion to handle both snake_case (database) and camelCase (TypeScript):

```typescript
const currentDrugAllergies = (currentProfile as any)?.drug_allergies || currentProfile?.drugAllergies || [];
const currentFoodAllergies = (currentProfile as any)?.food_allergies || currentProfile?.foodAllergies || [];
```

### Files Modified/Created

| File | Action | Description |
|------|--------|-------------|
| `src/agents/specialized/ProfileEditAgent.ts` | NEW | Main edit agent (~700 lines) |
| `src/agents/specialized/IntentAgent.ts` | MODIFIED | Added 17 edit intent patterns |
| `src/agents/core/OrchestratorAgent.ts` | MODIFIED | Import, init, routing for ProfileEditAgent |
| `src/agents/specialized/DialogAgent.ts` | MODIFIED | Added edit suggestions |
| `CHANGELOG.md` | MODIFIED | Added 2025-12-20 section |
| `TODO.md` | MODIFIED | Added Chat-based Profile Editing section |
| `CLAUDE.md` | MODIFIED | Added this session log |

### Build Status

```bash
$ npm run build
# ✅ Build succeeded with no errors
```

### Example Conversations

```
# Simple profile edit
User: "น้ำหนัก 65 กิโล"
Bot: "✅ บันทึกน้ำหนัก 65 กก. เรียบร้อยแล้วค่ะ"

# Phone update
User: "เปลี่ยนเบอร์ 0891234567"
Bot: "✅ เปลี่ยนเบอร์โทรเป็น 089-123-4567 เรียบร้อยแล้วค่ะ"

# Add medication (smart extraction)
User: "เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น หลังอาหาร"
Bot: "✅ เพิ่มยา เมทฟอร์มิน 500mg เช้า-เย็น หลังอาหาร เรียบร้อยแล้วค่ะ"

# Delete medication
User: "ลบยาพาราเซตามอล"
Bot: "✅ ลบยา พาราเซตามอล เรียบร้อยแล้วค่ะ"

# Set reminder
User: "ตั้งเตือนกินยา 8 โมง"
Bot: "✅ ตั้งการเตือนกินยา 08:00 เรียบร้อยแล้วค่ะ"
```

---
*Session: 2025-12-20 (Afternoon)*
*Feature: Chat-based Profile Editing System - COMPLETE*

---

## Session: 2025-12-21 - Natural Conversation Architecture (Claude-First NLU)

### Goal
เปลี่ยนระบบจาก **Command-Based** (Pattern Matching) → **Natural Conversation** (Claude-First NLU)
ให้ AI เข้าใจการสนทนาแบบธรรมชาติ ไม่ต้องสอน user พิมพ์ command

### Problem Statement

**Before (Command-Based):**
```
User: "ยายกินยาเสร็จแล้วค่ะหลังอาหารเช้า"
Bot:  "ได้รับข้อความแล้วค่ะ"  ← ไม่เข้าใจ (ไม่ตรง pattern)

User: "อยากบันทึกยา"
Bot:  "💡 พิมพ์ 'กินยาแล้ว' ได้เลยค่ะ"  ← สอน command
```

**After (Natural Conversation):**
```
User: "ยายกินยาเสร็จแล้วค่ะหลังอาหารเช้า"
Bot:  "บันทึกให้ยายเรียบร้อยแล้วค่ะ กินยาหลังอาหารเช้า 🌅"

User: "วัดความดันได้ 140 กับ 90 ค่ะ"
Bot:  "บันทึกความดัน 140/90 แล้วค่ะ สูงกว่าปกตินิดหน่อย ดื่มน้ำเยอะๆ นะคะ 💧"
```

### Implementation Summary

#### Phase 1: Create unified-nlu.ts prompt ✅
**File:** `src/lib/ai/prompts/unified-nlu.ts` (NEW)

- `UNIFIED_NLU_SYSTEM_PROMPT` - Comprehensive prompt for Thai health conversations
- Intent Categories: health_log, profile_update, medication_manage, reminder_manage, query, emergency, greeting, general_chat
- SubIntents for each category
- Entity extraction patterns (patient name, time, values)
- Response guidelines (natural, not command-like)
- Output format: JSON with intent, entities, healthData, action, response

Helper functions:
- `buildUnifiedNLUPrompt()` - Combines message with context
- `buildPatientContextString()` - Formats patient data for Claude
- `buildRecentActivitiesString()` - Formats today's activities
- `buildConversationHistoryString()` - Formats conversation history

#### Phase 2: Create nlu.types.ts ✅
**File:** `src/types/nlu.types.ts` (NEW)

Type definitions:
- `MainIntent`, `SubIntent` - Intent type unions
- `NLUEntities` - Extracted entities interface
- `NLUHealthData` - Health data with sub-types (MedicationHealthData, VitalsHealthData, etc.)
- `NLUAction` - Action to be executed
- `NLUResult` - Complete NLU result from Claude
- `NLUContext` - Context passed to NLU
- `ActionResult` - Result of action execution
- `AbnormalAlert` - Alert for abnormal vital values

#### Phase 3: Create UnifiedNLUAgent.ts ✅
**File:** `src/agents/core/UnifiedNLUAgent.ts` (NEW)

```typescript
export class UnifiedNLUAgent extends BaseAgent {
  // Single Claude call for intent + extraction + response
  async processNLU(input: NLUInput): Promise<NLUResult>

  // Parse Claude's JSON response
  private parseNLUResponse(response: string, originalMessage: string): NLUResult

  // Normalize intent and health data
  private normalizeIntent(intent: string): MainIntent
  private normalizeHealthData(healthData: any): NLUHealthData | null

  // Fallback for unparseable responses
  private inferFromFreeText(response: string, originalMessage: string): NLUResult

  // Static helpers
  static requiresAction(nluResult: NLUResult): boolean
  static hasHealthData(nluResult: NLUResult): boolean
  static getExtractionSummary(nluResult: NLUResult): string
}
```

#### Phase 4: Create action-router.ts ✅
**File:** `src/lib/actions/action-router.ts` (NEW)

```typescript
// Main entry point
export async function executeAction(nluResult: NLUResult, context: NLUContext): Promise<ActionResult>

// Action handlers
async function handleSaveAction(nluResult, context): Promise<ActionResult>
async function handleUpdateAction(nluResult, context): Promise<ActionResult>
async function handleDeleteAction(nluResult, context): Promise<ActionResult>
async function handleQueryAction(nluResult, context): Promise<ActionResult>

// Health data saving
async function saveHealthData(healthData, context, rawText): Promise<ActionResult>
function convertToExtractedData(healthData: NLUHealthData): AIExtractedData
function checkForAbnormalVitals(vitals): AbnormalAlert[]

// Profile/Medication/Reminder operations
async function saveProfileUpdate(data, context): Promise<ActionResult>
async function saveMedication(data, context): Promise<ActionResult>
async function updateMedication(data, context): Promise<ActionResult>
async function deleteMedication(data, context): Promise<ActionResult>
async function saveReminder(data, context): Promise<ActionResult>
async function updateReminder(data, context): Promise<ActionResult>
async function deleteReminder(data, context): Promise<ActionResult>
```

#### Phase 5: Update OrchestratorAgent.ts ✅
**File:** `src/agents/core/OrchestratorAgent.ts` (MODIFIED)

Changes:
- Added `USE_NATURAL_CONVERSATION_MODE = true` flag
- Added `UnifiedNLUAgent` to agent registry
- New method `processWithNaturalConversation()` for Claude-first flow
- New method `handleReportQuery()` for report delegation
- Renamed original process to `processWithIntentRouting()` as legacy fallback
- Automatic fallback to legacy mode if NLU fails

```typescript
async process(message: Message): Promise<Response> {
  if (USE_NATURAL_CONVERSATION_MODE) {
    return this.processWithNaturalConversation(message, startTime);
  }
  return this.processWithIntentRouting(message, startTime);
}
```

#### Phase 6: Update DialogAgent.ts ✅
**File:** `src/agents/specialized/DialogAgent.ts` (MODIFIED)

Changes:
- Added `USE_NATURAL_CONVERSATION_MODE = true` flag
- Disabled command suggestions when in natural mode
- Updated system prompt to not teach commands
- Natural conversation guidelines for group chat

```typescript
// Before: "พิมพ์ 'กินยาแล้ว' ได้เลยค่ะ"
// After: Understands naturally and responds naturally
```

### Architecture Diagram

```
User Message
      ↓
┌─────────────────────────────────────────────────────────────┐
│                 UnifiedNLUAgent (NEW)                       │
│                                                             │
│  SINGLE Claude API Call:                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Input: message + patientContext + conversationHistory │  │
│  │                                                       │  │
│  │ Output: {                                             │  │
│  │   intent: "health_log",                               │  │
│  │   subIntent: "medication",                            │  │
│  │   confidence: 0.95,                                   │  │
│  │   entities: { patientName, time, values... },         │  │
│  │   healthData: { ... },                                │  │
│  │   action: { type: "save", target: "activity_logs" },  │  │
│  │   response: "บันทึกให้ยายเรียบร้อยแล้วค่ะ..."         │  │
│  │ }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│              ActionRouter (Simplified)                       │
│  - Execute action based on NLU result                       │
│  - Save to database                                         │
│  - Return Claude-generated response                         │
└─────────────────────────────────────────────────────────────┘
```

### Files Created
| File | Description |
|------|-------------|
| `src/lib/ai/prompts/unified-nlu.ts` | Unified NLU prompt + helpers |
| `src/types/nlu.types.ts` | Type definitions for NLU system |
| `src/agents/core/UnifiedNLUAgent.ts` | Claude-first NLU agent |
| `src/lib/actions/action-router.ts` | Action execution router |

### Files Modified
| File | Changes |
|------|---------|
| `src/agents/core/OrchestratorAgent.ts` | Added natural conversation mode |
| `src/agents/specialized/DialogAgent.ts` | Disabled command suggestions |
| `TODO.md` | Added Natural Conversation Architecture section |

### Build Status
```bash
$ npm run build
# ✅ Build succeeded with no TypeScript errors
```

### Configuration

To switch between modes:
```typescript
// In OrchestratorAgent.ts and DialogAgent.ts
const USE_NATURAL_CONVERSATION_MODE = true;  // Claude-first NLU
const USE_NATURAL_CONVERSATION_MODE = false; // Legacy IntentAgent + Routing
```

### Response Style Guidelines

**DO (Natural):**
- "บันทึกให้แล้วค่ะ" ✅
- "ได้เลยค่ะ อัพเดตให้แล้ว" ✅
- ใช้ emoji พอประมาณ 💊💧🌅
- ถามกลับถ้าไม่ชัดเจน

**DON'T (Command-like):**
- "พิมพ์ 'กินยาแล้ว'" ❌
- "กรุณาระบุ..." ❌
- "คำสั่งไม่ถูกต้อง" ❌

### Key Benefits
1. **Natural Input Recognition**: Understands Thai health messages without exact pattern matching
2. **No Command Training**: Bot never says "พิมพ์ '...'"
3. **Context Awareness**: Correctly identifies patient from context
4. **Response Quality**: Natural, warm, helpful responses
5. **Action Accuracy**: Correct database operations based on semantic understanding
6. **Fallback Safety**: Legacy mode fallback if NLU fails

---
*Session: 2025-12-21*
*Feature: Natural Conversation Architecture - COMPLETE*

---

## Session: 2025-12-21 (Bugfix)

### Issue: Natural Conversation Response Not Sent to LINE

**Problem:** NLU correctly detected intent and generated response, but LINE message wasn't sent.

**Logs Showed:**
```
NLU: profile_update/null (75%)
response: 'ได้เลยค่ะ อยากเปลี่ยนข้อมูลอะไรคะ?...'
⚠️ No response to send: { success: true, hasResponse: false }
```

**Root Cause:**
- `src/index.ts` line 1541 looked for `result.data?.combined?.response` (legacy path)
- Natural Conversation mode returns `result.data.response` (different path)
- Response existed but wasn't found → `hasResponse: false`

**Solution:**
Updated `src/index.ts` to check both locations:
```typescript
// Before (legacy only)
const responseText = result.data?.combined?.response;

// After (supports both modes)
const responseText = result.data?.response || result.data?.combined?.response;
```

**Commits:**
- `39de607` - Fix: Natural Conversation mode response not sent to LINE
- `951026a` - Docs: Add fixed entry for Natural Conversation response bug

---
*Session: 2025-12-21 (Bugfix)*
*Issue: Response path mismatch - FIXED*

---

## Session: 2025-12-21 (Evening) - LIFF Health Logging Pages

### Goal
สร้าง LIFF Pages สำหรับ "บันทึกสุขภาพ" แทนการใช้ Chat-based flow ที่ UX ไม่ดี

### Problem Statement

**Before (Chat-based):**
```
User กด "💊 กินยา" → ส่ง "กินยาแล้ว"
Bot: "กินยาอะไรคะ?"  ← ต้องถามต่อ
User: "ยาความดัน"    ← ต้องพิมพ์เอง
```

**After (LIFF Pages):**
```
User กด "💊 กินยา" → เปิด LIFF Page
┌─────────────────────────────────────┐
│  ☑️ Metformin 500mg     (เช้า)      │
│  ☑️ Lisinopril 10mg     (เช้า)      │
│  ☐ Aspirin 81mg         (เช้า)      │
│         [ ✅ บันทึก ]                │
└─────────────────────────────────────┘
```

### Implementation Summary

#### 1. LIFF Pages Created

| Page | Purpose | Features |
|------|---------|----------|
| `health-log.html` | Main Dashboard | 4 categories, today's summary, quick navigation |
| `log-medication.html` | บันทึกยา | Checklist from DB, time period filter, already-taken disabled |
| `log-symptom.html` | บันทึกอาการ | 9 preset symptoms, severity slider, location picker |

#### 2. Flex Message Added (`src/index.ts`)
- `createHealthLogMenuFlexMessage()` - Interactive menu for "บันทึกสุขภาพ"
- Red header (#E74C3C), 4 colorful category buttons
- Each button sends message action (กินยาแล้ว, บันทึกความดัน, etc.)

#### 3. OrchestratorAgent Updates
- `isHealthLogMenuRequest()` - Detect "บันทึกสุขภาพ" request
- `handleHealthLogMenuRequest()` - Return health log menu
- Works alongside report menu handler

#### 4. AI NLU Enhancement (`unified-nlu.ts`)
Added Multi-Data Extraction:
```typescript
// Single message → Multiple health data
"วันนี้กินยาแล้ว ความดัน 130/85 รู้สึกเหนื่อย"
→ healthDataArray: [
    { type: "medication", ... },
    { type: "vitals", ... },
    { type: "symptom", ... }
  ]
```

Added CRUD Detection:
```
"เพิ่มยา paracetamol" → action.type = "save"
"เปลี่ยนยา paracetamol เป็น 2 เม็ด" → action.type = "update"
"ลบยา paracetamol" → action.type = "delete"
```

#### 5. Action Router Updates (`action-router.ts`)
- `saveMultipleHealthData()` - Handle healthDataArray
- Loops through each health data and saves individually
- Aggregates results and alerts

#### 6. Rich Menu Update (`OONJAI_RichMenu_Implementation.md`)
Changed action type:
```json
// Before (message)
{ "type": "message", "text": "บันทึกสุขภาพ" }

// After (uri)
{ "type": "uri", "uri": "https://liff.line.me/{LIFF_ID}/health-log.html" }
```

### Files Created
| File | Description |
|------|-------------|
| `public/liff/health-log.html` | Main health logging dashboard |
| `public/liff/log-medication.html` | Medication logging with checklist |
| `public/liff/log-symptom.html` | Symptom logging with presets |

### Files Modified
| File | Changes |
|------|---------|
| `src/index.ts` | Added health log Flex Message |
| `src/agents/core/OrchestratorAgent.ts` | Added health log menu handler |
| `src/lib/ai/prompts/unified-nlu.ts` | Multi-data extraction, CRUD detection |
| `src/lib/actions/action-router.ts` | Handle healthDataArray |
| `docs/OONJAI_RichMenu_Implementation.md` | Updated action type to URI |

### LIFF URLs
| Page | URL |
|------|-----|
| Dashboard | `https://liff.line.me/2008278683-5k69jxNq/health-log.html` |
| บันทึกยา | `https://liff.line.me/2008278683-5k69jxNq/log-medication.html` |
| ความดัน | `https://liff.line.me/2008278683-5k69jxNq/vitals-tracking.html` |
| น้ำ | `https://liff.line.me/2008278683-5k69jxNq/water-tracking.html` |
| อาการ | `https://liff.line.me/2008278683-5k69jxNq/log-symptom.html` |

### Build Status
```bash
$ npm run build
# ✅ Build succeeded
```

---
*Session: 2025-12-21 (Evening)*
*Feature: LIFF Health Logging Pages - COMPLETE*

---

## Session: 2025-12-25 - Critical Bug Fix: 1:1 Chat User Identification

### Problem Statement

**Issue:** Bot ตอบว่า "บันทึกแล้วค่ะ" แต่ข้อมูลไม่ถูกบันทึกจริง และเมื่อถามว่ารู้อะไรเกี่ยวกับตัวเอง Bot ตอบว่า "ไม่มีข้อมูลของคุณ"

**Symptoms (จากภาพ chat):**
1. User ส่งข้อมูลโปรไฟล์ครบ (ชื่อ วันเกิด สูง หนัก)
2. Bot ตอบ "บันทึกข้อมูลให้คุณศิวัจน์แล้วค่ะ" ✅
3. User ถาม "รู้อะไรเกี่ยวกับผมบ้าง"
4. Bot ตอบ "ตอนนี้ยังไม่มีข้อมูลของคุณ" ❌

### Root Cause Analysis

```
Database Investigation:
├── users table: User "Popp" exists ✅
├── caregiver_profiles: Profile exists ✅
├── patient_caregivers: Link to ศิวัจน์ exists ✅
├── patient_profiles: ศิวัจน์ exists ✅
└── caregivers table: ❌ TABLE DOESN'T EXIST (backed up)
```

**The Bug:**
```javascript
// Line 1533-1537 in src/index.ts (OLD CODE)
const { data: caregiver } = await supabase
  .from('caregivers')           // ❌ This table was deleted/backed up!
  .select('linked_patient_id')
  .eq('line_user_id', userId)
  .single();
```

**Impact:** Query failed silently → `context.patientId = null` → NLU has no patient context → Data not saved

### Solution

Changed to query correct tables following current schema:
```
users → caregiver_profiles → patient_caregivers → patient_id
```

**New Code:**
```javascript
// Step 1: Get user by LINE user ID
const { data: user } = await supabase
  .from('users')
  .select('id, role')
  .eq('line_user_id', userId)
  .single();

if (user) {
  if (user.role === 'caregiver') {
    // Step 2: Get caregiver profile
    const { data: caregiverProfile } = await supabase
      .from('caregiver_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (caregiverProfile) {
      // Step 3: Get linked patient
      const { data: patientLink } = await supabase
        .from('patient_caregivers')
        .select('patient_id')
        .eq('caregiver_id', caregiverProfile.id)
        .eq('status', 'active')
        .single();

      if (patientLink?.patient_id) {
        context.patientId = patientLink.patient_id;
      }
    }
  } else if (user.role === 'patient') {
    // Direct patient - get their profile
    const { data: patientProfile } = await supabase
      .from('patient_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (patientProfile) {
      context.patientId = patientProfile.id;
    }
  }
}
```

### Verification

```
Test Result:
Step 1 - users table: Found → id: e86a30d7-... | role: caregiver
Step 2 - caregiver_profiles: Found → caregiver_id: 5273ee3e-...
Step 3 - patient_caregivers: Found → patient_id: 4ccbe823-...

✅ RESULT: context.patientId = 4ccbe823-b649-4cdf-8ae6-5503c9fc88db
Patient: ศิวัจน์ (ป๊อป)
```

### Other Fixes in This Session

1. **UI: Summary cards differentiation** (`health-log.html`)
   - Added left border accent colors (red, blue, green, amber)
   - Gray gradient background for summary section
   - Visual distinction between stats (read-only) and action buttons

2. **Database column fixes** (from earlier today)
   - `vitals_logs`: Changed `created_at` → `measured_at`
   - `medications`: Changed `.eq('is_active', true)` → `.eq('active', true)`
   - Added patientId fallback from server when localStorage is empty

3. **BP Status UI improvement** (`vitals-tracking.html`)
   - 6 distinct CSS classes for BP status levels
   - Gradient backgrounds, icons, animations for critical status

### Files Modified

| File | Changes |
|------|---------|
| `src/index.ts` | Fixed 1:1 chat user identification flow |
| `public/liff/health-log.html` | UI: Summary cards styling, DB query fixes |
| `public/liff/vitals-tracking.html` | DB query fixes, BP status UI |
| `public/liff/log-medication.html` | Fixed medications query column name |

### Database Schema Note

Current schema uses:
- `users` (line_user_id, role)
- `caregiver_profiles` (user_id → users.id)
- `patient_profiles` (user_id → users.id)
- `patient_caregivers` (caregiver_id, patient_id, status)

Old `caregivers` table was backed up to `_backup_caregivers` and is **no longer used**.

### Commit
```
4548f71 - Fix: 1:1 chat now correctly identifies user and linked patient
df98af0 - UI: Differentiate summary stats from action buttons in health-log
```

---
*Session: 2025-12-25*
*Bug Fix: 1:1 Chat User Identification - CRITICAL FIX*

---

## Session: 2025-12-26 - Unified AI Flow (Sonnet 4.5 Only)

### Goal
ปรับ flow AI จาก 2 pipelines (Haiku + Sonnet) เป็น 1 pipeline เดียว (Sonnet 4.5 เท่านั้น)
เพื่อความเรียบง่ายและคุณภาพ response ที่ดีขึ้น

### Problem: Dual Pipeline Complexity

**Before (2 Pipelines):**
```
Message → runHealthExtractionPipeline (Haiku)
              ↓
        Has health data?
        ├─ Yes → ตอบด้วย Haiku response (คุณภาพต่ำ)
        └─ No  → OrchestratorAgent → UnifiedNLUAgent (Sonnet 4.5)
```

**Problems:**
1. 2 API calls ต่อบางข้อความ (เสียเงิน เสียเวลา)
2. Response จาก Haiku คุณภาพต่ำกว่า Sonnet
3. Logic ซับซ้อน ดูแลยาก

### Solution: Single Unified Pipeline

**After (1 Pipeline):**
```
Message → OrchestratorAgent → UnifiedNLUAgent (Sonnet 4.5)
                                    │
                                    ├─ Intent Classification
                                    ├─ Health Data Extraction
                                    ├─ Natural Response Generation
                                    └─ Action Execution → DB
```

**Benefits:**
- 1 API call ต่อข้อความ
- Response คุณภาพสูง + เป็นธรรมชาติ
- Code เรียบง่าย ดูแลง่าย

### Implementation

#### 1. Remove Health Extraction Pipeline (`src/index.ts`)
```javascript
// REMOVED (60+ lines)
if (context.patientId && !isMenuRequest) {
  const extractionResult = await runHealthExtractionPipeline(...);
  if (extractionResult.hasHealthData) {
    // ... respond with Haiku extraction
  }
}

// NOW: All messages go directly to orchestrator
const result = await orchestrator.process({ ... });
```

#### 2. Add Conversation Logging (`src/agents/core/OrchestratorAgent.ts`)
```typescript
// Save conversation log (user message)
let conversationLogId: string | undefined;
if (message.context.patientId) {
  conversationLogId = await this.supabase.saveConversationLog({
    patientId: message.context.patientId,
    role: 'user',
    text: message.content,
    source: isGroupChat ? 'group' : '1:1'
  });
}

// After NLU processing, update with extracted data
if (conversationLogId) {
  await this.supabase.updateConversationLog(conversationLogId, {
    intent: nluResult.intent,
    aiExtractedData: nluResult.healthData,
    aiConfidence: nluResult.confidence,
    aiModel: 'claude-sonnet-4.5'
  });
}
```

#### 3. Enhance NLU Prompt (`src/lib/ai/prompts/unified-nlu.ts`)
```markdown
## บุคลิกของคุณ
- เป็นกันเอง อบอุ่น ใส่ใจ เหมือนหลานสาวที่ดูแลผู้ใหญ่
- ฉลาด เข้าใจบริบท ไม่ต้องถามซ้ำเมื่อข้อมูลครบแล้ว
- ตอบสั้น กระชับ ไม่เยิ่นเย้อ แต่อบอุ่น
- ไม่พูดเหมือนหุ่นยนต์ ไม่พูดแบบราชการ

## น้ำเสียงและภาษา
- พูดสั้นๆ เช่น "โอเคค่ะ บันทึกแล้ว 💊"
- ห้าม "พิมพ์...", "กรุณาระบุ...", "คำสั่งไม่ถูกต้อง"
```

#### 4. LIFF Page Optimization
- `public/liff/index.html` - เพิ่ม IIFE + Critical CSS
- `public/liff/success.html` - เพิ่ม IIFE + missing functions

### Response Style Examples

| User พูด | Bot ตอบ (แบบใหม่) |
|----------|-------------------|
| "ยายกินยาแล้วค่ะ" | "โอเคค่ะ บันทึกให้ยายแล้ว 💊" |
| "ความดัน 140/90 สูงไปไหม" | "รับทราบค่ะ สูงนิดนึง ดื่มน้ำเยอะๆ นะคะ 💧" |
| "วันนี้ปวดหัวมาก" | "อุ๊ย ปวดหัวเหรอคะ บันทึกไว้แล้ว พักผ่อนเยอะๆ นะคะ" |
| "ลืมกินยาเช้า" | "ไม่เป็นไรค่ะ ถ้ายังไม่เกินเที่ยงก็กินได้นะคะ" |
| "เปลี่ยนเบอร์ 0891234567" | "เปลี่ยนให้แล้วค่ะ 📱" |

### Files Changed

| File | Changes |
|------|---------|
| `src/index.ts` | ลบ Health Extraction Pipeline (-168 lines) |
| `src/agents/core/OrchestratorAgent.ts` | เพิ่ม conversation log saving |
| `src/lib/ai/prompts/unified-nlu.ts` | ปรับ prompt ให้ตอบธรรมชาติ |
| `public/liff/index.html` | IIFE optimization |
| `public/liff/success.html` | IIFE optimization + missing functions |

### AI Model Configuration

```typescript
// UnifiedNLUAgent uses Sonnet 4.5 only
model: OPENROUTER_MODELS.CLAUDE_SONNET_4_5  // 'anthropic/claude-sonnet-4.5'
temperature: 0.3  // Low for consistent structured output
maxTokens: 1500
```

### Current AI Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Message (LINE)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    src/index.ts                                  │
│              handleTextMessage() / handleAudioMessage()          │
│                                                                  │
│  - Get userId, groupId, patientId                                │
│  - Check for commands (/help, etc.)                              │
│  - Check for menu requests (บันทึกสุขภาพ, รายงาน)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OrchestratorAgent                             │
│              processWithNaturalConversation()                    │
│                                                                  │
│  1. Fetch patientData (profile, medications, reminders)          │
│  2. Save conversation log (user message)                         │
│  3. Build NLUContext                                             │
│  4. Call UnifiedNLUAgent                                         │
│  5. Execute action if needed                                     │
│  6. Update conversation log with NLU result                      │
│  7. Return natural response                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   UnifiedNLUAgent                                │
│              (Claude Sonnet 4.5 - Single Call)                   │
│                                                                  │
│  Input: message + patientContext + conversationHistory           │
│                                                                  │
│  Output: {                                                       │
│    intent, subIntent, confidence,                                │
│    entities, healthData, action,                                 │
│    response: "โอเคค่ะ บันทึกแล้ว 💊"                              │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              ActionRouter (executeAction)                        │
│                                                                  │
│  - save → บันทึก health data ลง DB                               │
│  - update → อัพเดต profile/medication/reminder                   │
│  - delete → ลบข้อมูล (with confirmation)                         │
│  - query → ดึงข้อมูลมาแสดง                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LINE Reply                                     │
│              Natural, friendly response                          │
└─────────────────────────────────────────────────────────────────┘
```

---
*Session: 2025-12-26*
*Feature: Unified AI Flow (Sonnet 4.5 Only) - COMPLETE*