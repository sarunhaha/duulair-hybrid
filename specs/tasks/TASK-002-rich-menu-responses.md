# TASK-002: Rich Menu Responses

**Priority:** 🟡 High
**Status:** 📋 Ready to Start
**Owner:** Backend Developer / IntentAgent Specialist
**Estimated Time:** 1-2 hours
**Dependencies:** None

---

## 📝 Overview

เพิ่ม intent patterns และ responses สำหรับ Rich Menu buttons ทั้งหมด:
- 📊 บันทึกสุขภาพ
- 📈 ดูรายงาน
- 🤖 คุยกับ AI (✅ ทำแล้ว)
- 📝 ลงทะเบียน (✅ ทำแล้ว)
- 📦 แพ็กเกจ
- ❓ ช่วยเหลือ

---

## 🎯 User Stories

### Story 1: บันทึกสุขภาพ
**As a** ผู้ใช้งาน
**I want** กด "บันทึกสุขภาพ" แล้วเห็นเมนูเลือกประเภท
**So that** เลือกบันทึกสุขภาพได้ง่าย

**Acceptance Criteria:**
- ✅ กด "บันทึกสุขภาพ" แล้วเห็น Quick Reply
- ✅ ตัวเลือก: 💊 ยา, 🩺 ความดัน, 💧 น้ำ, 🚶 ออกกำลังกาย, 🍚 อาหาร
- ✅ กดแล้วไป intent ที่ถูกต้อง

### Story 2: ดูรายงาน
**As a** ผู้ใช้งาน
**I want** กด "ดูรายงาน" แล้วเห็นตัวเลือกรายงาน
**So that** เลือกดูรายงานที่ต้องการ

**Acceptance Criteria:**
- ✅ กด "ดูรายงาน" แล้วเห็น Quick Reply
- ✅ ตัวเลือก: 📅 วันนี้, 📊 สัปดาห์นี้, 📈 เดือนนี้
- ✅ กดแล้วไป ReportAgent

### Story 3: แพ็กเกจ
**As a** ผู้ใช้งาน
**I want** กด "แพ็กเกจ" แล้วเห็นข้อมูลแพ็กเกจบริการ
**So that** ทราบว่ามีบริการอะไรบ้าง

### Story 4: ช่วยเหลือ
**As a** ผู้ใช้งาน
**I want** กด "ช่วยเหลือ" แล้วเห็น FAQ/วิธีใช้งาน
**So that** ใช้งานระบบได้

---

## 🛠 Technical Implementation

### 1. เพิ่ม Intent Patterns

**File:** `src/agents/specialized/IntentAgent.ts`

```typescript
private patterns = {
  // ... existing patterns ...
  health_menu: [/บันทึกสุขภาพ/, /บันทึก/, /เพิ่มข้อมูล/],
  view_report: [/ดูรายงาน/, /รายงาน/, /สรุป/],
  package: [/แพ็กเกจ/, /บริการ/, /ราคา/, /package/],
  help: [/ช่วยเหลือ/, /help/, /วิธีใช้/, /คำถาม/, /faq/]
};
```

### 2. เพิ่ม Routing

**File:** `src/agents/core/OrchestratorAgent.ts`

```typescript
case 'health_menu':
  plan.agents = ['dialog'];
  plan.requiresQuickReply = true;
  plan.quickReplyType = 'health_menu';
  break;

case 'view_report':
  plan.agents = ['dialog'];
  plan.requiresQuickReply = true;
  plan.quickReplyType = 'view_report';
  break;

case 'package':
  plan.agents = ['dialog'];
  plan.requiresFlexMessage = true;
  plan.flexMessageType = 'package';
  break;

case 'help':
  plan.agents = ['dialog'];
  plan.requiresFlexMessage = true;
  plan.flexMessageType = 'help';
  break;
```

### 3. สร้าง Quick Reply Messages

**File:** `src/index.ts` (add helper functions)

```typescript
// Quick Reply for Health Menu
function createHealthMenuQuickReply(): QuickReply {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '💊 ยา',
          text: 'บันทึกยา'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '🩺 ความดัน',
          text: 'วัดความดัน'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '💧 น้ำ',
          text: 'ดื่มน้ำ'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '🚶 ออกกำลังกาย',
          text: 'ออกกำลังกาย'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '🍚 อาหาร',
          text: 'บันทึกอาหาร'
        }
      }
    ]
  };
}

// Quick Reply for View Report
function createViewReportQuickReply(): QuickReply {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📅 รายงานวันนี้',
          text: 'รายงานวันนี้'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📊 รายงานสัปดาห์',
          text: 'รายงานสัปดาห์นี้'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📈 รายงานเดือน',
          text: 'รายงานเดือนนี้'
        }
      }
    ]
  };
}
```

### 4. สร้าง Flex Messages

```typescript
// Flex Message for Package Info
function createPackageFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'แพ็กเกจบริการ Duulair',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'แพ็กเกจบริการ',
            weight: 'bold',
            size: 'xl',
            color: '#4CAF50'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✨ Free Plan (ฟรี)',
            weight: 'bold',
            size: 'lg',
            color: '#4CAF50'
          },
          {
            type: 'text',
            text: '• บันทึกข้อมูลสุขภาพ\n• รายงานประจำวัน\n• เชื่อมต่อผู้ดูแล 1 คน',
            wrap: true,
            size: 'sm',
            color: '#666666',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '🌟 Premium Plan (เร็วๆ นี้)',
            weight: 'bold',
            size: 'lg',
            color: '#FF9800',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '• ทุกอย่างใน Free\n• แจ้งเตือนอัจฉริยะ\n• วิเคราะห์ข้อมูลขั้นสูง\n• เชื่อมต่อผู้ดูแลไม่จำกัด',
            wrap: true,
            size: 'sm',
            color: '#666666',
            margin: 'md'
          }
        ]
      }
    }
  };
}

// Flex Message for Help/FAQ
function createHelpFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'ช่วยเหลือ - วิธีใช้งาน',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'วิธีใช้งาน Duulair',
            weight: 'bold',
            size: 'xl',
            color: '#4CAF50'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📝 การเริ่มต้น',
            weight: 'bold',
            size: 'md'
          },
          {
            type: 'text',
            text: '1. ลงทะเบียน (ผู้ป่วย/ผู้ดูแล)\n2. กรอกข้อมูลสุขภาพ\n3. เริ่มบันทึกข้อมูล',
            wrap: true,
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '💊 การบันทึกข้อมูล',
            weight: 'bold',
            size: 'md',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '• พิมพ์ "กินยาแล้ว"\n• พิมพ์ "วัดความดัน 120/80"\n• พิมพ์ "ดื่มน้ำ 500 ml"\n• พิมพ์ "เดินแล้ว 30 นาที"',
            wrap: true,
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '🆘 กรณีฉุกเฉิน',
            weight: 'bold',
            size: 'md',
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'พิมพ์ "ฉุกเฉิน" ระบบจะแจ้งผู้ดูแลทันที',
            wrap: true,
            size: 'sm',
            color: '#F44336',
            margin: 'sm'
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
              type: 'message',
              label: 'เริ่มลงทะเบียน',
              text: 'ลงทะเบียน'
            },
            style: 'primary',
            color: '#4CAF50'
          }
        ]
      }
    }
  };
}
```

### 5. แก้ handleTextMessage

**File:** `src/index.ts`

```typescript
// Check if needs Quick Reply
const quickReplyType = result.metadata?.quickReplyType;
if (quickReplyType) {
  let quickReply;
  if (quickReplyType === 'health_menu') {
    quickReply = createHealthMenuQuickReply();
  } else if (quickReplyType === 'view_report') {
    quickReply = createViewReportQuickReply();
  }

  const message: TextMessage = {
    type: 'text',
    text: result.data?.combined?.response || 'เลือกรายการ:',
    quickReply
  };

  await lineClient.replyMessage(replyToken, message);
  return;
}

// Check if needs Flex Message
if (intent === 'package') {
  await lineClient.replyMessage(replyToken, createPackageFlexMessage());
  return;
}

if (intent === 'help') {
  await lineClient.replyMessage(replyToken, createHelpFlexMessage());
  return;
}
```

---

## 📂 Files to Modify

1. `src/agents/specialized/IntentAgent.ts` - เพิ่ม patterns
2. `src/agents/core/OrchestratorAgent.ts` - เพิ่ม routing
3. `src/index.ts` - เพิ่ม Quick Reply และ Flex Message functions
4. `src/index.ts` - แก้ handleTextMessage

---

## ✅ Testing Checklist

### Rich Menu: บันทึกสุขภาพ
- [ ] กดแล้วเห็น Quick Reply 5 ตัวเลือก
- [ ] กด "💊 ยา" → intent: medication
- [ ] กด "🩺 ความดัน" → intent: vitals
- [ ] กด "💧 น้ำ" → intent: water
- [ ] กด "🚶 ออกกำลังกาย" → intent: walk
- [ ] กด "🍚 อาหาร" → intent: food

### Rich Menu: ดูรายงาน
- [ ] กดแล้วเห็น Quick Reply 3 ตัวเลือก
- [ ] กด "📅 วันนี้" → ReportAgent (daily)
- [ ] กด "📊 สัปดาห์" → ReportAgent (weekly)
- [ ] กด "📈 เดือน" → ReportAgent (monthly)

### Rich Menu: แพ็กเกจ
- [ ] กดแล้วเห็น Flex Message
- [ ] แสดงข้อมูล Free Plan
- [ ] แสดงข้อมูล Premium Plan

### Rich Menu: ช่วยเหลือ
- [ ] กดแล้วเห็น Flex Message
- [ ] แสดงวิธีใช้งาน
- [ ] แสดง FAQ
- [ ] มีปุ่ม "เริ่มลงทะเบียน"

---

## 🚀 Deployment

```bash
# Build
npm run build

# Commit
git add .
git commit -m "Add Rich Menu responses (health_menu, view_report, package, help)"

# Push
git push origin master

# Vercel auto-deploys
```

---

## 📊 Success Metrics

- ✅ ทุก Rich Menu button มี response
- ✅ Quick Reply แสดงผลถูกต้อง
- ✅ Flex Message แสดงผลสวย
- ✅ User engagement เพิ่มขึ้น 30%

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
