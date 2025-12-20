
# OONJAI Changelog

## [2025-12-21] - Natural Conversation Architecture (Claude-First NLU)

### Major Change
เปลี่ยนระบบจาก **Command-Based** (Pattern Matching) → **Natural Conversation** (Claude-First NLU)

**Before:**
```
User: "ยายกินยาเสร็จแล้วค่ะหลังอาหารเช้า"
Bot:  "ได้รับข้อความแล้วค่ะ"  ← ไม่เข้าใจ
```

**After:**
```
User: "ยายกินยาเสร็จแล้วค่ะหลังอาหารเช้า"
Bot:  "บันทึกให้ยายเรียบร้อยแล้วค่ะ กินยาหลังอาหารเช้า 🌅"
```

### Added

- **UnifiedNLUAgent** (`src/agents/core/UnifiedNLUAgent.ts`) - NEW
  - Single Claude API call for intent classification + entity extraction + response generation
  - Natural Thai language understanding without pattern matching
  - JSON output with intent, entities, healthData, action, response
  - Automatic fallback for unparseable responses

- **Unified NLU Prompt** (`src/lib/ai/prompts/unified-nlu.ts`) - NEW
  - `UNIFIED_NLU_SYSTEM_PROMPT` - Comprehensive Thai health conversation prompt
  - Intent categories: health_log, profile_update, medication_manage, reminder_manage, query, emergency, greeting, general_chat
  - Helper functions: `buildPatientContextString()`, `buildRecentActivitiesString()`, `buildConversationHistoryString()`

- **Action Router** (`src/lib/actions/action-router.ts`) - NEW
  - `executeAction()` - Routes NLU results to database actions
  - Handles save, update, delete, query actions
  - Converts NLU health data to AIExtractedData format
  - Abnormal vital value detection and alerts

- **NLU Types** (`src/types/nlu.types.ts`) - NEW
  - `MainIntent`, `SubIntent` type unions
  - `NLUResult`, `NLUContext`, `NLUInput` interfaces
  - `NLUHealthData` with sub-types for each health category
  - `ActionResult`, `AbnormalAlert` interfaces

### Changed

- **OrchestratorAgent** (`src/agents/core/OrchestratorAgent.ts`)
  - Added `USE_NATURAL_CONVERSATION_MODE = true` flag
  - New `processWithNaturalConversation()` method for Claude-first flow
  - Legacy flow renamed to `processWithIntentRouting()` as fallback
  - Automatic fallback to legacy mode if NLU processing fails

- **DialogAgent** (`src/agents/specialized/DialogAgent.ts`)
  - Added `USE_NATURAL_CONVERSATION_MODE = true` flag
  - Disabled command suggestions in natural mode
  - Updated system prompt to not teach commands
  - Natural conversation guidelines for group chat

### Response Style

**DO (Natural):**
- "บันทึกให้แล้วค่ะ" ✅
- "ได้เลยค่ะ อัพเดตให้แล้ว" ✅
- Use emoji sparingly 💊💧🌅

**DON'T (Command-like):**
- "พิมพ์ 'กินยาแล้ว'" ❌
- "กรุณาระบุ..." ❌

### Configuration

Toggle between modes in `OrchestratorAgent.ts` and `DialogAgent.ts`:
```typescript
const USE_NATURAL_CONVERSATION_MODE = true;  // Claude-first NLU (default)
const USE_NATURAL_CONVERSATION_MODE = false; // Legacy IntentAgent + Routing
```

### Fixed

- **Response not sent to LINE in Natural Conversation mode** (`src/index.ts`)
  - Issue: NLU correctly detected intent and generated response, but LINE message wasn't sent
  - Cause: `index.ts` looked for `result.data.combined.response` (legacy path)
  - Natural Conversation mode returns `result.data.response`
  - Fix: Updated to check both locations for backward compatibility
  - Commit: 39de607

---

## [2025-12-20] - Voice Command Support (Groq Whisper)

### Added
- **Voice Command via LINE Audio Message**
  - Users can send voice messages instead of typing
  - Uses Groq Whisper API for Thai speech-to-text
  - Transcribed text processed same as text messages
  - Shows "🎤 ได้ยินว่า: ..." feedback to user

- **Groq Service** (`src/services/groq.service.ts`) - NEW
  - `transcribeAudio()` - Transcribe audio buffer to text
  - `transcribeStream()` - Transcribe from readable stream
  - Uses `whisper-large-v3-turbo` model (fast, $0.04/hr)
  - Thai language optimized with health-related prompt

- **Audio Message Handler** (`src/index.ts`)
  - `handleAudioMessage()` - Process voice messages
  - Downloads audio from LINE, sends to Groq Whisper
  - Runs health extraction or orchestrator on transcribed text
  - Handles errors gracefully (file too large, transcription failed)

### Usage Examples
```
User: 🎤 "กินยาแล้ว"
Bot: 🎤 ได้ยินว่า: "กินยาแล้ว"
     ✅ บันทึกการกินยาเรียบร้อยแล้วค่ะ

User: 🎤 "ความดัน หนึ่งร้อยยี่สิบ แปดสิบ"
Bot: 🎤 ได้ยินว่า: "ความดัน 120 80"
     ✅ บันทึกความดัน 120/80 เรียบร้อยแล้วค่ะ
```

### Rate Limits (Groq Free Tier)
- 20 requests/minute
- 2,000 requests/day
- 8 hours of audio/day

### Files Created
- `src/services/groq.service.ts` - Groq Whisper service

### Files Modified
- `src/index.ts` - Added handleAudioMessage, import groqService
- `.env` - Added GROQ_API_KEY
- `package.json` - Added groq-sdk dependency

---

## [2025-12-20] - Chat-based Profile Editing System

### Added
- **ProfileEditAgent** (`src/agents/specialized/ProfileEditAgent.ts`) - NEW
  - Handle profile edits via LINE Chat (no LIFF required)
  - Support weight, height, phone, name, address, blood type, medical conditions, allergies, emergency contact
  - Medication CRUD: add, edit, delete medications via chat
  - Reminder CRUD: add, edit, delete reminders via chat
  - Claude-based entity extraction for natural language understanding
  - Validation rules for all fields (weight 20-200kg, height 50-250cm, phone format, etc.)

- **Edit Intent Patterns** (`src/agents/specialized/IntentAgent.ts`)
  - Profile edit intents: `edit_profile`, `edit_name`, `edit_weight`, `edit_height`, `edit_phone`, `edit_address`, `edit_blood_type`, `edit_medical_condition`, `edit_allergies`, `edit_emergency_contact`
  - Medication intents: `add_medication`, `edit_medication`, `delete_medication`
  - Reminder intents: `add_reminder`, `edit_reminder`, `delete_reminder`
  - All edit intents added to `highConfidenceIntents` for reliable detection
  - Updated Claude classifier prompt with new intents

- **Edit Suggestions** (`src/agents/specialized/DialogAgent.ts`)
  - Smart suggestions for profile editing commands
  - Guides users on how to edit data via chat
  - Examples: "อยากเปลี่ยนน้ำหนัก" → "พิมพ์ 'น้ำหนัก 65 กิโล' ได้เลยค่ะ"

- **Agent Routing** (`src/agents/core/OrchestratorAgent.ts`)
  - Added ProfileEditAgent to agent registry
  - Routing for edit intents before confidence check (works with any confidence)
  - Passes patientData to ProfileEditAgent for context

### Usage Examples
```
# Profile edits
"น้ำหนัก 65 กิโล" → ✅ บันทึกน้ำหนัก 65 กก.
"เปลี่ยนเบอร์ 0891234567" → ✅ เปลี่ยนเบอร์โทร
"ชื่อใหม่คือ สมศรี มงคล" → ✅ เปลี่ยนชื่อ
"กรุ๊ปเลือด O+" → ✅ บันทึกกรุ๊ปเลือด

# Medications
"เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น" → ✅ เพิ่มยา
"ลบยาพาราเซตามอล" → ✅ ลบยา

# Reminders
"ตั้งเตือนกินยา 8 โมง" → ✅ ตั้งเตือน
"ลบเตือนกินยาเช้า" → ✅ ลบการเตือน
```

### Files Modified
- `src/agents/specialized/IntentAgent.ts` - Added edit patterns
- `src/agents/specialized/DialogAgent.ts` - Added edit suggestions
- `src/agents/core/OrchestratorAgent.ts` - Import & routing for ProfileEditAgent

### Files Created
- `src/agents/specialized/ProfileEditAgent.ts` - Main edit agent

---

## [2025-11-30] - Supabase Edge Functions + pg_cron for Reminders

### Added
- **Supabase Edge Functions** for scalable reminder notifications
  - `send-reminders` - Sends reminders every minute via pg_cron
  - `check-missed-activities` - Alerts if no activity for 4 hours
  - Supports LINE Multicast for efficiency
  - Logs all sent reminders to prevent duplicates

- **pg_cron Integration** (`docs/migrations/008_setup_pg_cron_reminders.sql`)
  - Database-level cron jobs for reliability
  - Works on Vercel (unlike node-cron)
  - Two jobs: every minute + every hour

- **Setup Guide** (`docs/SUPABASE_CRON_SETUP.md`)
  - Step-by-step instructions
  - Troubleshooting guide
  - Cost breakdown (free tier covers most use cases)

### Changed
- **Scheduler Service** (`src/services/scheduler.service.ts`)
  - Auto-detects Vercel and skips node-cron
  - node-cron still works for local development

---

## [2025-11-29] - Group Chat UX Improvements & Patient Context

### Fixed
- **Medications Not Displaying** (`src/services/supabase.service.ts`)
  - Fixed table name mismatch: was querying `patient_medications` instead of `medications`
  - Added JSON parsing for `days_of_week` and `times` fields
  - Medications now properly show in bot responses

- **Medications Field Names** (`src/agents/specialized/DialogAgent.ts`)
  - Fixed field mapping: `dosage_amount`, `dosage_unit`, `dosage_form` instead of `dosage`
  - Fixed schedule: uses `times` array and `frequency` instead of `schedule`
  - Now displays medications with proper formatting (name, dosage, schedule, instructions)

- **Report Intent Not Showing Actual Data** (`src/agents/core/OrchestratorAgent.ts`, `src/agents/specialized/IntentAgent.ts`)
  - Fixed "รายงานวันนี้" not showing actual report data
  - Root cause: confidence calculation `score/patterns.length` gave 1/11 = 0.09 for report intent
  - Fixed IntentAgent to give 0.9 confidence for specific action intents (report, emergency, etc.)
  - Moved `report` intent handling before confidence check in OrchestratorAgent
  - Added automatic reportType detection (daily/weekly/monthly) from message content
  - Now properly routes to ReportAgent with correct reportType parameter

- **Remove @mention Requirement** (`src/index.ts`)
  - Bot now responds to ALL messages in group chat without @mention
  - Better UX - users can chat naturally
  - Updated welcome message to reflect new behavior

- **Group vs 1:1 Context** (`src/agents/specialized/DialogAgent.ts`)
  - Bot no longer mentions "เมนูด้านล่าง" in group chat (no Rich Menu there)
  - Separate system prompts for group chat vs LINE OA
  - Group chat: only suggests text commands

- **"ข้อมูลผู้ป่วย" Intent Misclassification**
  - Fixed pattern `ป่วย` matching "ผู้ป่วย" as emergency
  - Now correctly routes to patient info handler

- **Registration Flex for Registered Users** (`src/index.ts`)
  - Check if user is already registered before showing registration flex
  - Show "คุณลงทะเบียนแล้วค่ะ" for existing users

### Added
- **Smart Intent Suggestions** (`src/agents/specialized/DialogAgent.ts`)
  - Added pattern matching for common user queries
  - Suggests exact commands when user types similar phrases
  - Examples: "อยากบันทึกยา" → "พิมพ์ 'กินยาแล้ว' ได้เลยค่ะ"

- **Enhanced Patient Context** (`src/agents/core/OrchestratorAgent.ts`)
  - Now fetches reminders that caregiver set up
  - Now fetches recent activity logs (last 3 days)
  - Always fetches patient data for group chat (not just specific intents)

- **Rich Patient Context for Claude** (`src/agents/specialized/DialogAgent.ts`)
  - Shows medications with dosage and schedule
  - Shows active reminders with times
  - Shows today's completed activities
  - Bot can now answer questions about what was set up

## [2025-11-23] - Report Menu Flex Message Fix

### Fixed
- **Report Menu Display** (`src/agents/specialized/ReportAgent.ts`)
  - Fixed "ดูรายงาน" command not showing Flex Message
  - Added `report_menu` intent handling without requiring `patientId`
  - Created interactive menu with daily, weekly, and monthly report options
  - Beautiful card UI matching OONJAI green theme

- **Agent Routing** (`src/agents/core/OrchestratorAgent.ts`)
  - Fixed empty agents array for `report_menu` intent
  - Now correctly routes to ReportAgent for menu display

## [2025-01-21] - Group Auto-Link & Intent Flexibility

### Fixed
- **Group Auto-Link Bug** (`src/services/group.service.ts`)
  - Fixed field name mismatch preventing caregiver from using bot in LINE groups
  - `checkUserExists()` was setting `linked_patient_id` (snake_case)
  - `autoLinkGroupWithPatient()` was reading `linkedPatientId` (camelCase)
  - Now correctly auto-creates group when registered caregiver sends first message

- **Scheduler Notification System** (`src/services/scheduler.service.ts`)
  - Fixed time format from `HH:MM` to `HH:MM:SS` to match database
  - Fixed field names: `custom_time` → `time`, `reminder_type` → `type`
  - Changed INNER JOIN to LEFT JOIN for nullable `patient_profiles.user_id`
  - Added extensive logging for debugging

### Improved
- **Intent Pattern Matching** (`src/agents/specialized/IntentAgent.ts`)
  - Expanded patterns 2-3x for natural language understanding
  - Examples: "ชื่ออะไร" / "เขาชื่อ" / "ผู้ป่วยชื่อ" all work
  - Reduced confidence threshold from 0.7 to 0.5 for better flexibility
  - Updated help text to encourage natural language usage

### Database
- **Medications Schema** (`docs/migrations/007_fix_medications_schema.sql`)
  - Added missing columns: `patient_id`, `dosage_amount`, `dosage_unit`, `times`, `instructions`, `note`
  - Migrated existing `user_id` to `patient_id`

## [2025-01-21] - LIFF Features & OCR Enhancement

### Added
- **Vitals Tracking LIFF Page** (`public/liff/vitals-tracking.html`)
  - Full blood pressure recording with systolic/diastolic/pulse
  - Blood pressure status indicator (normal/high/low) based on AHA guidelines
  - Delete functionality for logged readings
  - Toast notifications for user feedback
  - Proper `patient_id` handling from `duulair_context`

- **OCR API Endpoint** (`POST /api/ocr/vitals`)
  - Image upload via multipart/form-data
  - Claude Vision API (Haiku) for blood pressure OCR
  - Extracts systolic, diastolic, and pulse values from images
  - Returns JSON response with extracted data
  - Error handling for invalid images

- **Water Tracking Delete Feature** (`public/liff/water-tracking.html`)
  - Delete button for each water log entry
  - Properly updates total when deleting entries
  - Unique ID for each log entry

### Fixed
- **Foreign Key Constraint Violations**
  - Fixed `patient_id` loading in `public/liff/reminders.html`
  - Fixed `patient_id` loading in `public/liff/medications.html`
  - Corrected localStorage usage: `duulair_context.patientId` (✅) vs `duulair_user.profile_id` (❌ caregiverId)
  - Added detailed comments explaining the difference

- **Toast Notifications** (`public/liff/reminders.html`)
  - Added CSS for slide-up toast animations
  - Replaced alerts with toast notifications
  - Auto-hide after 3 seconds

- **Dashboard Menu** (`public/liff/dashboard.html`)
  - Changed "วัดความดัน" button to link to `vitals-tracking.html`
  - Removed unused functions: `logFood()`, `logExercise()`, `logSleep()`
  - Removed buttons: Food, Exercise, Sleep tracking (simplified menu)

### Dependencies
- Added `multer` for file uploads
- Added `@types/multer` for TypeScript support

### Technical Notes
- OCR feature works both via LIFF upload and LINE chat image messages
- All LIFF pages now correctly use `contextData.patientId` for database operations
- Water tracking and vitals tracking use localStorage for temporary storage with TODO for Supabase integration

## [2024-11-19] Session 2 - Scheduler & Alerts

### Completed Tasks

#### 1. Emergency Alert System
- File: `src/agents/specialized/AlertAgent.ts`
  - Implemented full push notification system to caregivers
  - CRITICAL alerts: Send to ALL caregivers + LINE group
  - URGENT alerts: Send to primary caregiver + group
  - WARNING alerts: Send to LINE group only
  - Added response message back to user after emergency
  - Added `getGroupByPatientId()` to `src/services/group.service.ts`

#### 2. Cron Job Scheduler
- File: `src/services/scheduler.service.ts` (NEW)
  - Uses `node-cron` package
  - `checkDueReminders()` - runs every minute
  - `checkMissedActivities()` - runs every hour (4h threshold)
  - Sends notifications to LINE groups and patients
  - Started in `src/index.ts` on app initialization

#### 3. Duplicate Send Prevention
- File: `src/services/scheduler.service.ts`
  - Added `checkIfAlreadySentToday()` method
  - Logs sent reminders to `reminder_logs` table
  - Prevents same reminder from being sent multiple times per day

#### 4. Default Reminders on Patient Registration
- File: `src/services/reminder.service.ts`
  - Added `createDefaultReminders()` function
  - Auto-creates 6 daily reminders for new patients:
    - 08:00 กินยาเช้า
    - 18:00 กินยาเย็น
    - 09:00 วัดความดัน
    - 10:00 ดื่มน้ำ
    - 14:00 ดื่มน้ำ
    - 16:00 ออกกำลังกาย
- File: `src/services/user.service.ts`
  - Integrated into `createPatientProfile()`

#### 5. IntentAgent Pattern Updates
- File: `src/agents/specialized/IntentAgent.ts`
  - Added patterns for `group_help`: วิธีใช้, help, เมนู

#### 6. Welcome Message Update
- File: `src/index.ts`
  - Added command examples when bot joins group

### Files Modified
- `src/agents/specialized/AlertAgent.ts` - Emergency alert implementation
- `src/services/group.service.ts` - Added getGroupByPatientId()
- `src/services/scheduler.service.ts` - NEW cron job scheduler
- `src/services/reminder.service.ts` - Default reminders
- `src/services/user.service.ts` - Integration of default reminders
- `src/agents/specialized/IntentAgent.ts` - Pattern updates
- `src/index.ts` - Scheduler start, welcome message

### Database Tables Used
- `reminders` - Reminder configurations
- `reminder_logs` - Sent reminder history (for dedup)
- `activity_logs` - For missed activity detection

---

## [2024-11-19] Session 1 - Image OCR & Brand Change

### Completed Tasks

#### 1. Brand Change
- Changed brand name from "Duulair" to "OONJAI" throughout codebase
- Updated `@duulair` mentions to `@oonjai`
- Files modified: Multiple files across the project

#### 2. TypeScript Fixes
- Fixed TypeScript errors in `src/services/group.service.ts`
  - Changed `linked_patient_id` to `linkedPatientId` (camelCase)
  - Changed `first_name`/`last_name` to `firstName`/`lastName`
  - Used `const caregiverProfile: any` for type assertion

#### 3. Settings Page UX Improvements
- File: `public/liff/settings.html`
- Hidden "Group" tab with `style="display: none;"`
- Changed default active tab from "group" to "reports"

#### 4. Group Chat Context-Aware Responses
- File: `src/agents/specialized/HealthAgent.ts`
  - Added group-specific response in `processVitals()`
  - Example for group: `@oonjai ความดัน 120/80`

- File: `src/agents/core/OrchestratorAgent.ts`
  - Modified `aggregateResponses()` to prioritize HealthAgent response over DialogAgent
  - Prevents bot from telling group users to click Rich Menu buttons

#### 5. Image OCR Support for Blood Pressure
- File: `src/index.ts`
  - Added `handleImageMessage()` function
  - Uses Claude Vision API (`claude-3-haiku-20240307`) to extract values from blood pressure monitor images
  - Extracts: systolic, diastolic, pulse
  - Saves to database with metadata `source: 'image_ocr'`
  - Includes alerts for high BP (>140/90) or low BP (<90/60)
  - Works in both 1:1 chat and group chat contexts

### Files Modified
- `src/index.ts` - Image handler, supabaseService import
- `src/services/group.service.ts` - TypeScript fixes
- `src/agents/specialized/HealthAgent.ts` - Context-aware responses
- `src/agents/core/OrchestratorAgent.ts` - Response priority
- `public/liff/settings.html` - Tab visibility

### Pending/Future Tasks
- Test image OCR feature with real blood pressure monitor images
- Consider adding support for blood sugar meter OCR
- Add more patient info query types

---

## Previous Sessions

### Group-Based Care Model Implementation
- Patient info queries in group chat
- Group auto-link flow
- Activity logging with group context (group_id, actor_line_user_id, actor_display_name)
- See `TASK-002-GROUP-BASED-FLOW.md` for details
