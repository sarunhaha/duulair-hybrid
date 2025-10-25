# TASK-001: LIFF Registration App

**Priority:** 🔴 CRITICAL
**Status:** 📋 Ready to Start
**Owner:** Frontend Developer / LIFF Specialist
**Estimated Time:** 4-6 hours
**Dependencies:** None (Backend API ready)

---

## 📝 Overview

สร้าง LINE LIFF App สำหรับลงทะเบียนผู้ใช้งาน รองรับ 2 บทบาท: **ผู้ป่วย** และ **ผู้ดูแล** พร้อม UI ที่เหมาะกับผู้สูงอายุ

---

## 🎯 User Stories

### Story 1: Patient Registration
**As a** ผู้สูงอายุที่ต้องการใช้ระบบดูแลสุขภาพ
**I want** ลงทะเบียนง่ายๆ ผ่าน LINE LIFF
**So that** ระบบเก็บข้อมูลส่วนตัวและสุขภาพของผม และได้รหัสเชื่อมต่อสำหรับญาติ

**Acceptance Criteria:**
- ✅ เปิด LIFF จาก Rich Menu หรือ Flex Message
- ✅ Login ด้วย LINE Account อัตโนมัติ
- ✅ กรอกข้อมูลพื้นฐาน (ชื่อ, วันเกิด, เพศ)
- ✅ กรอกข้อมูลสุขภาพ (น้ำหนัก, ส่วนสูง, โรคประจำตัว)
- ✅ กรอกยาที่กินประจำ
- ✅ กรอกข้อมูลติดต่อฉุกเฉิน
- ✅ ได้รหัสเชื่อมต่อ 6 หลัก + QR Code
- ✅ UI ใหญ่ชัด อ่านง่าย

### Story 2: Caregiver Registration
**As a** ญาติผู้ดูแลผู้สูงอายุ
**I want** ลงทะเบียนและเชื่อมต่อกับบัญชีผู้ป่วย
**So that** ติดตามและรับแจ้งเตือนสุขภาพของคนในครอบครัว

**Acceptance Criteria:**
- ✅ เปิด LIFF และ login
- ✅ กรอกข้อมูลพื้นฐาน (ชื่อ, เบอร์โทร)
- ✅ ใส่รหัสเชื่อมต่อ 6 หลัก หรือ สแกน QR Code
- ✅ เลือกความสัมพันธ์ (ลูก, หลาน, พี่น้อง)
- ✅ ส่งคำขอเชื่อมต่อ
- ✅ รอการอนุมัติจาก patient

---

## 🛠 Technical Requirements

### Tech Stack
- **Framework:** Vanilla JavaScript (หรือ Vue.js/React ถ้าต้องการ)
- **LIFF SDK:** `@line/liff` v2.23+
- **CSS:** Custom (Elderly-friendly)
- **Build:** Vercel Static Hosting
- **API:** REST API (already available)

### LIFF Configuration
```javascript
liff.init({ liffId: '2008278683-5k69jxNq' })
```

### API Endpoints to Use

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/registration/check` | Check if user registered |
| POST | `/api/registration/patient` | Register patient |
| POST | `/api/registration/caregiver` | Register caregiver |
| POST | `/api/registration/generate-link-code` | Generate 6-digit code |
| POST | `/api/registration/link-patient` | Link caregiver to patient |

---

## 📂 Files to Create

```
liff/
  ├── index.html                    # Entry point - check user status
  ├── role-selection.html           # เลือก Patient/Caregiver
  ├── patient-registration.html     # Patient form
  ├── caregiver-registration.html   # Caregiver form
  ├── success.html                  # Registration success + link code
  ├── css/
  │   └── style.css                # Elderly-friendly styles
  ├── js/
  │   ├── liff-init.js             # LIFF SDK initialization
  │   ├── api.js                   # API calls wrapper
  │   ├── patient-form.js          # Patient form logic
  │   ├── caregiver-form.js        # Caregiver form logic
  │   └── utils.js                 # Utilities (validation, etc.)
  └── assets/
      └── images/
          └── logo.png             # Duulair logo
```

---

## 🎨 UI/UX Requirements

### Design System
```css
:root {
  --primary: #4CAF50;        /* เขียว - ปลอดภัย */
  --danger: #F44336;         /* แดง - อันตราย */
  --text: #212121;           /* ดำ - อ่านง่าย */
  --background: #FAFAFA;     /* เทาอ่อน */

  --font-size-base: 18px;    /* ใหญ่กว่าปกติ */
  --font-size-large: 24px;
  --button-height: 56px;     /* สูงกว่าปกติ - กดง่าย */
  --input-height: 54px;
  --spacing: 16px;
}
```

### Typography
- **Font:** Sarabun, sans-serif (ภาษาไทย)
- **Min size:** 18px
- **Heading:** 24-32px
- **Line height:** 1.6 (อ่านง่าย)

### Form Controls
- ✅ Input fields: สูง 54px, ตัวอักษรใหญ่
- ✅ Buttons: สูง 56px, ข้อความชัดเจน
- ✅ Radio/Checkbox: ขนาดใหญ่ (24x24px)
- ✅ Date picker: ใช้ native HTML5
- ✅ Spacing: กว้างขวาง ไม่แน่น

---

## 📋 Form Fields

### Patient Form (Step-by-Step)

#### Step 1: ข้อมูลพื้นฐาน
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "nickname": "string (optional)",
  "birthDate": "date (required)",
  "gender": "male|female|other (required)"
}
```

#### Step 2: ข้อมูลสุขภาพ
```json
{
  "weightKg": "number (optional)",
  "heightCm": "number (optional)",
  "bloodType": "A+|A-|B+|B-|AB+|AB-|O+|O- (optional)",
  "chronicDiseases": ["hypertension", "diabetes", ...],
  "drugAllergies": "string[] (optional)",
  "foodAllergies": "string[] (optional)"
}
```

#### Step 3: ยาที่กินประจำ
```json
{
  "medications": [
    {
      "name": "string (required)",
      "dosage": "string (optional)",
      "frequency": ["morning", "evening", ...]
    }
  ]
}
```

#### Step 4: ข้อมูลติดต่อฉุกเฉิน
```json
{
  "address": "string (optional)",
  "phoneNumber": "string (optional)",
  "emergencyContactName": "string (required)",
  "emergencyContactPhone": "string (required)",
  "emergencyContactRelation": "string (required)"
}
```

### Caregiver Form

```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "phoneNumber": "string (optional)",
  "linkCode": "string (6 digits, required)",
  "relationship": "child|grandchild|sibling|friend|caregiver (required)"
}
```

---

## 🔄 User Flows

### Flow 1: First-time Patient
```
1. User clicks "เริ่มลงทะเบียน" button
   ↓
2. LIFF opens → index.html
   ↓
3. Check user status (API: /check)
   ↓
4. Not registered → role-selection.html
   ↓
5. Select "ผู้ป่วย"
   ↓
6. patient-registration.html (4 steps)
   ↓
7. Submit → API: /registration/patient
   ↓
8. Success → success.html
   ↓
9. Display 6-digit code + QR code
   ↓
10. Button: "แชร์รหัส" + "ปิด"
```

### Flow 2: First-time Caregiver
```
1-4. (Same as Patient flow)
   ↓
5. Select "ผู้ดูแล"
   ↓
6. caregiver-registration.html
   ↓
7. Enter link code or scan QR
   ↓
8. Submit → API: /registration/caregiver
   ↓
9. Success → "รอการอนุมัติ"
   ↓
10. Close LIFF
```

### Flow 3: Already Registered
```
1-3. (Same as above)
   ↓
4. Already registered → success.html
   ↓
5. Show: "คุณลงทะเบียนแล้ว"
   ↓
6. Button: "ดูข้อมูล" or "ปิด"
```

---

## ✅ Validation Rules

### Patient Form
- ✅ firstName, lastName: ไม่เกิน 100 ตัวอักษร, ภาษาไทย/อังกฤษ
- ✅ birthDate: ต้องเป็นอดีต, อายุ 18-120 ปี
- ✅ weightKg: 20-300 kg
- ✅ heightCm: 50-250 cm
- ✅ phoneNumber: รูปแบบ 0XX-XXX-XXXX
- ✅ emergencyContactPhone: เป็นเบอร์โทรศัพท์ที่ถูกต้อง

### Caregiver Form
- ✅ firstName, lastName: ไม่เกิน 100 ตัวอักษร
- ✅ linkCode: ต้องเป็น 6 หลัก ตัวเลข
- ✅ phoneNumber: รูปแบบ 0XX-XXX-XXXX (optional)

---

## 🧪 Testing Checklist

### Functional Tests
- [ ] LIFF login ทำงานถูกต้อง
- [ ] API /check ตรวจสอบสถานะได้
- [ ] Patient form submit สำเร็จ
- [ ] Caregiver form submit สำเร็จ
- [ ] Link code generation ทำงาน
- [ ] Validation แสดง error ถูกต้อง
- [ ] QR code แสดงผลได้
- [ ] แชร์รหัสทำงาน (LINE share)

### UI/UX Tests
- [ ] Font size อ่านง่าย (18px+)
- [ ] Button ใหญ่พอกด (56px height)
- [ ] Input ใหญ่พอ (54px height)
- [ ] Spacing กว้างขวาง
- [ ] สี Contrast เพียงพอ
- [ ] ใช้งานบน iOS ได้
- [ ] ใช้งานบน Android ได้

### Error Handling
- [ ] Network error → แสดง message กลับไปหา user
- [ ] Invalid data → แสดง error ใต้ field
- [ ] LIFF init fail → แสดง error page
- [ ] API error → แจ้ง user retry

---

## 🚀 Deployment Steps

### 1. Build LIFF App
```bash
# ไม่มี build step ถ้าใช้ Vanilla JS
# แค่ deploy static files ไป Vercel
```

### 2. Configure Vercel
```json
// vercel.json
{
  "routes": [
    { "src": "/liff/(.*)", "dest": "/liff/$1" }
  ]
}
```

### 3. Update LIFF Endpoint URL
```
LINE Developers Console
→ LIFF Tab
→ Endpoint URL: https://duulair.vercel.app/liff/index.html
```

### 4. Test on Production
```
LINE Chat → Rich Menu → "ลงทะเบียน"
หรือ
Flex Message → "เริ่มลงทะเบียน"
```

---

## 📊 Success Metrics

- ✅ LIFF load time < 3 วินาที
- ✅ Form completion rate > 80%
- ✅ Error rate < 5%
- ✅ User satisfaction (no complaints about UI being too small)

---

## 🔗 References

- [LINE LIFF Docs](https://developers.line.biz/en/docs/liff/)
- [Backend API Spec](../user-registration-liff.md)
- [Database Schema](../../database/migrations/001_user_registration.sql)

---

## 📝 Notes

- Font ต้องใหญ่พอ (18px+) สำหรับผู้สูงอายุ
- Button ต้องใหญ่พอกดง่าย (56px height)
- ใช้สีที่ Contrast ชัด (เขียว/แดง/ดำ)
- Validate แบบ real-time เพื่อช่วย user
- ใช้ localStorage เก็บ draft (กรณี user ยังกรอกไม่เสร็จ)
- ทดสอบบนมือถือจริง ไม่ใช่แค่ browser

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
