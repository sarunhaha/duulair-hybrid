# OONJ.AI Rich Menu Implementation Guide

## 🎯 Overview

Rich Menu สำหรับ OONJ.AI ประกอบด้วย 4 เมนูหลัก ออกแบบให้เรียบง่าย เหมาะกับผู้สูงอายุ

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  👤 ข้อมูลของคุณ    📊 รายงานสุขภาพ    🔔 แจ้งเตือน    ⚙️ ตั้งค่า  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 Menu Structure

### 1. 👤 ข้อมูลของคุณ (Your Information)

**Purpose:** ดูและแก้ไขข้อมูลส่วนตัว, ข้อมูลสุขภาพพื้นฐาน, รายการยา

**Action Type:** `uri` → LIFF Page

**LIFF URL:** `https://liff.line.me/{LIFF_ID}/profile`

#### Sub-sections:

```
👤 ข้อมูลของคุณ
├── 📝 ข้อมูลส่วนตัว
│   ├── ชื่อ-นามสกุล
│   ├── ชื่อเล่น
│   ├── วันเกิด / อายุ
│   ├── เพศ
│   ├── น้ำหนัก / ส่วนสูง
│   └── กรุ๊ปเลือด
│
├── 🏥 ข้อมูลทางการแพทย์
│   ├── โรคประจำตัว
│   ├── แพ้ยา
│   ├── แพ้อาหาร
│   └── หมายเหตุทางการแพทย์
│
├── 💊 รายการยาประจำ
│   ├── ดูรายการยาทั้งหมด
│   ├── เพิ่มยาใหม่
│   ├── แก้ไขยา
│   └── ลบยา
│
├── 🏨 ข้อมูลโรงพยาบาล/หมอ
│   ├── ชื่อโรงพยาบาล
│   ├── ที่อยู่ / เบอร์โทร
│   ├── ชื่อหมอประจำตัว
│   └── เบอร์หมอ
│
└── 📞 ผู้ติดต่อฉุกเฉิน
    ├── ชื่อ
    ├── ความสัมพันธ์
    └── เบอร์โทร
```

#### Database Tables Used:
- `patient_profiles`
- `medications` / `patient_medications`
- `allergies`
- `emergency_contacts`

#### API Endpoints:
```
GET    /api/patient/[patientId]/profile
PUT    /api/patient/[patientId]/profile
GET    /api/patient/[patientId]/medications
POST   /api/patient/[patientId]/medications
PUT    /api/patient/[patientId]/medications/[medicationId]
DELETE /api/patient/[patientId]/medications/[medicationId]
GET    /api/patient/[patientId]/allergies
POST   /api/patient/[patientId]/allergies
GET    /api/patient/[patientId]/emergency-contacts
PUT    /api/patient/[patientId]/emergency-contacts
```

---

### 2. 📊 รายงานสุขภาพ (Health Reports)

**Purpose:** ดูสรุปข้อมูลสุขภาพ รายวัน/สัปดาห์/เดือน พร้อมกราฟ

**Action Type:** `message` → ส่ง Flex Message ให้เลือกประเภทรายงาน

**Trigger Message:** `#รายงาน` หรือ `ดูรายงาน`

#### Flex Message Options:

```
📊 เลือกประเภทรายงาน
├── 📅 รายงานวันนี้
│   └── Action: message → "#รายงานวันนี้"
│
├── 📈 รายงานสัปดาห์
│   └── Action: message → "#รายงานสัปดาห์"
│
├── 📊 รายงานเดือน
│   └── Action: message → "#รายงานเดือน"
│
└── 📉 รายงานพร้อมกราฟ
    └── Action: uri → LIFF "/reports"
```

#### Report Contents:

**รายงานวันนี้:**
- สรุปกิจกรรมวันนี้
- ค่าความดัน/ชีพจรล่าสุด
- สถานะการทานยา
- ปริมาณน้ำที่ดื่ม
- อาการที่แจ้ง (ถ้ามี)
- อารมณ์/ความรู้สึก

**รายงานสัปดาห์:**
- สรุป 7 วันย้อนหลัง
- ค่าเฉลี่ยความดัน/ชีพจร
- % การทานยาตรงเวลา
- แนวโน้มสุขภาพ
- อาการที่เกิดซ้ำ

**รายงานเดือน:**
- สรุป 30 วันย้อนหลัง
- สถิติภาพรวม
- AI insights
- คำแนะนำจากระบบ

**รายงานพร้อมกราฟ (LIFF):**
- กราฟความดันโลหิต
- กราฟชีพจร
- กราฟน้ำหนัก
- ปฏิทินการทานยา
- Export PDF/CSV

#### Database Tables Used:
- `vitals_logs`
- `medication_logs`
- `mood_logs`
- `sleep_logs`
- `symptoms`
- `water_intake_logs`
- `exercise_logs`
- `daily_patient_summaries`
- `health_events`

#### API Endpoints:
```
GET /api/reports/[patientId]/daily?date=YYYY-MM-DD
GET /api/reports/[patientId]/weekly?startDate=YYYY-MM-DD
GET /api/reports/[patientId]/monthly?month=YYYY-MM
GET /api/reports/[patientId]/vitals?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/reports/[patientId]/export?format=pdf|csv&from=&to=
```

---

### 3. 🔔 แจ้งเตือน (Reminders)

**Purpose:** จัดการการแจ้งเตือนทั้งหมด (ยา, น้ำ, ออกกำลังกาย, รายงาน)

**Action Type:** `uri` → LIFF Page

**LIFF URL:** `https://liff.line.me/{LIFF_ID}/reminders`

#### Sub-sections:

```
🔔 แจ้งเตือน
├── 💊 เตือนทานยา
│   ├── เปิด/ปิด การแจ้งเตือน
│   ├── รายการยาและเวลา
│   │   ├── ยา A - 08:00, 20:00
│   │   ├── ยา B - 12:00
│   │   └── + เพิ่มยา
│   └── ตั้งค่าการเตือนล่วงหน้า (5/10/15 นาที)
│
├── 💧 เตือนดื่มน้ำ
│   ├── เปิด/ปิด การแจ้งเตือน
│   ├── เป้าหมายต่อวัน (ml)
│   ├── เตือนทุกกี่ชั่วโมง
│   ├── ช่วงเวลาเริ่ม (เช่น 07:00)
│   └── ช่วงเวลาสิ้นสุด (เช่น 21:00)
│
├── 🏃 เตือนออกกำลังกาย
│   ├── เปิด/ปิด การแจ้งเตือน
│   ├── เวลาที่ต้องการให้เตือน
│   └── วันที่ต้องการ (จ-อา)
│
├── 📊 ส่งรายงานประจำวัน
│   ├── เปิด/ปิด
│   └── เวลาส่ง (เช่น 20:00)
│
└── 🚨 แจ้งเตือนฉุกเฉิน
    ├── แจ้งเตือนถ้าไม่มี activity นานเกิน X ชม.
    └── แจ้งไปยัง caregiver
```

#### UI Components:

```typescript
// Reminder Card Component
interface ReminderCard {
  type: 'medication' | 'water' | 'exercise' | 'report' | 'emergency';
  enabled: boolean;
  settings: {
    // medication
    medications?: {
      id: string;
      name: string;
      times: string[]; // ["08:00", "20:00"]
      days: string[];  // ["mon", "tue", ...]
    }[];
    
    // water
    goalMl?: number;
    intervalHours?: number;
    startTime?: string;
    endTime?: string;
    
    // exercise
    reminderTime?: string;
    daysOfWeek?: string[];
    
    // report
    reportTime?: string;
    
    // emergency
    noActivityThresholdHours?: number;
    notifyCaregiver?: boolean;
  };
}
```

#### Database Tables Used:
- `reminders`
- `notification_settings`
- `medications`
- `water_intake_goals`
- `health_goals`

#### API Endpoints:
```
GET    /api/patient/[patientId]/reminders
POST   /api/patient/[patientId]/reminders
PUT    /api/patient/[patientId]/reminders/[reminderId]
DELETE /api/patient/[patientId]/reminders/[reminderId]
GET    /api/patient/[patientId]/notification-settings
PUT    /api/patient/[patientId]/notification-settings
```

---

### 4. ⚙️ ตั้งค่า (Settings)

**Purpose:** การตั้งค่าระบบทั่วไป, ความเป็นส่วนตัว, บัญชี

**Action Type:** `uri` → LIFF Page

**LIFF URL:** `https://liff.line.me/{LIFF_ID}/settings`

#### Sub-sections:

```
⚙️ ตั้งค่า
├── 🌐 ภาษา
│   ├── ไทย (default)
│   └── English
│
├── 🤖 การตอบกลับของอุ่นใจ
│   ├── โทนการพูด (สุภาพ/เป็นกันเอง)
│   └── ความยาวข้อความ (สั้น/ปานกลาง/ละเอียด)
│
├── 🔔 การแจ้งเตือนทั่วไป
│   ├── เปิด/ปิด notification ทั้งหมด
│   └── โหมดห้ามรบกวน (เวลา)
│
├── 👥 ผู้ดูแล (Caregivers)
│   ├── ดูรายชื่อผู้ดูแล
│   ├── เชิญผู้ดูแลใหม่
│   ├── จัดการสิทธิ์
│   └── ลบผู้ดูแล
│
├── 🔒 ความเป็นส่วนตัว
│   ├── ใครเห็นข้อมูลของฉัน
│   ├── แชร์ข้อมูลกับผู้ดูแล
│   └── ดาวน์โหลดข้อมูลของฉัน
│
├── 📱 เกี่ยวกับแอป
│   ├── เวอร์ชัน
│   ├── ข้อกำหนดการใช้งาน
│   └── นโยบายความเป็นส่วนตัว
│
└── 🚪 บัญชี
    ├── ออกจากระบบ
    └── ลบบัญชี
```

#### Database Tables Used:
- `users`
- `patient_profiles`
- `patient_caregivers`
- `caregiver_profiles`
- `notification_settings`

#### API Endpoints:
```
GET  /api/patient/[patientId]/settings
PUT  /api/patient/[patientId]/settings
GET  /api/patient/[patientId]/caregivers
POST /api/patient/[patientId]/caregivers/invite
PUT  /api/patient/[patientId]/caregivers/[caregiverId]
DELETE /api/patient/[patientId]/caregivers/[caregiverId]
GET  /api/patient/[patientId]/export-data
DELETE /api/patient/[patientId]/account
```

---

## 🖼️ Rich Menu Configuration

### LINE Rich Menu JSON

```json
{
  "size": {
    "width": 2500,
    "height": 843
  },
  "selected": true,
  "name": "OONJAI Main Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 625,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/{LIFF_ID}/profile"
      }
    },
    {
      "bounds": {
        "x": 625,
        "y": 0,
        "width": 625,
        "height": 843
      },
      "action": {
        "type": "message",
        "text": "#รายงาน"
      }
    },
    {
      "bounds": {
        "x": 1250,
        "y": 0,
        "width": 625,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/{LIFF_ID}/reminders"
      }
    },
    {
      "bounds": {
        "x": 1875,
        "y": 0,
        "width": 625,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/{LIFF_ID}/settings"
      }
    }
  ]
}
```

### Rich Menu Image Specifications

```
Dimensions: 2500 x 843 pixels
Format: PNG or JPEG
Max file size: 1 MB

Layout (4 equal columns):
┌──────────┬──────────┬──────────┬──────────┐
│  625px   │  625px   │  625px   │  625px   │
│          │          │          │          │
│    👤    │    📊    │    🔔    │    ⚙️    │
│ ข้อมูล   │ รายงาน   │ แจ้งเตือน │  ตั้งค่า  │
│ ของคุณ   │ สุขภาพ   │          │          │
│          │          │          │          │
│  843px   │          │          │          │
└──────────┴──────────┴──────────┴──────────┘
```

### Design Guidelines

```
Background: #FFFFFF or soft gradient
Icon size: ~200x200 px centered
Icon style: Flat, rounded, friendly
Text: 
  - Font: Noto Sans Thai or similar
  - Size: ~48-56px
  - Color: #333333 or brand color
  - Position: Below icon, centered

Colors per menu:
- ข้อมูลของคุณ: #4A90D9 (Blue)
- รายงานสุขภาพ: #5CB85C (Green)
- แจ้งเตือน: #F0AD4E (Orange)
- ตั้งค่า: #6C757D (Gray)
```

---

## 📁 LIFF Pages Structure

### File Structure

```
src/
├── app/
│   ├── liff/
│   │   ├── profile/
│   │   │   └── page.tsx           # ข้อมูลของคุณ
│   │   ├── reports/
│   │   │   └── page.tsx           # รายงานสุขภาพ (กราฟ)
│   │   ├── reminders/
│   │   │   └── page.tsx           # แจ้งเตือน
│   │   ├── settings/
│   │   │   └── page.tsx           # ตั้งค่า
│   │   └── layout.tsx             # LIFF Layout wrapper
│   └── ...
├── components/
│   ├── liff/
│   │   ├── ProfileForm.tsx
│   │   ├── MedicationList.tsx
│   │   ├── ReminderCard.tsx
│   │   ├── ReportChart.tsx
│   │   └── SettingsPanel.tsx
│   └── ...
└── lib/
    └── liff/
        ├── init.ts                # LIFF initialization
        └── auth.ts                # LIFF authentication
```

### LIFF Initialization

```typescript
// lib/liff/init.ts
import liff from '@line/liff';

export async function initializeLiff(liffId: string) {
  try {
    await liff.init({ liffId });
    
    if (!liff.isLoggedIn()) {
      liff.login();
      return null;
    }
    
    const profile = await liff.getProfile();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    };
  } catch (error) {
    console.error('LIFF initialization failed:', error);
    throw error;
  }
}

export function closeLiff() {
  liff.closeWindow();
}

export function sendMessage(message: string) {
  if (liff.isInClient()) {
    liff.sendMessages([{ type: 'text', text: message }]);
  }
}
```

---

## 🔧 Environment Variables

```env
# LINE
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret

# LIFF
LIFF_ID=your_liff_id
NEXT_PUBLIC_LIFF_ID=your_liff_id

# Supabase
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_service_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## 📝 Implementation Checklist

### Rich Menu Setup
- [ ] สร้าง Rich Menu image (2500x843px)
- [ ] Upload Rich Menu ผ่าน LINE API
- [ ] ตั้งค่า Rich Menu areas และ actions
- [ ] Link Rich Menu กับ LINE Official Account

### LIFF Pages
- [ ] สร้าง LIFF App ใน LINE Developers Console
- [ ] Implement `/liff/profile` page
- [ ] Implement `/liff/reminders` page
- [ ] Implement `/liff/settings` page
- [ ] Implement `/liff/reports` page (graphs)

### API Endpoints
- [ ] Patient profile CRUD
- [ ] Medications CRUD
- [ ] Reminders CRUD
- [ ] Notification settings
- [ ] Reports generation

### Message Handlers
- [ ] Handle `#รายงาน` command → Flex Message เลือกประเภท
- [ ] Handle `#รายงานวันนี้` command → Flex Message รายงานวัน
- [ ] Handle `#รายงานสัปดาห์` command → Flex Message รายงานสัปดาห์
- [ ] Handle `#รายงานเดือน` command → Flex Message รายงานเดือน
- [ ] Handle health logging via chat (AI extraction)
- [ ] Handle quick commands (`กินยาแล้ว`, `ความดัน 120/80`)

---

## 🎨 Visual Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                        OONJAI Rich Menu                         │
├────────────────┬────────────────┬────────────────┬──────────────┤
│                │                │                │              │
│      👤        │      📊        │      🔔        │      ⚙️      │
│                │                │                │              │
│   ข้อมูล        │    รายงาน      │    แจ้งเตือน    │    ตั้งค่า    │
│   ของคุณ        │    สุขภาพ      │                │              │
│                │                │                │              │
│   [LIFF]       │   [Message]    │    [LIFF]      │   [LIFF]     │
│   /profile     │   #รายงาน      │   /reminders   │   /settings  │
│                │                │                │              │
└────────────────┴────────────────┴────────────────┴──────────────┘
```
