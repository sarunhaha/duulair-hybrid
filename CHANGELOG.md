# OONJAI Changelog

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
