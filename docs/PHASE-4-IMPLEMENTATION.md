# Phase 4 Implementation: Rich Menu & Chat Commands (TASK-002)

## Overview

Phase 4 implements the Rich Menu interface and chat command handlers for both group and 1:1 contexts, making the bot more user-friendly and accessible.

## ✅ Completed Features

### 1. Command Handler Service
**File:** `src/services/command-handler.service.ts` (350+ lines)

Comprehensive service for handling chat commands and rich menu interactions:

#### Command Detection:
- Detects emoji-based commands from Rich Menu
- Detects slash commands (`/help`, `/settings`, etc.)
- Returns appropriate responses based on context

#### Implemented Commands:

**📝 บันทึกกิจกรรม** - Log Activity
- Shows Quick Reply menu with 5 common activities:
  - 💊 กินยา (Medication)
  - 🩺 วัดความดัน (Blood Pressure)
  - 💧 ดื่มน้ำ (Water intake)
  - 🍚 ทานอาหาร (Meals)
  - 🚶 เดิน/ออกกำลังกาย (Exercise)

**📊 ดูรายงาน** - View Report
- Shows Quick Reply menu with report options:
  - 📅 รายงานวันนี้ (Today's report)
  - 📆 รายงานสัปดาห์นี้ (This week)
  - 📈 สรุปกิจกรรม (Activity summary)

**⚙️ ตั้งค่า** - Settings
- Context-aware settings display
- Group settings vs Personal settings
- Shows current configuration
- Instructions to change settings

**❓ วิธีใช้งาน** - Help
- Context-aware help text
- Different instructions for group vs 1:1
- Examples of common commands
- Tips and tricks

**📞 ติดต่อฉุกเฉิน** - Emergency Contact
- Shows emergency hotlines (1669, 1646, 191)
- Patient-specific emergency contacts (if registered)
- Quick access to critical information

**/start** - Start/Welcome
- Welcome message
- Quick overview of bot features
- Getting started instructions

### 2. Rich Menu Configuration
**File:** `docs/rich-menu-group.json`

JSON configuration for LINE Rich Menu:
- **Size:** 2500 × 1686 pixels
- **Layout:** 2 rows × 3 columns (6 buttons)
- **Chat bar text:** "เมนู"

**Button Layout:**
```
┌──────────────┬──────────────┬──────────────┐
│ 📝 บันทึก    │ 🏠 แดชบอร์ด  │ 📊 รายงาน    │
│ กิจกรรม      │              │              │
├──────────────┼──────────────┼──────────────┤
│ ⚙️ ตั้งค่า   │ ❓ วิธีใช้    │ 📞 ฉุกเฉิน   │
│              │              │              │
└──────────────┴──────────────┴──────────────┘
```

**Actions:**
1. บันทึกกิจกรรม → Message command
2. แดชบอร์ด → LIFF URL
3. รายงาน → Message command
4. ตั้งค่า → Message command
5. วิธีใช้งาน → Message command
6. ฉุกเฉิน → Message command

### 3. Rich Menu Setup Guide
**File:** `docs/RICH-MENU-SETUP.md`

Complete guide for creating and deploying Rich Menu:
- Design specifications
- Image requirements
- Button coordinates
- Setup instructions (GUI and API)
- Management commands
- Troubleshooting
- Best practices

### 4. Integrated Command Handler
**File:** `src/index.ts` (modified)

Added command detection before orchestrator:

```typescript
// Check if message is a command
if (commandHandlerService.isCommand(message.text)) {
  const commandResponse = await commandHandlerService.handleCommand(
    message.text,
    context
  );

  if (commandResponse) {
    await lineClient.replyMessage(replyToken, commandResponse);
    return { success: true, commandHandled: true };
  }
}

// Otherwise, process with orchestrator
const result = await orchestrator.process({...});
```

### 5. Quick Reply Menus

#### Activity Logging Menu:
```json
{
  "items": [
    { "label": "💊 กินยา", "text": "กินยาแล้ว" },
    { "label": "🩺 วัดความดัน", "text": "วัดความดัน" },
    { "label": "💧 ดื่มน้ำ", "text": "ดื่มน้ำ 250 มล." },
    { "label": "🍚 ทานอาหาร", "text": "ทานอาหารแล้ว" },
    { "label": "🚶 เดิน/ออกกำลังกาย", "text": "เดิน 30 นาที" }
  ]
}
```

#### Report Menu:
```json
{
  "items": [
    { "label": "📅 รายงานวันนี้", "text": "ดูรายงานวันนี้" },
    { "label": "📆 รายงานสัปดาห์นี้", "text": "ดูรายงานสัปดาห์นี้" },
    { "label": "📈 สรุปกิจกรรม", "text": "ดูสรุปกิจกรรม" }
  ]
}
```

### 6. Context-Aware Responses

All commands provide different responses based on context:

**Example: Help Command**

**In Group:**
```
❓ วิธีใช้งาน Duulair (กลุ่ม)

📝 บันทึกกิจกรรม
ส่งข้อความในกลุ่มเพื่อบันทึก:
• "กินยาแล้ว" - บันทึกการกินยา
• "วัดความดัน 120/80" - บันทึกความดัน
• "ดื่มน้ำ 250 มล." - บันทึกการดื่มน้ำ

👥 สมาชิกในกลุ่ม
ทุกคนในกลุ่มสามารถ:
• บันทึกกิจกรรม
• ดูรายงาน
• ตรวจสอบสุขภาพ

💡 เคล็ดลับ
ระบบจะจดจำว่าใครเป็นคนบันทึก
เพื่อติดตามการมีส่วนร่วมของสมาชิก
```

**In 1:1 Chat:**
```
❓ วิธีใช้งาน Duulair

📝 บันทึกกิจกรรม
ส่งข้อความเพื่อบันทึก:
• "กินยาแล้ว"
• "วัดความดัน 120/80"
• "ดื่มน้ำ 250 มล."

📊 ดูรายงาน
• รายงานวันนี้
• รายงานสัปดาห์นี้

⚙️ ตั้งค่า
• เวลาเตือนกินยา
• เตือนดื่มน้ำ
• รายงานอัตโนมัติ
```

## 📁 Files Created/Modified

### Created:
1. `src/services/command-handler.service.ts` (350 lines)
2. `docs/rich-menu-group.json` (Rich Menu config)
3. `docs/RICH-MENU-SETUP.md` (Complete setup guide)
4. `docs/PHASE-4-IMPLEMENTATION.md` (this file)

### Modified:
1. `src/index.ts`
   - Added commandHandlerService import
   - Added command detection before orchestrator
   - Returns early if command handled

**Total:** ~400+ lines of code

## 🎯 Command Flow

### User Taps Rich Menu Button
```
User taps "📝 บันทึกกิจกรรม"
    ↓
LINE sends message "📝 บันทึกกิจกรรม"
    ↓
Webhook receives message event
    ↓
commandHandlerService.isCommand() → true
    ↓
commandHandlerService.handleCommand()
    ↓
Returns Quick Reply menu
    ↓
Bot replies with activity options
    ↓
User taps "💊 กินยา"
    ↓
LINE sends "กินยาแล้ว"
    ↓
Passes to Orchestrator (not a command)
    ↓
HealthAgent logs medication
    ↓
Bot replies "✅ บันทึกการกินยาเรียบร้อยแล้ว"
```

### User Types Slash Command
```
User types "/help"
    ↓
commandHandlerService.isCommand() → true
    ↓
handleHelp(context)
    ↓
Returns context-aware help text
    ↓
Bot replies with instructions
```

## 🧪 Testing Checklist

### Prerequisites:
- [ ] Rich Menu created and uploaded
- [ ] Rich Menu set as default
- [ ] Command handler service working
- [ ] Both group and 1:1 contexts available

### Test Cases:

#### TC1: Rich Menu Displays
1. Open chat with bot (group or 1:1)
2. Tap menu icon (≡) at bottom
3. Expected: Rich menu shows with 6 buttons

#### TC2: Log Activity Command
1. Tap "📝 บันทึกกิจกรรม" button
2. Expected: Quick Reply menu with 5 activity options
3. Tap "💊 กินยา"
4. Expected: Message "กินยาแล้ว" sent and logged

#### TC3: Dashboard Button (LIFF)
1. Tap "🏠 แดชบอร์ด" button
2. Expected: LIFF opens group-dashboard.html
3. Verify: Group data loads correctly

#### TC4: View Report Command
1. Tap "📊 รายงาน" button
2. Expected: Quick Reply with report options
3. Tap "📅 รายงานวันนี้"
4. Expected: Today's report shown

#### TC5: Settings Command
1. Tap "⚙️ ตั้งค่า" button
2. Expected:
   - In group: Group settings displayed
   - In 1:1: Personal settings displayed

#### TC6: Help Command
1. Tap "❓ วิธีใช้งาน" button
2. Expected:
   - In group: Group-specific instructions
   - In 1:1: Personal-specific instructions

#### TC7: Emergency Command
1. Tap "📞 ฉุกเฉิน" button
2. Expected: Emergency contacts displayed
3. Verify: Shows 1669, 1646, 191

#### TC8: Slash Commands
1. Type "/help"
2. Expected: Same as help button
3. Type "/settings"
4. Expected: Same as settings button

#### TC9: Non-Command Messages
1. Type "กินยาแล้ว" (not from Rich Menu)
2. Expected: Passes to Orchestrator
3. Expected: HealthAgent processes and logs

#### TC10: Command in Group vs 1:1
1. Send same command in group and 1:1
2. Expected: Different responses based on context
3. Verify: Actor tracked in group, not in 1:1

## 📊 Command Usage Analytics

Track which commands are most used:

```sql
-- Command usage by type
SELECT
  SUBSTRING(message_text FROM 1 FOR 20) as command,
  COUNT(*) as usage_count,
  COUNT(DISTINCT user_id) as unique_users
FROM message_logs
WHERE message_text LIKE '📝%'
   OR message_text LIKE '📊%'
   OR message_text LIKE '⚙️%'
   OR message_text LIKE '❓%'
   OR message_text LIKE '/%'
GROUP BY SUBSTRING(message_text FROM 1 FOR 20)
ORDER BY usage_count DESC;
```

## 🎨 Rich Menu Design

### Current Design Priorities:
1. **Most Used:** บันทึกกิจกรรม (Top-Left)
2. **Quick Access:** แดชบอร์ด (Top-Center)
3. **Reports:** รายงาน (Top-Right)
4. **Settings:** ตั้งค่า (Bottom-Left)
5. **Help:** วิธีใช้งาน (Bottom-Center)
6. **Emergency:** ฉุกเฉิน (Bottom-Right)

### Design Guidelines:
- ✅ Large icons (80-100px)
- ✅ High contrast colors
- ✅ Clear, short labels (1-3 words)
- ✅ Elderly-friendly typography
- ✅ Consistent with brand colors

### Color Scheme:
- Primary: #4CAF50 (Green)
- Text: #212121 (Dark gray)
- Background: #FFFFFF (White)
- Accent: #388E3C (Dark green)

## 🚀 Deployment

### Step 1: Create Rich Menu Image
Use provided template:
- Size: 2500 × 1686 pixels
- Format: PNG
- Follow design guidelines

### Step 2: Upload via LINE Manager
1. Go to LINE Official Account Manager
2. Upload image
3. Configure buttons using `rich-menu-group.json`
4. Set as default

### Step 3: Verify Integration
1. Test all buttons
2. Verify commands trigger correctly
3. Check Quick Replies work
4. Test in both group and 1:1

### Step 4: Monitor Usage
1. Check webhook logs
2. Track command usage
3. Gather user feedback
4. Iterate on design

## 🐛 Known Issues / Limitations

1. **Image Required:**
   - Must create and upload actual Rich Menu image
   - JSON config provided, but image design needed

2. **Context Detection:**
   - Relies on message text matching
   - May need fuzzy matching for typos

3. **Quick Reply Limitations:**
   - Max 13 items per Quick Reply
   - Text-only (no custom icons)

4. **Rich Menu Update:**
   - Requires manual update via LINE Manager
   - Changes not instant for all users

## 📋 Next Steps (Phase 5)

Phase 5 will implement:
1. Dashboard enhancements
2. Settings management UI
3. Report generation and visualization
4. Notification settings
5. Member management (for groups)

## 🎉 Phase 4 Complete!

All Phase 4 deliverables have been implemented:

✅ Command handler service with 6 commands
✅ Rich Menu JSON configuration
✅ Quick Reply menus for activities and reports
✅ Context-aware responses (group vs 1:1)
✅ Help and instructions system
✅ Emergency contact quick access
✅ Slash command support
✅ Rich Menu setup guide

**Total Implementation Time:** ~1.5 hours
**Files Created:** 4
**Files Modified:** 1
**Lines of Code:** ~400+ lines

**Phases Completed:** 4/6 (67% ✅)

Ready to proceed to Phase 5: Dashboard & Settings!
