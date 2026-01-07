# OONJAI - Claude Development Context

> **Brand:** OONJAI (formerly Duulair)
> **Model:** Group-Based Elderly Care via LINE
> **AI Model:** Claude Sonnet 4.5 (Unified Pipeline)
> **Last Updated:** 2025-01-07

---

## Current AI Architecture

```
User Message (LINE)
       │
       ▼
┌──────────────────────────────────────┐
│           src/index.ts               │
│  handleTextMessage() / handleAudio() │
│  • Get userId, groupId, patientId    │
│  • Check menu requests               │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│        OrchestratorAgent             │
│  processWithNaturalConversation()    │
│  • Fetch patientData                 │
│  • Save conversation log             │
│  • Call UnifiedNLUAgent              │
│  • Execute action                    │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│        UnifiedNLUAgent               │
│    (Claude Sonnet 4.5 - Single Call) │
│                                      │
│  Output: {                           │
│    intent, subIntent, confidence,    │
│    entities, healthData, action,     │
│    response                          │
│  }                                   │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  ActionRouter (executeAction)        │
│  save/update/delete/query → DB       │
└──────────────────────────────────────┘
```

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Webhook Entry | `src/index.ts` |
| Main Orchestrator | `src/agents/core/OrchestratorAgent.ts` |
| NLU Agent | `src/agents/core/UnifiedNLUAgent.ts` |
| NLU Prompt | `src/lib/ai/prompts/unified-nlu.ts` |
| Action Router | `src/lib/actions/action-router.ts` |
| Intent Patterns (Legacy) | `src/agents/specialized/IntentAgent.ts` |
| Supabase Service | `src/services/supabase.service.ts` |
| Types | `src/types/nlu.types.ts`, `src/types/health.types.ts` |

---

## LIFF UI Design System

> **Redesigned:** 2025-01-07 (Commit: 179ed4e)

### Design System Files
| File | Purpose |
|------|---------|
| `public/liff/css/oonjai-theme.css` | Tailwind-inspired CSS with HSL variables + Dark Mode |
| `public/liff/js/lucide-icons.js` | 70+ Lucide SVG icons as inline strings |

### Theme Colors (HSL Variables)
```css
--primary: 191 61% 36%      /* Teal #1E7B9C */
--accent: 38 92% 50%        /* Orange #F59E0B */
--success: 142 76% 36%      /* Green */
--warning: 38 92% 50%       /* Amber */
--danger: 0 84% 60%         /* Red */
```

### Key Features
- **Kanit font** for Thai text
- **Lucide SVG icons** (replaced all emojis)
- **Dark mode** via `.dark` class on `<html>`
- **IIFE pattern** for immediate UI display
- **Gradient hero cards** with decorative circles

### Pages Updated (18 total)
```
Health Logging: health-log, log-medication, log-symptom, vitals-tracking, water-tracking
Dashboard:      dashboard
Meds/Reminders: medications, reminders
Profile:        patient-profile, my-profile, edit-profile
Registration:   index, registration, success
Group:          group-dashboard, group-registration
Other:          settings, reports
```

### Icon Usage Pattern
```javascript
// In HTML
<span id="myIcon"></span>

// In IIFE
(function initUI() {
  document.getElementById('myIcon').innerHTML = icon('pill');
  darkMode.init();
})();
```

---

## Database Schema (Current)

```
users (line_user_id, role)
  ├── caregiver_profiles (user_id)
  │     └── patient_caregivers (caregiver_id, patient_id, status)
  └── patient_profiles (user_id)
        ├── medications
        ├── reminders
        ├── vitals_logs
        ├── activity_logs
        ├── symptoms
        ├── mood_logs
        ├── sleep_logs
        ├── exercise_logs
        └── conversation_logs
```

**Important:** Old `caregivers` table is backed up - use `users` → `caregiver_profiles` → `patient_caregivers` flow.

---

## Configuration Flags

```typescript
// In OrchestratorAgent.ts & DialogAgent.ts
const USE_NATURAL_CONVERSATION_MODE = true;  // Claude-first NLU (current)
// false = Legacy IntentAgent + Routing
```

---

## Response Style Guidelines

**DO:**
- "โอเคค่ะ บันทึกแล้ว 💊"
- "รับทราบค่ะ สูงนิดนึง ดื่มน้ำเยอะๆ นะคะ 💧"

**DON'T:**
- "พิมพ์ 'กินยาแล้ว'"
- "กรุณาระบุ..."
- "คำสั่งไม่ถูกต้อง"

---

## Common Issues & Fixes

### 1. patientId is null in 1:1 chat
**Check:** `src/index.ts` user identification flow
```
users → caregiver_profiles → patient_caregivers → patient_id
```

### 2. Intent not detected correctly
**Check:** `src/lib/ai/prompts/unified-nlu.ts` - Update intent examples

### 3. Data not saved to DB
**Check:** `src/lib/actions/action-router.ts` - Verify correct table/columns

### 4. Response not sent to LINE
**Check:** `src/index.ts` - Response path: `result.data?.response || result.data?.combined?.response`

---

## Quick Start for New Session

```bash
# Read context
"อ่าน CLAUDE.md"

# Check pending tasks
"อ่าน TODO.md"

# Check recent changes
"อ่าน CHANGELOG.md"

# AI modification guide
"อ่าน docs/implement_AI_model.md"

# Session history (if needed)
"อ่าน docs/session-history.md"
```

---

## Latest Session Summary (2025-12-26)

### Unified AI Flow
- Removed dual pipeline (Haiku + Sonnet) → Single Sonnet 4.5 pipeline
- All messages go through `OrchestratorAgent.processWithNaturalConversation()`
- Added conversation logging to DB

### Documentation
- Created `docs/implement_AI_model.md` - Complete AI architecture guide for team

---

## Related Documentation

| File | Description |
|------|-------------|
| `TODO.md` | Pending tasks & priorities |
| `CHANGELOG.md` | Change history by date |
| `docs/implement_AI_model.md` | AI agents modification guide |
| `docs/session-history.md` | Archived session logs |
| `docs/CLAUDE.md` | System architecture overview |

---

*For detailed session history, see `docs/session-history.md`*
