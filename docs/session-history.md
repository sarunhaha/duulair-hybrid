# Session History Archive

> **Note:** This file contains archived session logs moved from `CLAUDE.md` to reduce its size.
> For current project context, see `CLAUDE.md` in the root directory.

---

## Session: 2025-11-23

### Issue: Report Menu Not Displaying as Flex Message
**Problem:** When users typed "ดูรายงาน", the system returned plain text instead of the expected Flex Message menu.

**Root Cause:** Intent confidence = 0.5, but `report_menu` case was inside `if (confidence > 0.8)` block

**Solution:**
- Moved `report_menu` as special case BEFORE confidence check
- Added special handling for `report_menu` intent in ReportAgent that doesn't require `patientId`

**Files Modified:**
- `src/agents/specialized/ReportAgent.ts`
- `src/agents/core/OrchestratorAgent.ts`
- `src/index.ts`

---

## Session: 2025-11-29

### Issues Fixed (8 total)

1. **Remove @mention Requirement** - Bot now responds to ALL messages in group chat
2. **Smart Intent Suggestions** - DialogAgent suggests exact commands
3. **Group vs 1:1 Context** - Separate prompts for group chat (no Rich Menu mentions)
4. **"ข้อมูลผู้ป่วย" Bug** - Fixed pattern `ป่วย` matching "ผู้ป่วย"
5. **Registration Flex** - Check if user already registered
6. **Missing Patient Data** - Enhanced `fetchPatientDataForQuery()` to include reminders, activities
7. **Medications Display** - Fixed table name (`medications` not `patient_medications`)
8. **Report Intent** - Fixed confidence calculation, moved outside confidence check

---

## Session: 2025-12-20

### AI Extraction Pipeline (Schema Restructure)

**Database Migration:** All 4 phases complete
- Phase 1: New tables (`symptoms`, `sleep_logs`, `exercise_logs`, `health_events`)
- Phase 2: Alter tables (added AI columns)
- Phase 3: Data migration
- Phase 4: Cleanup

**Code Created:**
- `src/lib/ai/extraction.ts` - `extractHealthData()`
- `src/lib/ai/prompts/extraction.ts` - Prompts
- `src/lib/ai/processors/index.ts` - Data processors
- `src/lib/ai/index.ts` - `runHealthExtractionPipeline()`
- `src/lib/health/event-creator.ts` - Health events
- `src/types/health.types.ts` - Type definitions

### Chat-based Profile Editing System

**ProfileEditAgent** (`src/agents/specialized/ProfileEditAgent.ts`)
- 16 edit handlers (weight, height, phone, name, medications, reminders, etc.)
- Claude-based entity extraction for Thai
- Validation rules

**New Intent Patterns:** 17 edit intents added to IntentAgent

---

## Session: 2025-12-21

### Natural Conversation Architecture (Claude-First NLU)

**Goal:** Change from Command-Based (Pattern Matching) to Natural Conversation (Claude-First NLU)

**Files Created:**
- `src/lib/ai/prompts/unified-nlu.ts` - Unified NLU prompt
- `src/types/nlu.types.ts` - NLU types
- `src/agents/core/UnifiedNLUAgent.ts` - Claude-first NLU agent
- `src/lib/actions/action-router.ts` - Action router

**Configuration:**
```typescript
USE_NATURAL_CONVERSATION_MODE = true;  // In OrchestratorAgent & DialogAgent
```

### LIFF Health Logging Pages

**Pages Created:**
- `public/liff/health-log.html` - Main dashboard
- `public/liff/log-medication.html` - Medication logging
- `public/liff/log-symptom.html` - Symptom logging

---

## Session: 2025-12-25

### Critical Bug Fix: 1:1 Chat User Identification

**Problem:** Bot said "บันทึกแล้ว" but data wasn't saved. Query failed because `caregivers` table was backed up.

**Solution:** Changed query to use correct tables:
```
users → caregiver_profiles → patient_caregivers → patient_id
```

**Other Fixes:**
- UI: Summary cards differentiation in health-log.html
- DB column fixes: `measured_at`, `active`
- BP Status UI improvement

---

## Session: 2025-12-26

### Unified AI Flow (Sonnet 4.5 Only)

**Before:** 2 pipelines (Haiku + Sonnet)
**After:** 1 pipeline (Sonnet 4.5 only)

**Changes:**
- Removed `runHealthExtractionPipeline()` from index.ts
- All messages go to OrchestratorAgent → UnifiedNLUAgent
- Added conversation logging

**AI Documentation:** Created `docs/implement_AI_model.md` for team reference

---

*Archive created: 2025-01-02*
