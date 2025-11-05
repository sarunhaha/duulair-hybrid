# TASK-002: Group-Based Flow Redesign

**Status:** 📝 Specification
**Priority:** High
**Estimated Time:** 11-16 hours
**Created:** 2025-11-05
**Version:** 1.0.0

---

## 🎯 Objective

Redesign registration and usage flow from **Patient-Centric** to **Group-Based** model.

### Current Problems:
- ❌ Too many registration steps (4 steps for patient, separate for caregiver)
- ❌ Link Code system adds complexity
- ❌ Approval flow creates friction
- ❌ Patients need LINE accounts (not always realistic)
- ❌ Confusion about who manages what

### New Goals:
- ✅ Simple 1-form registration (Caregiver registers for both)
- ✅ Group-based model: 1 LINE Group = 1 Patient
- ✅ All family members can interact in group
- ✅ Patient optional (elderly may not have LINE)
- ✅ Actor tracking for all activities

---

## 📊 Current State vs Future State

### **Current Flow (TASK-001):**
```
┌─────────────┐
│   Patient   │
│  registers  │
│  (4 steps)  │
│      ↓      │
│ Link Code   │
│   created   │
└─────────────┘
      ↓
┌─────────────┐
│  Caregiver  │
│  registers  │
│ uses Link   │
│    Code     │
│      ↓      │
│ Wait approve│
└─────────────┘
```

**Users:** Patient + Caregiver (separate accounts)
**Communication:** 1:1 with bot
**Registration:** 2 separate flows
**Data Entry:** Each manages own data

### **New Flow (TASK-002):**
```
┌─────────────────────────────┐
│    Caregiver creates        │
│    LINE Group for family    │
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│   Invite Duulair Bot        │
│   to the group              │
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│  Bot sends registration     │
│  link to group              │
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│  Caregiver opens LIFF       │
│  Fills ONE form:            │
│  • Caregiver info           │
│  • Patient info             │
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│  ✅ Ready to use!           │
│  All members can interact   │
└─────────────────────────────┘
```

**Users:** 1 Group (Caregiver + Patient + Family)
**Communication:** Group chat + 1:1 bot
**Registration:** 1 form (Caregiver fills both)
**Data Entry:** Anyone in group logs data

---

## 🏗️ Architecture Changes

### **MVP Constraints:**
```
1 LINE Group = 1 Patient = 1 Primary Caregiver

Group Members:
├── Duulair Bot (required)
├── Primary Caregiver (manager)
├── Patient (optional - if has LINE)
└── Family Members (optional - can log data)
```

### **Future Extensions (out of scope for MVP):**
- 1 Caregiver → Multiple Patients (multiple groups)
- 1 Patient → Multiple Caregivers (invite to same group)
- Multiple Patients per family (separate groups)

---

## 🗄️ Database Schema Changes

### **New Tables:**

```sql
-- ============================================================
-- GROUPS TABLE (NEW)
-- ============================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_group_id VARCHAR(255) UNIQUE NOT NULL,
  group_name VARCHAR(255),
  patient_id UUID REFERENCES patient_profiles(id),
  primary_caregiver_id UUID REFERENCES caregiver_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT groups_line_group_id_key UNIQUE (line_group_id)
);

CREATE INDEX idx_groups_line_group_id ON groups(line_group_id);
CREATE INDEX idx_groups_patient_id ON groups(patient_id);
CREATE INDEX idx_groups_caregiver_id ON groups(primary_caregiver_id);

COMMENT ON TABLE groups IS 'LINE Groups for family-based care';
COMMENT ON COLUMN groups.line_group_id IS 'LINE Group ID from webhook';
COMMENT ON COLUMN groups.patient_id IS 'The patient being cared for in this group';
COMMENT ON COLUMN groups.primary_caregiver_id IS 'Main caregiver who set up the group';

-- ============================================================
-- GROUP MEMBERS TABLE (NEW)
-- ============================================================
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  line_user_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  picture_url TEXT,
  role VARCHAR(50) CHECK (role IN ('caregiver', 'patient', 'family')),
  joined_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT group_members_unique UNIQUE (group_id, line_user_id)
);

CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_line_user_id ON group_members(line_user_id);

COMMENT ON TABLE group_members IS 'Members of each group (all can interact with bot)';
COMMENT ON COLUMN group_members.role IS 'Role in the group: caregiver (manager), patient (if has LINE), family (helper)';
```

### **Modified Tables:**

```sql
-- ============================================================
-- ACTIVITY LOGS - Add Group & Actor Context
-- ============================================================
ALTER TABLE activity_logs
  ADD COLUMN group_id UUID REFERENCES groups(id),
  ADD COLUMN actor_line_user_id VARCHAR(255),
  ADD COLUMN actor_display_name VARCHAR(255),
  ADD COLUMN source VARCHAR(50) DEFAULT '1:1' CHECK (source IN ('1:1', 'group'));

CREATE INDEX idx_activity_logs_group_id ON activity_logs(group_id);
CREATE INDEX idx_activity_logs_actor ON activity_logs(actor_line_user_id);

COMMENT ON COLUMN activity_logs.group_id IS 'Group where activity was logged (NULL if 1:1)';
COMMENT ON COLUMN activity_logs.actor_line_user_id IS 'Who logged this activity';
COMMENT ON COLUMN activity_logs.actor_display_name IS 'Display name of actor';
COMMENT ON COLUMN activity_logs.source IS 'Where activity came from: 1:1 or group';

-- ============================================================
-- PATIENT PROFILES - Allow NULL user_id
-- ============================================================
-- Already allows NULL in current schema
-- patient_profiles.user_id can be NULL for patients without LINE

-- ============================================================
-- USERS - Add group context (optional)
-- ============================================================
ALTER TABLE users
  ADD COLUMN primary_group_id UUID REFERENCES groups(id);

CREATE INDEX idx_users_primary_group ON users(primary_group_id);

COMMENT ON COLUMN users.primary_group_id IS 'Primary group for this user (if caregiver with multiple groups)';
```

### **Deprecated Tables (keep for backward compatibility):**

```sql
-- link_codes - Keep table but not used in MVP
-- Can be used in future for:
--   - Inviting additional caregivers
--   - Connecting multiple groups
--   - Patient self-registration (if they get a phone later)

-- For now: INSERT new records with used=true to mark as "not used in this flow"
```

---

## 🔌 API Endpoints

### **New Endpoints:**

#### **1. Group Registration**
```typescript
POST /api/groups/register

Request:
{
  line_group_id: string,        // From webhook
  group_name?: string,           // Optional group display name

  // Caregiver info
  caregiver: {
    line_user_id: string,
    display_name: string,
    picture_url?: string,
    first_name: string,
    last_name: string,
    phone_number?: string
  },

  // Patient info
  patient: {
    first_name: string,
    last_name: string,
    nickname?: string,
    birth_date: string,           // YYYY-MM-DD
    gender: 'male' | 'female' | 'other',
    weight_kg?: number,
    height_cm?: number,
    blood_type?: string,
    chronic_diseases?: string[],
    drug_allergies?: string[],
    food_allergies?: string[],
    address?: string,
    phone_number?: string,
    emergency_contact_name?: string,
    emergency_contact_phone?: string,
    emergency_contact_relation?: string,

    // Optional: if patient has LINE
    line_user_id?: string,
    display_name?: string,
    picture_url?: string
  }
}

Response:
{
  success: true,
  group: {
    id: string,
    line_group_id: string,
    group_name: string,
    patient_id: string,
    primary_caregiver_id: string
  },
  message: "ลงทะเบียนสำเร็จ! กลุ่มพร้อมใช้งานแล้ว"
}
```

#### **2. Get Group Info**
```typescript
GET /api/groups/:groupId
GET /api/groups/by-line-id/:lineGroupId

Response:
{
  success: true,
  group: {
    id: string,
    line_group_id: string,
    group_name: string,
    is_active: boolean,
    created_at: string,

    // Populated
    patient: PatientProfile,
    primary_caregiver: CaregiverProfile,
    members: GroupMember[]
  }
}
```

#### **3. Add Group Member**
```typescript
POST /api/groups/:groupId/members

Request:
{
  line_user_id: string,
  display_name: string,
  picture_url?: string,
  role: 'caregiver' | 'patient' | 'family'
}

Response:
{
  success: true,
  member: GroupMember
}
```

#### **4. Get Group Activities**
```typescript
GET /api/groups/:groupId/activities?date=YYYY-MM-DD

Response:
{
  success: true,
  activities: Activity[],
  summary: {
    total: number,
    by_type: Record<string, number>,
    by_actor: Record<string, number>
  }
}
```

#### **5. Check Group Registration**
```typescript
POST /api/groups/check

Request:
{
  line_group_id: string
}

Response:
{
  exists: boolean,
  group?: Group,
  patient?: PatientProfile,
  primary_caregiver?: CaregiverProfile
}
```

### **Modified Endpoints:**

```typescript
// Keep existing but add group_id parameter
POST /api/health/log
  ↓
  Add: group_id, actor_line_user_id, actor_display_name, source

GET /api/reports/daily/:patientId
  ↓
  Add alternative: GET /api/groups/:groupId/reports/daily

GET /api/reports/weekly/:patientId
  ↓
  Add alternative: GET /api/groups/:groupId/reports/weekly
```

---

## 🎨 Frontend Changes

### **Files to Remove/Archive:**

```
❌ public/liff/role-selection.html          (not needed)
❌ public/liff/patient-registration.html    (4-step form - replaced)
❌ public/liff/caregiver-registration.html  (replaced with group form)
❌ public/liff/success.html                 (QR code not needed)

Keep for reference but don't use in flow.
```

### **New Files:**

```
✅ public/liff/group-registration.html
   - Single form for Caregiver + Patient
   - Cleaner, simpler UI
   - Auto-fill caregiver from LIFF profile
   - Patient section prominent

✅ public/liff/group-dashboard.html
   - Show group info
   - List members
   - Patient info
   - Quick actions

✅ public/liff/group-settings.html
   - Manage members
   - Edit patient info
   - Notification settings
```

### **Modified Files:**

```
📝 public/liff/index.html
   - Detect group vs 1:1 context
   - Redirect to group-registration if group
   - Redirect to existing flow if 1:1

📝 public/liff/dashboard.html
   - Support both old (1:1) and new (group) flows
   - Show group context if in group
   - Backward compatible
```

### **CSS Updates:**

```css
/* public/liff/css/style.css */

/* Group-specific styles */
.group-badge {
  background: #E8F5E9;
  color: #2E7D32;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  margin-bottom: 8px;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.member-info {
  flex: 1;
}

.member-role {
  font-size: 12px;
  color: #757575;
}
```

---

## 📱 Rich Menu Changes

### **New Rich Menu Layout:**

```
┌──────────────────┬──────────────────┬──────────────────┐
│  📝 บันทึก        │   📊 รายงาน       │  👤 ข้อมูลผู้ป่วย  │
│  Quick Reply     │  วันนี้/สัปดาห์   │  ดู/แก้ไข        │
│  (URI/Message)   │  (Message)       │  (LIFF)          │
├──────────────────┼──────────────────┼──────────────────┤
│  🔔 เตือน         │   💊 ยา          │  ⚙️ ตั้งค่า       │
│  ดู/แก้ไขเวลา    │  รายการยา        │  กลุ่ม/แจ้งเตือน  │
│  (LIFF)          │  (LIFF)          │  (LIFF)          │
└──────────────────┴──────────────────┴──────────────────┘
```

### **Button Actions:**

```json
{
  "size": {"width": 2500, "height": 1686},
  "selected": true,
  "name": "Duulair Group Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": {"x": 0, "y": 0, "width": 833, "height": 843},
      "action": {
        "type": "message",
        "text": "บันทึกข้อมูลสุขภาพ"
      }
    },
    {
      "bounds": {"x": 834, "y": 0, "width": 833, "height": 843},
      "action": {
        "type": "message",
        "text": "รายงานวันนี้"
      }
    },
    {
      "bounds": {"x": 1667, "y": 0, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2008278683-5k69jxNq/group-dashboard.html"
      }
    },
    {
      "bounds": {"x": 0, "y": 843, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2008278683-5k69jxNq/reminders.html"
      }
    },
    {
      "bounds": {"x": 834, "y": 843, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2008278683-5k69jxNq/medications.html"
      }
    },
    {
      "bounds": {"x": 1667, "y": 843, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2008278683-5k69jxNq/group-settings.html"
      }
    }
  ]
}
```

### **Changes from Old Rich Menu:**

| Old | New | Reason |
|-----|-----|--------|
| ลงทะเบียน | (removed) | Not needed - bot handles in group |
| คุยกับ AI | (removed) | Chat works naturally in group |
| โปรไฟล์ | ข้อมูลผู้ป่วย | Focus on patient, not self |
| - | 🔔 เตือน | New feature needed |
| - | 💊 ยา | New feature needed |
| - | ⚙️ ตั้งค่า | New feature needed |

---

## 🤖 Webhook Logic Changes

### **Event Types to Handle:**

```typescript
// New events
'join'          // Bot joins group
'leave'         // Bot leaves group
'memberJoined'  // New member joins
'memberLeft'    // Member leaves

// Modified events
'message'       // Now group-aware
'follow'        // Keep for 1:1 onboarding
'unfollow'      // Keep for cleanup
```

### **New Webhook Handlers:**

#### **handleGroupJoin (Bot joins group)**
```typescript
async function handleGroupJoin(event: JoinEvent) {
  const groupId = event.source.groupId;

  // 1. Check if group already registered
  const existing = await checkGroupRegistration(groupId);

  if (existing) {
    // Already registered - welcome back
    await line.replyMessage(event.replyToken, {
      type: 'text',
      text: '👋 สวัสดีค่ะ! ยินดีต้อนรับกลับมานะคะ\n\nกลุ่มนี้ลงทะเบียนไว้แล้ว พร้อมใช้งานได้เลยค่ะ ✨'
    });
    return;
  }

  // 2. New group - send registration link
  const liffUrl = `https://liff.line.me/${LIFF_ID}/group-registration.html?groupId=${groupId}`;

  await line.replyMessage(event.replyToken, {
    type: 'flex',
    altText: 'ลงทะเบียนกลุ่มครอบครัว',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '👋 สวัสดีค่ะ!',
            weight: 'bold',
            size: 'xl',
            margin: 'md'
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่ Duulair\nระบบดูแลสุขภาพผู้สูงอายุ',
            size: 'sm',
            color: '#999999',
            margin: 'md',
            wrap: true
          },
          {
            type: 'separator',
            margin: 'xl'
          },
          {
            type: 'text',
            text: 'กรุณาลงทะเบียนกลุ่มครอบครัวก่อนใช้งาน',
            margin: 'xl',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '📝 ลงทะเบียนกลุ่ม',
              uri: liffUrl
            },
            style: 'primary',
            color: '#4CAF50'
          }
        ]
      }
    }
  });
}
```

#### **handleGroupMessage (Message in group)**
```typescript
async function handleGroupMessage(event: MessageEvent) {
  const groupId = event.source.groupId!;
  const userId = event.source.userId!;

  // 1. Check group registration
  const group = await getGroupByLineId(groupId);

  if (!group) {
    // Not registered - ignore or remind
    return;
  }

  // 2. Get member info (for actor tracking)
  let member = await getGroupMember(group.id, userId);

  if (!member) {
    // New member - fetch profile and add
    const profile = await line.getProfile(userId);
    member = await addGroupMember({
      group_id: group.id,
      line_user_id: userId,
      display_name: profile.displayName,
      picture_url: profile.pictureUrl,
      role: 'family' // Default role
    });
  }

  // 3. Process message based on type
  if (event.message.type === 'text') {
    const text = event.message.text;

    // Health logging commands
    if (text.includes('กินยา') || text.includes('ยา')) {
      await handleMedicationLog(event, group, member);
    }
    else if (text.includes('ความดัน') || text.includes('วัด')) {
      await handleBloodPressureLog(event, group, member);
    }
    else if (text.includes('รายงาน')) {
      await handleReportRequest(event, group);
    }
    // ... more commands
  }
  else if (event.message.type === 'image') {
    await handleImageMessage(event, group, member);
  }
}
```

#### **handleMemberJoined (New member joins)**
```typescript
async function handleMemberJoined(event: MemberJoinEvent) {
  const groupId = event.source.groupId!;
  const newMembers = event.joined.members;

  const group = await getGroupByLineId(groupId);
  if (!group) return; // Group not registered

  // Add all new members
  for (const member of newMembers) {
    if (member.type === 'user') {
      const profile = await line.getProfile(member.userId);

      await addGroupMember({
        group_id: group.id,
        line_user_id: member.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        role: 'family'
      });
    }
  }

  // Welcome message
  await line.replyMessage(event.replyToken, {
    type: 'text',
    text: `👋 ยินดีต้อนรับสมาชิกใหม่!\n\nตอนนี้ทุกคนในกลุ่มสามารถบันทึกข้อมูลสุขภาพได้แล้วนะคะ ✨`
  });
}
```

### **Modified Webhook Handlers:**

```typescript
// Main webhook router
export async function handleWebhook(req: Request) {
  const events = req.body.events;

  for (const event of events) {
    // Detect context: group vs 1:1
    const isGroup = event.source.type === 'group';

    if (isGroup) {
      // Group context
      switch (event.type) {
        case 'join':
          await handleGroupJoin(event);
          break;
        case 'leave':
          await handleGroupLeave(event);
          break;
        case 'memberJoined':
          await handleMemberJoined(event);
          break;
        case 'memberLeft':
          await handleMemberLeft(event);
          break;
        case 'message':
          await handleGroupMessage(event);
          break;
      }
    } else {
      // 1:1 context - keep existing logic
      switch (event.type) {
        case 'follow':
          await handleFollow(event);
          break;
        case 'unfollow':
          await handleUnfollow(event);
          break;
        case 'message':
          await handle1on1Message(event);
          break;
      }
    }
  }

  return { success: true };
}
```

---

## 📋 Implementation Plan

### **Phase 1: Database & Core API (3-4 hours)**

**Files:**
- `src/services/group.service.ts` (NEW)
- `src/routes/group.routes.ts` (NEW)
- `docs/migrations/002-add-groups.sql` (NEW)

**Tasks:**
1. ✅ Create migration script
   - Add `groups` table
   - Add `group_members` table
   - Alter `activity_logs` (add group_id, actor)
   - Alter `users` (add primary_group_id)
2. ✅ Create `GroupService`
   - `registerGroup()`
   - `getGroup()`
   - `getGroupByLineId()`
   - `addMember()`
   - `removeMember()`
   - `getMembers()`
   - `getGroupActivities()`
3. ✅ Create API routes
   - POST /api/groups/register
   - GET /api/groups/:id
   - GET /api/groups/by-line-id/:lineId
   - POST /api/groups/check
   - POST /api/groups/:id/members
   - GET /api/groups/:id/members
   - GET /api/groups/:id/activities
4. ✅ Update existing services
   - `UserService` - support group registration
   - `ActivityService` - add group/actor tracking

**Deliverables:**
- Database migrated
- Group API endpoints working
- Postman tests pass

---

### **Phase 2: Registration Flow (2-3 hours)**

**Files:**
- `public/liff/group-registration.html` (NEW)
- `public/liff/js/group-form.js` (NEW)
- `public/liff/index.html` (MODIFY)

**Tasks:**
1. ✅ Create `group-registration.html`
   - Single-page form
   - Section 1: Caregiver (auto-fill from LIFF)
   - Section 2: Patient (full form)
   - Clean, modern UI
   - Loading states
   - Error handling
2. ✅ Create `group-form.js`
   - Form validation
   - LIFF integration
   - Get groupId from URL param
   - Call POST /api/groups/register
   - Redirect to group dashboard on success
3. ✅ Modify `index.html`
   - Detect group context (groupId in URL or LIFF context)
   - Route to group-registration if group
   - Keep existing logic for 1:1

**Deliverables:**
- Group registration form working
- Can register from group context
- Backward compatible with 1:1

---

### **Phase 3: Webhook & Group Logic (3-4 hours)**

**Files:**
- `src/routes/webhook.routes.ts` (MODIFY)
- `src/services/line.service.ts` (MODIFY)
- `src/handlers/group-join.handler.ts` (NEW)
- `src/handlers/group-message.handler.ts` (NEW)

**Tasks:**
1. ✅ Implement group event handlers
   - `handleGroupJoin()` - send registration link
   - `handleGroupLeave()` - cleanup
   - `handleMemberJoined()` - track new members
   - `handleMemberLeft()` - mark inactive
   - `handleGroupMessage()` - route to appropriate handler
2. ✅ Update webhook router
   - Detect group vs 1:1 context
   - Route to appropriate handlers
   - Keep backward compatibility
3. ✅ Implement health logging in groups
   - Parse messages for health keywords
   - Track actor (who logged it)
   - Reply in group with confirmation
   - Support Quick Reply
4. ✅ Implement report generation for groups
   - Daily report (in group)
   - Weekly report (DM to caregiver)
   - Support "รายงานวันนี้" command

**Deliverables:**
- Bot responds to group events
- Can log health data in group
- Actor tracking works
- Reports work in group context

---

### **Phase 4: Rich Menu & Chat Commands (2-3 hours)**

**Files:**
- `docs/rich-menu-group.json` (NEW)
- `src/handlers/quick-reply.handler.ts` (NEW)
- `src/templates/flex-messages.ts` (MODIFY)

**Tasks:**
1. ✅ Create new Rich Menu
   - Design image (2500x1686)
   - Configure areas per spec
   - Upload to LINE Console
   - Set as default
2. ✅ Implement Quick Reply for health logging
   - "บันทึกข้อมูลสุขภาพ" → show options
   - Options: ยา / ความดัน / น้ำ / เดิน / อาหาร
   - Each triggers specific form/handler
3. ✅ Implement chat commands
   - "รายงานวันนี้" → daily summary
   - "รายงานสัปดาห์นี้" → weekly summary
   - "ยากินแล้ว" → log medication
   - "วัดความดัน 120/80" → log BP
4. ✅ Create Flex Message templates
   - Daily report card
   - Weekly summary card
   - Medication reminder
   - Activity confirmation

**Deliverables:**
- Rich Menu published
- Quick Reply works
- Chat commands work
- Flex Messages look good

---

### **Phase 5: Dashboard & Settings (2-3 hours)**

**Files:**
- `public/liff/group-dashboard.html` (NEW)
- `public/liff/group-settings.html` (NEW)
- `public/liff/js/group-dashboard.js` (NEW)
- `public/liff/dashboard.html` (MODIFY - backward compatible)

**Tasks:**
1. ✅ Create `group-dashboard.html`
   - Group info card
   - Patient info card
   - Members list
   - Recent activities
   - Quick actions
2. ✅ Create `group-settings.html`
   - Edit patient info
   - Manage members (view only in MVP)
   - Notification settings
   - Leave group (admin only)
3. ✅ Modify `dashboard.html`
   - Support both old (1:1) and new (group) models
   - Detect context
   - Show appropriate view
4. ✅ Update CSS
   - Group-specific styles
   - Member cards
   - Activity timeline
   - Responsive design

**Deliverables:**
- Group dashboard working
- Settings page working
- Backward compatible
- Mobile responsive

---

### **Phase 6: Testing & Refinement (2-3 hours)**

**Tasks:**
1. ✅ Manual testing (all test cases)
2. ✅ Fix bugs found
3. ✅ Polish UI/UX
4. ✅ Update documentation
5. ✅ Write migration guide for existing users

**Deliverables:**
- All test cases pass
- No critical bugs
- Documentation updated

---

## 🧪 Testing Plan

### **Test Cases:**

#### **TC-01: Group Registration (New Group)**
```
1. Create new LINE group
2. Add Duulair bot to group
3. Bot sends registration link
4. Caregiver opens LIFF form
5. Fill caregiver + patient info
6. Submit
7. ✅ Success message
8. ✅ Group ready to use
9. ✅ Database: group, members, patient, caregiver created
```

#### **TC-02: Group Registration (Already Registered)**
```
1. Bot joins group that's already registered
2. ✅ Bot says "ยินดีต้อนรับกลับมา"
3. ✅ No registration link sent
4. ✅ Group still works
```

#### **TC-03: Health Logging in Group**
```
1. Member types "กินยาแล้ว"
2. ✅ Bot confirms "✅ บันทึกการกินยาแล้วนะคะ"
3. ✅ Database: activity logged with actor
4. ✅ Activity shows who logged it
```

#### **TC-04: Daily Report in Group**
```
1. Member types "รายงานวันนี้"
2. ✅ Bot sends Flex Message with summary
3. ✅ Shows all activities today
4. ✅ Shows who logged each activity
```

#### **TC-05: New Member Joins Group**
```
1. Add new person to group
2. ✅ Bot welcomes them
3. ✅ Database: new member added
4. ✅ New member can log activities
```

#### **TC-06: Member Leaves Group**
```
1. Member leaves group
2. ✅ Database: member marked as left
3. ✅ Past activities still show their name
```

#### **TC-07: Rich Menu - บันทึก**
```
1. Tap "📝 บันทึก" button
2. ✅ Quick Reply appears
3. ✅ Options: ยา/ความดัน/น้ำ/เดิน/อาหาร
4. Select one
5. ✅ Appropriate form/action happens
```

#### **TC-08: Rich Menu - ข้อมูลผู้ป่วย**
```
1. Tap "👤 ข้อมูลผู้ป่วย"
2. ✅ Opens LIFF dashboard
3. ✅ Shows patient info
4. ✅ Shows group members
5. ✅ Shows recent activities
```

#### **TC-09: Patient Without LINE**
```
1. Register group with patient who has no LINE
2. ✅ Registration works (user_id = NULL)
3. ✅ Other members can log for patient
4. ✅ Reports work
```

#### **TC-10: Backward Compatibility - 1:1**
```
1. User messages bot 1:1 (not in group)
2. ✅ Old flow still works
3. ✅ Doesn't break
4. ✅ Can still use dashboard
```

#### **TC-11: Group Dashboard**
```
1. Open group dashboard LIFF
2. ✅ Shows group name
3. ✅ Shows patient info
4. ✅ Lists members with roles
5. ✅ Shows recent activities
6. ✅ Quick action buttons work
```

#### **TC-12: Group Settings**
```
1. Open group settings LIFF
2. ✅ Can edit patient info
3. ✅ Can view members
4. ✅ Can adjust notification settings
5. ✅ Changes save successfully
```

---

## 🔄 Migration Strategy

### **For Existing Users (TASK-001):**

**Option A: Keep Both Flows (Recommended)**
- Old users (1:1 model) continue working
- New users use group model
- Dashboard detects and shows appropriate view
- Gradual migration over time

**Option B: Force Migration**
- Send notification to all existing users
- Provide migration tool
- Convert 1:1 relationships to groups
- Deprecate old flow after deadline

**MVP Decision: Option A (Backward Compatible)**

### **Migration Script (if needed):**

```sql
-- Convert existing 1:1 relationships to "virtual groups"
INSERT INTO groups (line_group_id, patient_id, primary_caregiver_id, is_active)
SELECT
  'virtual_' || pc.id,  -- Fake group ID
  pc.patient_id,
  pc.caregiver_id,
  true
FROM patient_caregivers pc
WHERE pc.status = 'active'
ON CONFLICT DO NOTHING;

-- Add existing users as group members
INSERT INTO group_members (group_id, line_user_id, display_name, role)
SELECT
  g.id,
  u.line_user_id,
  u.display_name,
  u.role
FROM groups g
JOIN patient_profiles p ON g.patient_id = p.id
JOIN users u ON p.user_id = u.id
WHERE g.line_group_id LIKE 'virtual_%'
ON CONFLICT DO NOTHING;
```

---

## 📊 Success Metrics

**MVP Success Criteria:**
- ✅ 5+ test groups registered successfully
- ✅ Health logging works in groups
- ✅ Reports generated correctly
- ✅ No critical bugs
- ✅ UI/UX feedback positive
- ✅ Actor tracking accurate
- ✅ Backward compatibility maintained

**Performance Targets:**
- Registration flow: < 2 minutes
- Bot response time: < 2 seconds
- Report generation: < 3 seconds
- LIFF load time: < 1 second

---

## 🚨 Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing 1:1 users | High | Maintain backward compatibility, dual flow support |
| Group context detection fails | Medium | Robust error handling, fallback to 1:1 mode |
| LINE Group API changes | Low | Follow LINE docs, use stable APIs |
| Actor attribution errors | Medium | Careful user ID tracking, logging |
| Database migration issues | High | Test migration on staging, have rollback plan |
| Too many members log same data | Medium | Deduplication logic, confirmation prompts |

---

## 📚 Documentation Updates

**Files to Update:**
- ✅ README.md - Update flow diagram
- ✅ DASHBOARD-AND-RICHMENU-UPDATE.md - Archive as TASK-001
- ✅ docs/API.md - Add group endpoints
- ✅ docs/RICH_MENU_SETUP.md - New menu config
- ✅ docs/USER_GUIDE.md - New user guide for groups

**New Documentation:**
- ✅ TASK-002-COMPLETION-SUMMARY.md
- ✅ docs/GROUP_FLOW.md - Detailed group flow guide
- ✅ docs/WEBHOOK_EVENTS.md - Webhook event reference

---

## 🎯 Out of Scope (Future Tasks)

**TASK-003 (Future):**
- Multiple patients per caregiver
- Multiple groups per caregiver
- Group admin role & permissions
- Invite additional caregivers to group
- Patient self-registration via link code
- Video call in group
- Medication photo verification

**TASK-004 (Future):**
- Voice messages for logging
- AI conversation in group
- Predictive health alerts
- Integration with wearables
- Export reports for doctors

---

## ✅ Checklist

### **Pre-Implementation:**
- [x] Spec reviewed and approved
- [ ] Database design reviewed
- [ ] API contracts agreed
- [ ] UI mockups approved (if needed)
- [ ] Timeline confirmed

### **Implementation:**
- [ ] Phase 1: Database & API
- [ ] Phase 2: Registration Flow
- [ ] Phase 3: Webhook Logic
- [ ] Phase 4: Rich Menu
- [ ] Phase 5: Dashboard
- [ ] Phase 6: Testing

### **Post-Implementation:**
- [ ] All test cases pass
- [ ] Documentation updated
- [ ] Migration plan ready
- [ ] Deployed to production
- [ ] Monitoring setup
- [ ] User feedback collected

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-05
**Status:** 📝 Specification Complete - Ready for Implementation
**Estimated Completion:** 2025-11-06

