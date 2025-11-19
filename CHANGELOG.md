# OONJAI Changelog

## [2024-11-19] Session Update

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
