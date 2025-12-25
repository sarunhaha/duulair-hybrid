# OONJ.AI - Task List

> Last Updated: 2025-12-25

---

## Current Focus: Bug Fixes & Stability

---

## 1:1 Chat User Identification Bug ✅ FIXED

> Fixed: 2025-12-25

### Problem
- Bot ตอบ "บันทึกแล้ว" แต่ข้อมูลไม่ถูกบันทึกจริง
- Bot ตอบ "ไม่มีข้อมูลของคุณ" ทั้งที่ user ลงทะเบียนแล้ว

### Root Cause
Code ใน `src/index.ts` query จาก `caregivers` table ที่ไม่มีแล้ว (ถูก backup)

### Solution
เปลี่ยนเป็น query ตาม schema ปัจจุบัน:
```
users → caregiver_profiles → patient_caregivers → patient_id
```

### Files Changed
- [x] `src/index.ts` - Fixed 1:1 chat user identification flow

---

## LIFF Page Database Query Fixes ✅ FIXED

> Fixed: 2025-12-25

### Problems Fixed
1. `vitals_logs` query ใช้ `created_at` แต่ column จริงคือ `measured_at`
2. `medications` query ใช้ `is_active` แต่ column จริงคือ `active`
3. `patientId` ไม่อยู่ใน localStorage → query ไม่ได้

### Files Changed
- [x] `public/liff/health-log.html` - Fixed queries + UI
- [x] `public/liff/vitals-tracking.html` - Fixed queries + BP status UI
- [x] `public/liff/log-medication.html` - Fixed medications column name

---

---

## LIFF Page Loading Optimization ✅ COMPLETE

> Added: 2025-12-22

### Overview
ปรับปรุง UX ของ LIFF Pages ให้โหลดเร็วขึ้น ไม่ต้องรอ LIFF SDK initialize

### Problem
- LIFF pages took 2-5 seconds to show UI
- Users saw loading spinner for too long
- Bad UX especially on slow connections

### Solution: IIFE Pattern (Immediately Invoked Function Expression)
```javascript
// Phase 2.1: Show UI immediately
(function showUIImmediately() {
  // Show cached name if available
  const cached = sessionStorage.getItem('liff_profile');
  if (cached) {
    const profile = JSON.parse(cached);
    document.getElementById('welcomeName').textContent = `สวัสดี ${profile.displayName}`;
  }
  // Show UI immediately!
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
})();
```

### Implementation Status

| Page | Status | Notes |
|------|--------|-------|
| health-log.html | ✅ Done | Reference implementation |
| dashboard.html | ✅ Done | Already had IIFE |
| medications.html | ✅ Done | Already had IIFE |
| reminders.html | ✅ Done | Already had IIFE |
| settings.html | ✅ Done | Already had IIFE |
| vitals-tracking.html | ✅ Done | Already had IIFE |
| water-tracking.html | ✅ Done | Already had IIFE |
| log-medication.html | ✅ Done | Already had IIFE |
| log-symptom.html | ✅ Done | Already had IIFE |
| patient-profile.html | ✅ Done | Already had IIFE |
| reports.html | ✅ Done | Added IIFE (2025-12-22) |
| my-profile.html | ✅ Done | Added IIFE (2025-12-22) |

### Optimization Phases Applied
1. **Phase 1.1**: Cache LIFF Profile in sessionStorage (1 hour)
2. **Phase 1.2**: Skip Registration Check if Cached
3. **Phase 1.3**: Parallel Loading (data fetched in background)
4. **Phase 2.1-2.2**: Show UI First with IIFE (THE KEY!)
5. **Phase 3.1**: Preconnect/Preload external resources

---

## Natural Conversation Architecture (Claude-First NLU) ✅ COMPLETE

---

## Natural Conversation Architecture ✅ COMPLETE

> Added: 2025-12-21

### Overview
เปลี่ยนระบบจาก **Command-Based** (Pattern Matching) → **Natural Conversation** (Claude-First NLU)
ให้ AI เข้าใจการสนทนาแบบธรรมชาติ ไม่ต้องสอน user พิมพ์ command

### Before (Command-Based)
```
User: "ยายกินยาเสร็จแล้วค่ะหลังอาหารเช้า"
Bot:  "ได้รับข้อความแล้วค่ะ"  ← ไม่เข้าใจ (ไม่ตรง pattern)
```

### After (Natural Conversation)
```
User: "ยายกินยาเสร็จแล้วค่ะหลังอาหารเช้า"
Bot:  "บันทึกให้ยายเรียบร้อยแล้วค่ะ กินยาหลังอาหารเช้า 🌅"
```

### Implementation

- [x] Phase 1: Create unified-nlu.ts prompt
  - `src/lib/ai/prompts/unified-nlu.ts`
  - UNIFIED_NLU_SYSTEM_PROMPT with intent categories
  - buildUnifiedNLUPrompt(), buildPatientContextString()
  - buildRecentActivitiesString(), buildConversationHistoryString()

- [x] Phase 2: Create nlu.types.ts
  - `src/types/nlu.types.ts`
  - MainIntent, SubIntent types
  - NLUResult, NLUContext, NLUInput interfaces
  - NLUHealthData with sub-types (MedicationHealthData, VitalsHealthData, etc.)
  - ActionType, ActionTarget, ActionResult

- [x] Phase 3: Create UnifiedNLUAgent.ts
  - `src/agents/core/UnifiedNLUAgent.ts`
  - Single Claude call for intent + extraction + response
  - processNLU() - main processing method
  - parseNLUResponse() - JSON parsing with fallback
  - normalizeIntent(), normalizeHealthData()
  - Static helpers: requiresAction(), hasHealthData(), getExtractionSummary()

- [x] Phase 4: Create action-router.ts
  - `src/lib/actions/action-router.ts`
  - executeAction() - routes NLU results to database actions
  - handleSaveAction(), handleUpdateAction(), handleDeleteAction()
  - saveHealthData() - converts NLU data to AIExtractedData
  - checkForAbnormalVitals() - vital value alerts
  - Profile, Medication, Reminder CRUD operations

- [x] Phase 5: Update OrchestratorAgent.ts
  - `src/agents/core/OrchestratorAgent.ts`
  - Added USE_NATURAL_CONVERSATION_MODE flag
  - processWithNaturalConversation() - new Claude-first flow
  - handleReportQuery() - report delegation
  - processWithIntentRouting() - legacy fallback

- [x] Phase 6: Update DialogAgent.ts
  - `src/agents/specialized/DialogAgent.ts`
  - Disabled command suggestions in natural mode
  - Updated system prompt to not teach commands
  - Natural conversation guidelines

- [x] Phase 7: Test build
  - Build successful with no TypeScript errors

### Architecture

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

### Response Style

**DO (Natural):**
- "บันทึกให้แล้วค่ะ" ✅
- "ได้เลยค่ะ อัพเดตให้แล้ว" ✅
- ใช้ emoji พอประมาณ 💊💧🌅
- ถามกลับถ้าไม่ชัดเจน

**DON'T (Command-like):**
- "พิมพ์ 'กินยาแล้ว'" ❌
- "กรุณาระบุ..." ❌
- "คำสั่งไม่ถูกต้อง" ❌

### Configuration

To switch between modes, edit the flag in `OrchestratorAgent.ts` and `DialogAgent.ts`:
```typescript
const USE_NATURAL_CONVERSATION_MODE = true;  // Claude-first NLU
const USE_NATURAL_CONVERSATION_MODE = false; // Legacy IntentAgent + Routing
```

---

## Voice Confirmation & Conversation Flow ✅ COMPLETE

> Added: 2025-12-21

### Overview
ปรับปรุง Voice Command Flow และ Conversation Flow ให้ไหลลื่นเหมือนคุยกับคน

### Voice Confirmation Flow
```
User: 🎤 (ส่งเสียง "เปลี่ยนชื่อเป็น ศรัณย์ แสงสม")
          ↓
Bot:  🎤 ได้ยินว่า: "เปลี่ยนชื่อเป็น สรัน แสงสม"
      ถูกต้องไหมคะ?
      [✅ ถูกต้อง] [❌ ไม่ถูก]  ← ถามยืนยัน 1 ครั้ง
          ↓
User: กด "ถูกต้อง"
          ↓
Bot:  เปลี่ยนชื่อเป็น สรัน แสงสม แล้วค่ะ ✏️  ← ทำเลย! ไม่ถามอีก
```

### Implementation

- [x] Voice Confirmation Service
  - `src/services/voice-confirmation.service.ts` - State management
  - `docs/migrations/012_voice_confirmation.sql` - Pending confirmations table
  - savePending(), getPending(), confirm(), reject()

- [x] Voice Postback Handler
  - `handlePostback()` - Handle voice confirmation Quick Reply
  - `voiceConfirmed` flag ส่งไป NLU ให้ทำเลยไม่ต้องถาม

- [x] NLU Prompt Improvements
  - เพิ่มตัวอย่าง JSON ครบทุก feature:
    - health_log (medication, vitals, water, exercise, sleep, symptom)
    - profile_update (name, weight, height, phone, etc.)
    - medication_manage (add, edit, delete)
    - reminder_manage (add, edit, delete)
  - เพิ่ม instruction: ถ้าข้อมูลครบ ทำเลย ไม่ต้องถาม "ใช่ไหมคะ?"

- [x] Action Router Improvements
  - Profile: เพิ่ม firstName, lastName, nickname, dateOfBirth, gender
  - Medication: รองรับ update/delete by name (ไม่ต้องมี ID)
  - Reminder: รองรับ update/delete by type/time

- [x] Type Updates
  - `NLUContext.voiceConfirmed` - Flag ว่า voice ยืนยันแล้ว
  - `MessageSchema.confirmedVoice` - Pass flag ผ่าน Message context
  - `MessageSchema.source` - เพิ่ม 'voice' enum

### Files Modified
- `src/services/voice-confirmation.service.ts` (NEW)
- `docs/migrations/012_voice_confirmation.sql` (NEW)
- `src/index.ts` - handleAudioMessage, handlePostback
- `src/lib/ai/prompts/unified-nlu.ts` - เพิ่ม examples
- `src/lib/actions/action-router.ts` - Profile/Medication/Reminder fixes
- `src/agents/core/UnifiedNLUAgent.ts` - voiceConfirmed handling
- `src/agents/core/BaseAgent.ts` - MessageSchema updates
- `src/types/nlu.types.ts` - NLUContext.voiceConfirmed

---

## OpenRouter Migration ✅ COMPLETE

- [x] สร้าง OpenRouter Service (`src/services/openrouter.service.ts`)
  - [x] ChatMessage, ChatCompletionOptions types
  - [x] OPENROUTER_MODELS constants (Claude Sonnet 4.5, etc.)
  - [x] createChatCompletion() method
  - [x] complete() convenience method
  - [x] analyzeImage() / analyzeBase64Image() for Vision

- [x] Update Environment Variables
  - [x] Add OPENROUTER_API_KEY to `.env`
  - [x] Add OPENROUTER_API_KEY to `.env.example`

- [x] Update AI Extraction (`src/lib/ai/extraction.ts`)
  - [x] Import OpenRouter service
  - [x] Use Claude Sonnet 4.5 as default model
  - [x] Update extractHealthData() to use OpenRouter

- [x] Update Base Agent (`src/agents/core/BaseAgent.ts`)
  - [x] Replace Anthropic SDK with OpenRouter
  - [x] Update askClaude() method
  - [x] Update default model config

- [x] Update Webhook OCR (`src/index.ts`)
  - [x] Remove Anthropic SDK import
  - [x] Update BP image OCR (upload endpoint)
  - [x] Update BP image OCR (LINE message handler)

---

## Phase 1: Database Restructure ✅ COMPLETE

- [x] สร้าง migration `001_restructure_phase1_new_tables.sql`
  - [x] สร้าง `symptoms` table
  - [x] สร้าง `sleep_logs` table
  - [x] สร้าง `exercise_logs` table
  - [x] สร้าง `health_events` table (linking table)

- [x] สร้าง migration `002_restructure_phase2_alter_tables.sql`
  - [x] Alter `conversation_logs` (+patient_id, +group_id, +ai_extracted_data, +ai_confidence)
  - [x] Alter `vitals_logs` (+patient_id, +conversation_log_id, +source, +ai_confidence)
  - [x] Alter `mood_logs` (+patient_id, +stress_level, +energy_level, +ai_confidence)
  - [x] Alter `activity_logs` (+conversation_log_id, +ai_confidence, +raw_text, +health_event_id)
  - [x] Alter `health_goals` (+target_sleep_hours, +target_water_glasses, +target_steps)

- [x] สร้าง migration `003_restructure_phase3_migrate_data.sql`
  - [x] Migrate patient_medications → medications
  - [x] Migrate water_intake_logs → activity_logs
  - [x] Migrate water_intake_goals → health_goals
  - [x] Migrate missed_activity_alerts → alert_logs
  - [x] Update vitals_logs with patient_id
  - [x] Update mood_logs with patient_id

- [x] สร้าง migration `004_restructure_phase4_cleanup.sql`
  - [x] Backup old tables with `_backup_` prefix (11 tables)
  - [x] Remove deprecated tables

---

## Phase 2: AI Extraction Pipeline ✅ COMPLETE

- [x] สร้าง Types (`src/types/health.types.ts`)
  - [x] Symptom, SleepLog, ExerciseLog, HealthEvent types
  - [x] VitalsLog, MoodLog, ConversationLog types
  - [x] AIExtractedData และ sub-types
  - [x] Insert types (SymptomInsert, SleepLogInsert, etc.)

- [x] สร้าง Extraction Prompt (`src/lib/ai/prompts/extraction.ts`)
  - [x] EXTRACTION_SYSTEM_PROMPT (Thai health extraction)
  - [x] RESPONSE_GENERATION_PROMPT
  - [x] buildPatientContext()
  - [x] buildExtractionPrompt()

- [x] สร้าง Core Extraction (`src/lib/ai/extraction.ts`)
  - [x] extractHealthData() - Claude API call
  - [x] parseExtractionResponse() - Parse JSON
  - [x] normalizeExtractedData() - snake_case/camelCase
  - [x] hasHealthData() - Check if has health info
  - [x] getExtractionSummary() - Summary for logging

- [x] สร้าง Processors (`src/lib/ai/processors/index.ts`)
  - [x] processExtractedData() - Main processor
  - [x] processSymptom() → symptoms table
  - [x] processVitals() → vitals_logs table
  - [x] processMood() → mood_logs table
  - [x] processSleep() → sleep_logs table
  - [x] processExercise() → exercise_logs table
  - [x] processMedication() → activity_logs table
  - [x] processWater() → activity_logs table

- [x] สร้าง Health Event Creator (`src/lib/health/event-creator.ts`)
  - [x] createHealthEvent()
  - [x] createHealthEventsBatch()
  - [x] getHealthEventsSummary()
  - [x] checkForAbnormalValues()

- [x] สร้าง Pipeline Entry (`src/lib/ai/index.ts`)
  - [x] runHealthExtractionPipeline() - Main pipeline
  - [x] generateResponseMessage()
  - [x] Re-export utilities

- [x] Update Supabase Service (`src/services/supabase.service.ts`)
  - [x] saveSymptom(), getSymptoms(), getRecentSymptoms()
  - [x] saveSleepLog(), getSleepLogs(), getRecentSleepLogs()
  - [x] saveExerciseLog(), getExerciseLogs(), getRecentExerciseLogs()
  - [x] saveHealthEvent(), getHealthEvents(), getHealthEventsByType()
  - [x] saveVitalsLog(), getVitalsLogs(), getRecentVitalsLogs()
  - [x] saveMoodLog(), getMoodLogs(), getRecentMoodLogs()
  - [x] saveConversationLog(), updateConversationLog(), getConversationLogs()
  - [x] getHealthGoals(), updateHealthGoals()

---

## Phase 3: Webhook Integration ✅ COMPLETE

- [x] Integrate extraction pipeline into webhook
  - [x] Import `runHealthExtractionPipeline` in `src/index.ts`
  - [x] Add extraction call in `handleTextMessage()`
  - [x] Decide integration strategy:
    - [x] Option A: Hybrid (extraction first, fallback to orchestrator) ✅ IMPLEMENTED
    - [ ] ~~Option B: Replace orchestrator for health messages~~
    - [ ] ~~Option C: Parallel (run both, merge results)~~

- [x] Error Handling
  - [x] Add try/catch around extraction
  - [x] Fallback to orchestrator if extraction fails
  - [x] Log extraction errors

- [x] Response Handling
  - [x] Use extraction response if hasHealthData
  - [x] Fallback to orchestrator for dialog when no health data
  - [x] Handle followup questions
  - [x] Handle alerts for abnormal values

- [x] Logging & Monitoring
  - [x] Log extraction results
  - [x] Log hasHealthData status
  - [x] Log saved records count
  - [x] Log alerts

- [ ] Test Integration (Pending Production Testing)
  - [ ] Test with simple health message ("ความดัน 120/80")
  - [ ] Test with complex message ("ปวดหัว นอน 5 ชม. ความดัน 130/85")
  - [ ] Test with non-health message
  - [ ] Test error scenarios

---

## Voice Command Support (Groq Whisper) ✅ COMPLETE

> Added: 2025-12-20

- [x] Add GROQ_API_KEY to .env
- [x] Install groq-sdk package
- [x] Create Groq Whisper service (`src/services/groq.service.ts`)
  - [x] `transcribeAudio()` - Buffer to text
  - [x] `transcribeStream()` - Stream to text
  - [x] Thai language support with health prompt
- [x] Add `handleAudioMessage()` to webhook
  - [x] Download audio from LINE
  - [x] Transcribe with Groq Whisper
  - [x] Process transcribed text (extraction or orchestrator)
  - [x] Show "🎤 ได้ยินว่า: ..." feedback
- [x] Build successfully

**Usage:**
- User sends voice message in LINE
- Bot transcribes → processes → responds
- Example: 🎤 "กินยาแล้ว" → ✅ บันทึกการกินยาเรียบร้อยแล้ว

**Rate Limits (Free):** 20 req/min, 2000 req/day, 8 hrs audio/day

---

## Chat-based Profile Editing System ✅ COMPLETE

> Added: 2025-12-20

- [x] สร้าง ProfileEditAgent (`src/agents/specialized/ProfileEditAgent.ts`)
  - [x] Handle profile edits via LINE Chat (no LIFF required)
  - [x] Claude-based entity extraction for Thai natural language
  - [x] Validation rules (weight 20-200kg, height 50-250cm, phone format, blood type)

- [x] Profile Edit Features
  - [x] Edit weight - `น้ำหนัก 65 กิโล`
  - [x] Edit height - `ส่วนสูง 170 ซม.`
  - [x] Edit phone - `เปลี่ยนเบอร์ 0891234567`
  - [x] Edit name - `ชื่อใหม่คือ สมศรี มงคล`
  - [x] Edit address - `ที่อยู่ใหม่คือ 123 ถ.สุขุมวิท`
  - [x] Edit blood type - `กรุ๊ปเลือด O+`
  - [x] Edit medical conditions - `เพิ่มโรคเบาหวาน`
  - [x] Edit allergies - `แพ้ยาเพนนิซิลิน`
  - [x] Edit emergency contact - `ผู้ติดต่อฉุกเฉิน 0812345678`

- [x] Medication CRUD
  - [x] Add medication - `เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น`
  - [x] Edit medication - `แก้ยาเมทฟอร์มินเป็น 1000mg`
  - [x] Delete medication - `ลบยาพาราเซตามอล`

- [x] Reminder CRUD
  - [x] Add reminder - `ตั้งเตือนกินยา 8 โมง`
  - [x] Edit reminder - `เปลี่ยนเวลาเตือนกินยาเป็น 9 โมง`
  - [x] Delete reminder - `ลบเตือนกินยาเช้า`

- [x] Intent Patterns (`src/agents/specialized/IntentAgent.ts`)
  - [x] 10 profile edit intents (edit_profile, edit_name, edit_weight, etc.)
  - [x] 3 medication intents (add/edit/delete_medication)
  - [x] 3 reminder intents (add/edit/delete_reminder)
  - [x] Added to highConfidenceIntents for reliable detection
  - [x] Updated Claude classifier prompt

- [x] OrchestratorAgent Routing (`src/agents/core/OrchestratorAgent.ts`)
  - [x] Import and initialize ProfileEditAgent
  - [x] Route edit intents before confidence check
  - [x] Pass patientData to ProfileEditAgent

- [x] DialogAgent Suggestions (`src/agents/specialized/DialogAgent.ts`)
  - [x] Smart suggestions for edit commands
  - [x] Guide users on chat-based editing

---

## Phase 4: Testing & Polish ⏳ PENDING

- [ ] End-to-End Testing
  - [ ] Test ข้อความภาษาไทยหลายแบบ
  - [ ] Test edge cases (ค่าผิดปกติ, ข้อมูลไม่ครบ)
  - [ ] Test group chat vs 1:1
  - [ ] Verify data saved correctly to all tables

- [ ] Prompt Tuning
  - [ ] Review extraction accuracy
  - [ ] Adjust prompt based on real usage
  - [ ] Add more Thai language patterns

- [ ] Abnormal Value Alerts
  - [ ] Test BP alerts (high/low)
  - [ ] Test HR alerts
  - [ ] Test SpO2 alerts
  - [ ] Test glucose alerts
  - [ ] Verify alert messages

- [ ] Performance
  - [ ] Monitor extraction latency
  - [ ] Optimize if needed
  - [ ] Consider caching

- [ ] Documentation
  - [ ] Update API documentation
  - [ ] Document extraction flow
  - [ ] Update CLAUDE.md

---

## Future Enhancements (Backlog)

### AI Improvements
- [ ] Multi-turn conversation context
- [ ] Better Thai NLP for symptoms
- [ ] Image OCR for BP meters (enhance existing)
- [ ] Voice message transcription

### Data & Reports
- [ ] Enhanced daily summaries with AI insights
- [ ] Weekly/Monthly trend analysis
- [ ] Export to PDF with charts
- [ ] Health score calculation

### User Experience
- [ ] Smarter follow-up questions
- [ ] Personalized health tips
- [ ] Medication interaction warnings
- [ ] Appointment reminders

### Integration
- [ ] Wearable device sync
- [ ] Hospital system integration
- [ ] Family dashboard
- [ ] Doctor portal

---

## Files Reference

### Natural Conversation (Claude-First NLU)
```
src/lib/ai/prompts/
└── unified-nlu.ts        # UNIFIED_NLU_SYSTEM_PROMPT + helpers

src/lib/actions/
└── action-router.ts      # executeAction() - NLU to database

src/types/
└── nlu.types.ts          # NLUResult, NLUContext, etc.

src/agents/core/
├── UnifiedNLUAgent.ts    # Claude-first NLU processing
└── OrchestratorAgent.ts  # USE_NATURAL_CONVERSATION_MODE
```

### AI Extraction Pipeline (Legacy)
```
src/lib/ai/
├── index.ts              # runHealthExtractionPipeline()
├── extraction.ts         # extractHealthData()
├── processors/index.ts   # processExtractedData()
└── prompts/extraction.ts # EXTRACTION_SYSTEM_PROMPT

src/lib/health/
└── event-creator.ts      # createHealthEvent()
```

### Agents
```
src/agents/
├── core/
│   ├── BaseAgent.ts          # Base agent class
│   └── OrchestratorAgent.ts  # Routes to specialized agents
├── specialized/
│   ├── IntentAgent.ts        # Intent classification + patterns
│   ├── DialogAgent.ts        # Conversational responses
│   ├── HealthAgent.ts        # Health data processing
│   ├── ReportAgent.ts        # Report generation
│   ├── AlertAgent.ts         # Emergency alerts
│   └── ProfileEditAgent.ts   # Chat-based profile editing (NEW)
```

### Types & Services
```
src/types/health.types.ts         # All health types
src/services/supabase.service.ts  # All CRUD methods
src/services/groq.service.ts      # Groq Whisper transcription (NEW)
src/services/openrouter.service.ts # OpenRouter LLM API
```

### Webhook
```
src/index.ts              # handleTextMessage()
```

### Documentation
```
CLAUDE.md                 # Session logs
OONJAI_Restructure_Prompt_v2.md  # Architecture doc
TODO.md                   # This file
```

---

## Quick Commands

```bash
# Build
npm run build

# Run locally
npm run dev

# Check TypeScript errors
npx tsc --noEmit

# Deploy (auto via Vercel)
git push origin master
```

---

## Notes

- Database backups exist as `_backup_*` tables
- AI Extraction uses Claude Haiku for speed
- All processors create health_events for linking
- Webhook integration should be non-breaking (fallback to orchestrator)
