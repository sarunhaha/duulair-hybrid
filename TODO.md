# OONJ.AI - Task List

> Last Updated: 2025-12-20

---

## Current Focus: OpenRouter Migration + Phase 3 Webhook Integration

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

### AI Extraction Pipeline
```
src/lib/ai/
├── index.ts              # runHealthExtractionPipeline()
├── extraction.ts         # extractHealthData()
├── processors/index.ts   # processExtractedData()
└── prompts/extraction.ts # EXTRACTION_SYSTEM_PROMPT

src/lib/health/
└── event-creator.ts      # createHealthEvent()
```

### Types & Services
```
src/types/health.types.ts    # All health types
src/services/supabase.service.ts  # All CRUD methods
```

### Webhook
```
src/index.ts              # handleTextMessage() - NEEDS INTEGRATION
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
