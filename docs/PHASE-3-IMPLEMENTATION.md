# Phase 3 Implementation: Webhook & Group Logic (TASK-002)

## Overview

Phase 3 implements webhook handling for LINE group events and message routing with actor tracking for the Group-Based Care Model.

## ✅ Completed Features

### 1. Group Webhook Service
**File:** `src/services/group-webhook.service.ts` (320+ lines)

Comprehensive service for handling all group-related webhook events:

#### Event Handlers:
- **`handleGroupJoin()`** - Bot joins a group
  - Checks if group already registered
  - Returns success/awaiting registration status

- **`handleGroupLeave()`** - Bot leaves a group
  - Marks group as inactive in database
  - Preserves historical data

- **`handleMemberJoin()`** - Members join a group
  - Adds new members to `group_members` table
  - Assigns default 'family' role
  - Reactivates members who previously left

- **`handleMemberLeave()`** - Members leave a group
  - Marks members as inactive
  - Records left_at timestamp
  - Preserves member history

#### Message Handling:
- **`handleGroupMessage()`** - Process group messages
  - Gets group data and patient context
  - Extracts actor information (who sent message)
  - Returns group context for orchestrator

- **`getGroupContext()`** - Get patient context for group
  - Maps LINE Group ID to patient ID
  - Returns group ID and source flag

- **`updateMemberProfile()`** - Update member display name and picture
  - Updates from LINE profile data
  - Improves actor tracking accuracy

### 2. Updated Webhook Handler
**File:** `src/index.ts`

Enhanced main webhook handler with group support:

#### New Event Types:
```typescript
case 'join':          // Bot joins group
case 'leave':         // Bot leaves group
case 'memberJoined':  // Member joins group
case 'memberLeft':    // Member leaves group
```

#### Group Message Detection:
- Detects group vs 1:1 context from `source.type`
- Extracts `groupId` from event
- Routes to group webhook service
- Skips unregistered groups

#### Context Enhancement:
```typescript
// 1:1 Context
{
  userId: string,
  patientId: string,
  source: 'line',
  timestamp: Date
}

// Group Context
{
  userId: string,
  patientId: string,
  groupId: string,
  source: 'group',
  timestamp: Date,
  actorLineUserId: string,
  actorDisplayName: string
}
```

#### Welcome Message:
When bot joins a group, sends welcome message with:
- Greeting
- Instructions
- Registration LIFF link

### 3. Updated Message Schema
**File:** `src/agents/core/BaseAgent.ts`

Extended Message context to include group fields:

```typescript
context: z.object({
  userId: z.string().optional(),
  patientId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
  source: z.enum(['line', 'api', 'n8n', 'system', 'group']), // Added 'group'
  // Group-specific fields (TASK-002)
  groupId: z.string().optional(),
  actorLineUserId: z.string().optional(),
  actorDisplayName: z.string().optional()
})
```

### 4. Updated Activity Logging
**Files:**
- `src/agents/specialized/HealthAgent.ts`
- `src/agents/core/OrchestratorAgent.ts`

Both agents now include group context and actor info when logging:

```typescript
// Before (1:1 only)
{
  patient_id: string,
  task_type: string,
  value: any,
  timestamp: Date
}

// After (supports both 1:1 and group)
{
  patient_id: string,
  task_type: string,
  value: any,
  timestamp: Date,

  // Group fields
  group_id: string | null,
  actor_line_user_id: string | null,
  actor_display_name: string | null,
  source: '1:1' | 'group'
}
```

### 5. Actor Tracking

Every activity logged from a group now includes:
- **Who** performed the action (actor_line_user_id, actor_display_name)
- **Where** it happened (group_id)
- **For whom** (patient_id)
- **When** (timestamp)

This enables:
- Activity attribution ("ลูกสาวบันทึกความดัน")
- Member contribution tracking
- Audit trails for group activities

## 📁 Files Created/Modified

### Created:
1. `src/services/group-webhook.service.ts` (320 lines)
2. `docs/PHASE-3-IMPLEMENTATION.md` (this file)

### Modified:
1. `src/index.ts`
   - Added group webhook service import
   - Added 4 new event handlers
   - Enhanced handleTextMessage with group detection
   - Added welcome message for group join

2. `src/agents/core/BaseAgent.ts`
   - Extended MessageSchema with group fields
   - Added 'group' to source enum

3. `src/agents/specialized/HealthAgent.ts`
   - Added group context and actor to activity logs

4. `src/agents/core/OrchestratorAgent.ts`
   - Added group context and actor to processing logs

## 🎯 Event Flow

### Bot Joins Group
```
LINE Group → Webhook 'join' event
     ↓
handleGroupJoin()
     ↓
Check if group registered
     ↓
Send welcome message with LIFF link
```

### Member Joins Group
```
LINE Group → Webhook 'memberJoined' event
     ↓
handleMemberJoin()
     ↓
Check if group registered
     ↓
Add member to group_members table (role: 'family')
```

### Message in Group
```
LINE Group → Webhook 'message' event
     ↓
Detect: sourceType === 'group'
     ↓
Get group context (group_id, patient_id)
     ↓
Get actor info (who sent message)
     ↓
Pass to Orchestrator with enhanced context
     ↓
Process message (HealthAgent, etc.)
     ↓
Log activity with group_id and actor info
     ↓
Reply to group
```

### Member Leaves Group
```
LINE Group → Webhook 'memberLeft' event
     ↓
handleMemberLeave()
     ↓
Mark member as inactive
     ↓
Record left_at timestamp
```

### Bot Leaves Group
```
LINE Group → Webhook 'leave' event
     ↓
handleGroupLeave()
     ↓
Mark group as inactive
     ↓
Preserve all historical data
```

## 🧪 Testing Checklist

### Prerequisites:
- [ ] Webhook URL configured in LINE Developers Console
- [ ] SSL certificate valid (LINE requires HTTPS)
- [ ] Group routes working (Phase 1)
- [ ] Registration form working (Phase 2)

### Test Cases:

#### TC1: Bot Joins Group
1. Create a new LINE group
2. Add bot to the group
3. Expected:
   - Webhook receives 'join' event
   - Bot sends welcome message with LIFF link
   - Group not yet in database (awaiting registration)

#### TC2: Group Registration
1. Click LIFF link from welcome message
2. Complete registration form
3. Expected:
   - Group saved to `groups` table
   - Patient saved to `patient_profiles` table
   - Caregiver saved to `caregiver_profiles` table
   - Caregiver added to `group_members` table

#### TC3: Message in Registered Group
1. Send "กินยาแล้ว" in group chat
2. Expected:
   - Webhook detects group context
   - Gets group_id and patient_id
   - Gets actor info (sender)
   - Processes message
   - Logs to `activity_logs` with:
     - `group_id`
     - `actor_line_user_id`
     - `actor_display_name`
     - `source = 'group'`
   - Bot replies to group

#### TC4: Message in Unregistered Group
1. Add bot to new group (don't register)
2. Send message in group
3. Expected:
   - Webhook detects unregistered group
   - Skips message processing
   - No reply sent
   - Log: "Group not registered, ignoring message"

#### TC5: Member Joins Registered Group
1. Invite new member to registered group
2. Expected:
   - Webhook receives 'memberJoined' event
   - New member added to `group_members` with role='family'
   - Member can now log activities

#### TC6: Member Leaves Group
1. Member leaves the group
2. Expected:
   - Webhook receives 'memberLeft' event
   - Member marked as inactive (`is_active = false`)
   - `left_at` timestamp recorded
   - Historical activities preserved

#### TC7: Member Rejoins Group
1. Member who left rejoins group
2. Expected:
   - Reactivates existing `group_members` record
   - Sets `is_active = true`
   - Clears `left_at` timestamp

#### TC8: Bot Leaves Group
1. Remove bot from group
2. Expected:
   - Webhook receives 'leave' event
   - Group marked as inactive
   - All data preserved

#### TC9: Actor Tracking Verification
1. Multiple members send messages in group
2. Query `activity_logs`
3. Expected:
   - Each log has different `actor_line_user_id`
   - Each log has correct `actor_display_name`
   - All logs have same `group_id` and `patient_id`

#### TC10: 1:1 Chat Still Works
1. Send message in 1:1 chat with bot
2. Expected:
   - Detects source='line' (not 'group')
   - Processes normally
   - Logs with `source = '1:1'`
   - Group fields are NULL

## 🔍 Database Verification

### Check Group Members
```sql
SELECT
  gm.line_user_id,
  gm.display_name,
  gm.role,
  gm.is_active,
  gm.joined_at,
  gm.left_at,
  g.group_name
FROM group_members gm
JOIN groups g ON gm.group_id = g.id
WHERE g.line_group_id = 'Cxxxxx'
ORDER BY gm.joined_at;
```

### Check Activity Logs with Actor
```sql
SELECT
  al.timestamp,
  al.task_type,
  al.source,
  al.actor_display_name,
  al.value,
  g.group_name,
  CONCAT(p.first_name, ' ', p.last_name) as patient_name
FROM activity_logs al
LEFT JOIN groups g ON al.group_id = g.id
LEFT JOIN patient_profiles p ON al.patient_id = p.id
WHERE al.source = 'group'
ORDER BY al.timestamp DESC
LIMIT 20;
```

### Check Member Activity Counts
```sql
SELECT
  al.actor_display_name,
  COUNT(*) as activity_count,
  ARRAY_AGG(DISTINCT al.task_type) as activity_types
FROM activity_logs al
WHERE al.group_id = 'xxx-group-id-xxx'
GROUP BY al.actor_display_name
ORDER BY activity_count DESC;
```

## 🎨 Welcome Message

When bot joins a group, sends:

```
สวัสดีค่ะ! 👋

ขอบคุณที่เพิ่มบอท Duulair เข้ามาในกลุ่มนะคะ

🎯 ขั้นตอนต่อไป:
1. ลงทะเบียนกลุ่มและข้อมูลผู้ป่วย
2. เริ่มบันทึกกิจกรรมดูแลสุขภาพ
3. ดูรายงานสุขภาพรายวัน/รายสัปดาห์

กรุณากดลงทะเบียนเพื่อเริ่มใช้งาน 👇
https://liff.line.me/{LIFF_ID}/group-registration.html
```

## 📊 Architecture Diagram

```
┌─────────────────┐
│   LINE Group    │
└────────┬────────┘
         │ Webhook Events
         ↓
┌─────────────────────────────────────┐
│      Webhook Handler (index.ts)    │
├─────────────────────────────────────┤
│ • join                              │
│ • leave                             │
│ • memberJoined                      │
│ • memberLeft                        │
│ • message (with group detection)    │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│  GroupWebhookService                │
├─────────────────────────────────────┤
│ • handleGroupJoin()                 │
│ • handleGroupLeave()                │
│ • handleMemberJoin()                │
│ • handleMemberLeave()               │
│ • handleGroupMessage()              │
│ • getGroupContext()                 │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│      OrchestratorAgent              │
│    (with group context)             │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│      HealthAgent                    │
│  (logs with actor info)             │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│    Supabase Database                │
├─────────────────────────────────────┤
│ • activity_logs                     │
│   - group_id                        │
│   - actor_line_user_id              │
│   - actor_display_name              │
│   - source ('1:1' | 'group')        │
│ • groups                            │
│ • group_members                     │
└─────────────────────────────────────┘
```

## 🚀 Key Features

### 1. Context-Aware Routing
- Automatically detects 1:1 vs group context
- Routes accordingly
- Backward compatible with existing 1:1 flow

### 2. Actor Tracking
- Every group activity knows WHO did it
- Enables member contribution reports
- Audit trail for accountability

### 3. Member Lifecycle
- Tracks join/leave events
- Supports member reactivation
- Preserves historical data

### 4. Smart Defaults
- New members get 'family' role
- Group activities default to patient from group
- Display names auto-update from LINE profiles

### 5. Error Resilience
- Gracefully handles unregistered groups
- Skips messages from non-registered groups
- Preserves message order and reply tokens

## 🐛 Known Issues / Limitations

1. **Display Names:**
   - Initial display name is placeholder until member sends first message
   - Can be improved with LINE Profile API calls

2. **Bot Messages:**
   - Bot's own messages trigger 'message' events
   - Currently ignored (no actor_line_user_id)

3. **Member Roles:**
   - New members default to 'family' role
   - Cannot currently promote to 'caregiver'
   - Would need admin panel (future feature)

4. **Unregistered Groups:**
   - Messages silently ignored
   - Could send reminder to register
   - Would need rate limiting

## 📋 Next Steps (Phase 4)

Phase 4 will implement:
1. Rich Menu for group commands
2. Quick Reply menus for common actions
3. Help command with instructions
4. Settings command for group preferences

## 🎉 Phase 3 Complete!

All Phase 3 deliverables have been implemented:

✅ Group event handlers (join, leave, memberJoined, memberLeft)
✅ Group message routing with context detection
✅ Actor tracking for all group activities
✅ Enhanced activity logging with group fields
✅ Welcome message with registration link
✅ Member lifecycle management
✅ Backward compatibility with 1:1 flow

**Total Implementation Time:** ~2 hours
**Files Created:** 2
**Files Modified:** 4
**Lines of Code:** ~500+ lines

**Phases Completed:** 3/6 (50% ✅)

Ready to proceed to Phase 4: Rich Menu & Chat Commands!
