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
*Session: 2025-12-20*
*Status: AI Extraction Pipeline code complete, pending webhook integration*