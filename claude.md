# OONJAI - Claude Development Context

> **Brand:** OONJAI (formerly Duulair)
> **Model:** Group-Based Elderly Care via LINE
> **AI Model:** Claude Sonnet 4.5 (Unified Pipeline)
> **Last Updated:** 2025-12-26

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
