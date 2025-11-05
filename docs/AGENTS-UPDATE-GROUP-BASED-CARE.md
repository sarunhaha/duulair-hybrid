# Agents Update: Group-Based Care Model

## Overview

Updated all 5 specialized agents to align with the **Group-Based Care Model** where **caregivers** (family members) are the primary users, not elderly patients.

**Date:** January 5, 2025
**Task:** TASK-002 Phase 4.1 Extension

---

## 🎯 Key Concept Changes

### Before (Old Model):
- **Target users:** Elderly patients themselves
- **Tone:** Elderly-friendly, simple instructions
- **Features:** Basic health logging for patients
- **Communication:** Direct to patient

### After (Group-Based Care Model):
- **Target users:** Caregivers (children, grandchildren, family members)
- **Tone:** Professional, clear, actionable
- **Features:** Comprehensive care management with LIFF pages
- **Communication:** To caregiver groups with notifications
- **Structure:** 1 Group = 1 Patient = Multiple Caregivers

---

## 📝 Agents Updated

### 1. DialogAgent (`src/agents/specialized/DialogAgent.ts`)

**Purpose:** Handle general conversations

**Changes:**
- ✅ Updated system prompt from "elderly Thai patient care system" → "Group-Based Care platform for caregivers"
- ✅ Clearly states target users are caregivers, not elderly
- ✅ Added Rich Menu features (4 LIFF pages + 2 Message commands)
- ✅ Added group features (multiple caregivers, link code, notifications)
- ✅ Updated response examples to guide users to LIFF pages
- ✅ Changed tone to professional for adult caregivers

**New Features in Prompt:**
```
✅ Rich Menu with LIFF Pages:
  - 👤 ข้อมูลผู้ป่วย (Patient Profile)
  - 💊 ยา (Medications)
  - 🔔 เตือน (Reminders)
  - ⚙️ ตั้งค่า (Settings)
✅ Quick Activity Logging (Message Commands)
✅ Group Features (multiple caregivers per patient)
✅ Notifications & Alerts to caregivers
```

**Response Examples:**
```
❌ Wrong: "ไปลงทะเบียนที่สาขา" (no physical location!)
❌ Wrong: "ดาวน์โหลดแอป" (it's LINE-based!)
✅ Correct: "กดปุ่ม '👤 ข้อมูลผู้ป่วย' ในเมนูด้านล่างเพื่อจัดการข้อมูลค่ะ"
✅ Correct: "คุณสามารถตั้งเวลาเตือนได้ที่ปุ่ม '🔔 เตือน' ค่ะ"
```

---

### 2. IntentAgent (`src/agents/specialized/IntentAgent.ts`)

**Purpose:** Classify user messages into intents

**Changes:**
- ✅ Added new LIFF page intents:
  - `view_patient_profile` - ข้อมูลผู้ป่วย
  - `view_medications` - รายการยา
  - `view_reminders` - เตือน
  - `view_settings` - ตั้งค่า
- ✅ Added group management intents:
  - `join_group` - เข้ากลุ่ม, link code
  - `registration` - สร้างกลุ่ม
- ✅ Updated patterns for caregiver-focused actions
- ✅ Added quick actions from Rich Menu
- ✅ Updated Claude prompt to understand caregiver context

**New Intent Patterns:**
```javascript
// LIFF page intents
view_patient_profile: [/ข้อมูลผู้ป่วย/, /โปรไฟล์/, /ดูข้อมูล/, /👤/],
view_medications: [/รายการยา/, /ยาทั้งหมด/, /จัดการยา/, /💊/],
view_reminders: [/เตือน/, /ตั้งเวลา/, /เวลาเตือน/, /🔔/],
view_settings: [/ตั้งค่า/, /การแจ้งเตือน/, /กลุ่ม/, /⚙️/],

// Group management
join_group: [/เข้ากลุ่ม/, /ลิงก์/, /link code/, /รหัสกลุ่ม/],
```

**Updated Claude Prompt:**
```
ACTIVITY LOGGING (caregivers log patient activities)
LIFF PAGES (caregiver wants to open feature)
GROUP MANAGEMENT (caregiver wants to join/create group)
```

---

### 3. ReportAgent (`src/agents/specialized/ReportAgent.ts`)

**Purpose:** Generate daily and weekly reports

**Changes:**
- ✅ Changed report audience from "patient" → "caregivers"
- ✅ Updated tone: professional, analytical, supportive
- ✅ Reports address caregivers (ผู้ดูแล) not patients
- ✅ Added caregiver-focused recommendations
- ✅ Enhanced Flex Message format with group branding
- ✅ Added footer with navigation to Rich Menu

**Daily Report Prompt (Before vs After):**

**Before:**
```
Generate a daily health report in Thai:
Create a friendly, encouraging summary (100 words max).
```

**After:**
```
Generate a daily care report in Thai for CAREGIVERS monitoring their loved one's health.

TARGET AUDIENCE: Family caregivers (children, grandchildren managing elderly parent/grandparent)
TONE: Professional, clear, actionable

Include:
1. Completion percentage (compare to expected daily activities)
2. Key observations (what went well, what was missed)
3. One actionable suggestion for caregivers
4. Use อ้างอิง "คุณ" for patient, "คุณ/ท่าน" for caregiver

Example format:
"คุณแม่มีการดูแลสุขภาพที่ดีวันนี้ ครบ X% ของกิจกรรมที่วางไว้ โดยเฉพาะ...
สิ่งที่ควรติดตาม...
คำแนะนำสำหรับวันพรุ่งนี้..."
```

**Weekly Report Additions:**
```
5. Encourage caregiver team collaboration

"สรุปการดูแลสุขภาพสัปดาห์นี้:
...
ขอบคุณทีมผู้ดูแลทุกท่านที่ช่วยกันบันทึกข้อมูล"
```

**Enhanced Flex Message:**
- Purple gradient header (#667eea)
- Shows completion percentage prominently
- Footer with link to Rich Menu "📊 รายงาน"
- Better formatting for caregiver groups

---

### 4. AlertAgent (`src/agents/specialized/AlertAgent.ts`)

**Purpose:** Monitor and send alerts

**Changes:**
- ✅ Implemented Group-Based Care alert routing
- ✅ Fetch caregiver group instead of individual caregivers
- ✅ Alert distribution based on level:
  - **CRITICAL:** All caregivers + LINE group
  - **URGENT:** Primary caregiver + LINE group
  - **WARNING:** LINE group only (if notifications enabled)
- ✅ Check group settings for notification preferences
- ✅ Updated alert message format for caregivers
- ✅ Added actionable recommendations by severity

**Alert Routing Logic:**

```javascript
// CRITICAL: Send to ALL caregivers immediately
if (level >= CRITICAL) {
  // Send to all group members
  for (const caregiver of caregivers) {
    sendMessage(caregiver.line_user_id, alert);
  }
  // Also send to LINE group
  if (group.line_group_id) {
    sendMessage(group.line_group_id, alert);
  }
}

// URGENT: Send to primary + group
else if (level >= URGENT) {
  const primary = caregivers.find(c => c.role === 'primary');
  sendMessage(primary.line_user_id, alert);
  sendMessage(group.line_group_id, alert);
}

// WARNING: Send to group only (if enabled)
else if (level >= WARNING) {
  if (settings.emergency_notifications && group.line_group_id) {
    sendMessage(group.line_group_id, alert);
  }
}
```

**Alert Message Format (Before vs After):**

**Before:**
```
🆘 แจ้งเตือน คุณยาย

ฉุกเฉิน

เวลา: 14:30
ระดับ: ฉุกเฉิน

กรุณาตรวจสอบด่วน
```

**After:**
```
🆘 แจ้งเตือนผู้ดูแล กลุ่มคุณยาย

📍 ผู้ป่วย: คุณยาย
🕐 เวลา: 14:30 น.
⚠️ ระดับ: ฉุกเฉิน

📝 รายละเอียด:
ฉุกเฉิน

🚨 โปรดตรวจสอบทันที หรือติดต่อแพทย์/โรงพยาบาล

📊 ดูรายละเอียดเพิ่มเติมได้ที่เมนู "👤 ข้อมูลผู้ป่วย"
```

**Actionable Recommendations by Level:**
- CRITICAL: 🚨 โปรดตรวจสอบทันที หรือติดต่อแพทย์/โรงพยาบาล
- URGENT: ⚡ โปรดตรวจสอบโดยเร็วที่สุด
- WARNING: 💡 โปรดติดตามอาการต่อไป

---

### 5. HealthAgent (`src/agents/specialized/HealthAgent.ts`)

**Purpose:** Process and log health data

**Changes:**
- ✅ Already supports group context (TASK-002)
- ✅ Logs actor info (which caregiver logged the activity)
- ✅ Supports group_id and source tracking
- ⚠️ No major prompt changes needed (already correct)

**Existing Group Support:**
```javascript
// Already supports Group-Based Care Model
if (message.context.source === 'group') {
  logData.group_id = message.context.groupId || null;
  logData.actor_line_user_id = message.context.actorLineUserId;
  logData.actor_display_name = message.context.actorDisplayName;
  logData.source = 'group';
} else {
  logData.source = '1:1';
}
```

---

## 🎨 Tone & Language Changes

### Old Tone (Elderly-Friendly):
```
"สวัสดีค่ะ 😊"
"เข้าใจค่ะ กดที่นี่เลยนะคะ"
"ดูแลสุขภาพให้ดีด้วยนะคะ"
```

### New Tone (Caregiver Professional):
```
"สวัสดีครับ/ค่ะ"
"คุณสามารถเข้าถึงฟีเจอร์นี้ได้ที่..."
"แนะนำให้ติดตามอาการต่อไป"
```

---

## 📊 Feature Mapping

| Feature | Old Model | New Model (Group-Based) |
|---------|-----------|-------------------------|
| **Primary User** | Elderly patient | Caregiver (family) |
| **Interface** | Simple messages | Rich Menu + LIFF pages |
| **Data Management** | Limited logging | Full CRUD via LIFF |
| **Reports** | To patient | To caregiver group |
| **Alerts** | To caregiver list | To group with routing |
| **Collaboration** | N/A | Multiple caregivers per patient |
| **Notifications** | Basic | Group settings with preferences |

---

## 🧪 Testing Checklist

### DialogAgent:
- [ ] Ask "ข้อมูลผู้ป่วย" → Should direct to Rich Menu "👤 ข้อมูลผู้ป่วย"
- [ ] Ask "รายการยา" → Should direct to Rich Menu "💊 ยา"
- [ ] Ask "ตั้งเวลาเตือน" → Should direct to Rich Menu "🔔 เตือน"
- [ ] Ask "ลงทะเบียน" → Should explain group registration
- [ ] Tone should be professional for adults

### IntentAgent:
- [ ] "ข้อมูลผู้ป่วย" → `view_patient_profile`
- [ ] "จัดการยา" → `view_medications`
- [ ] "ตั้งเวลาเตือน" → `view_reminders`
- [ ] "ตั้งค่ากลุ่ม" → `view_settings`
- [ ] "เข้ากลุ่ม" → `join_group`
- [ ] "บันทึกยา" → `medication`

### ReportAgent:
- [ ] Daily report addresses caregivers
- [ ] Uses professional tone
- [ ] Includes actionable suggestions
- [ ] Flex message has purple theme
- [ ] Footer links to Rich Menu

### AlertAgent:
- [ ] CRITICAL alert sends to all caregivers + group
- [ ] URGENT alert sends to primary + group
- [ ] WARNING alert respects group settings
- [ ] Alert message formatted for caregivers
- [ ] Includes actionable recommendations
- [ ] Shows patient name and group name

### HealthAgent:
- [ ] Already correct - logs actor info
- [ ] Supports group context
- [ ] No changes needed

---

## 🚀 Deployment Steps

1. **Restart backend server:**
   ```bash
   npm run dev
   ```

2. **Test in LINE:**
   - Send test messages to check intent classification
   - Request reports to see new format
   - Trigger alerts to test routing
   - Try asking about features

3. **Monitor logs:**
   ```bash
   tail -f /tmp/backend.log
   ```

4. **Verify changes:**
   - Check agent responses are caregiver-focused
   - Verify alerts route to correct recipients
   - Test LIFF page references work

---

## 📈 Impact Summary

**Before:**
- ❌ Confused target audience (elderly vs caregiver)
- ❌ No LIFF page support in prompts
- ❌ Individual caregiver alerts (no group)
- ❌ Patient-focused reports

**After:**
- ✅ Clear target: Caregivers (family members)
- ✅ All LIFF pages integrated in responses
- ✅ Group-based alert routing with settings
- ✅ Caregiver-focused reports with team collaboration
- ✅ Professional tone throughout
- ✅ Aligned with Phase 4.1 Rich Menu

---

## 📝 Files Modified

1. `src/agents/specialized/DialogAgent.ts` - Updated system prompt (50 lines)
2. `src/agents/specialized/IntentAgent.ts` - Added LIFF intents (40 lines)
3. `src/agents/specialized/ReportAgent.ts` - Caregiver-focused reports (80 lines)
4. `src/agents/specialized/AlertAgent.ts` - Group-based routing (60 lines)
5. `src/agents/specialized/HealthAgent.ts` - No changes (already correct)

**Total changes:** ~230 lines across 4 files

---

**Created:** January 5, 2025
**Author:** Claude Code (Sonnet 4.5)
**Status:** ✅ Complete
