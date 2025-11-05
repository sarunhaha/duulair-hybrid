# Phase 2 Implementation: Registration Flow (TASK-002)

## Overview

Phase 2 implements the group registration LIFF form and dashboard for the Group-Based Care Model.

## ✅ Completed Features

### 1. Group Registration Form
**File:** `public/liff/group-registration.html`

**Features:**
- 4-step wizard interface
- Combined caregiver + patient registration
- Mobile-optimized design
- Elderly-friendly large fonts and buttons
- Auto-save draft functionality
- Automatic group context detection

**Steps:**
1. **Step 1:** ผู้ดูแลหลัก (Primary Caregiver Info)
   - ชื่อ-นามสกุล (First/Last Name)
   - เบอร์โทรศัพท์ (Phone Number)
   - Auto-fill LINE profile info

2. **Step 2:** ข้อมูลพื้นฐานผู้ป่วย (Patient Basic Info)
   - ชื่อ-นามสกุล (First/Last Name)
   - ชื่อเล่น (Nickname)
   - วันเกิด (Birth Date with CE/BE helper text)
   - เพศ (Gender)

3. **Step 3:** ข้อมูลสุขภาพผู้ป่วย (Patient Health Info)
   - น้ำหนัก/ส่วนสูง (Weight/Height)
   - กลุ่มเลือด (Blood Type)
   - โรคประจำตัว (Chronic Diseases - checkbox list)
   - แพ้ยา/แพ้อาหาร (Drug/Food Allergies)

4. **Step 4:** ติดต่อฉุกเฉิน (Emergency Contact)
   - ที่อยู่ (Address)
   - เบอร์โทรผู้ป่วย (Patient Phone)
   - ผู้ติดต่อฉุกเฉิน (Emergency Contact Details)

### 2. Registration Logic
**File:** `public/liff/js/group-form.js`

**Features:**
- ✅ LIFF initialization with group context validation
- ✅ Group registration check (prevents duplicate registration)
- ✅ Step-by-step form validation
- ✅ Draft save/load functionality
- ✅ API integration with `/api/groups/register`
- ✅ Auto-redirect to dashboard after success
- ✅ Comprehensive error handling
- ✅ Loading states

**Validation Rules:**
- **Step 1:** Caregiver first name and last name required
- **Step 2:** Patient first name, last name, birth date, and gender required
  - Birth date validation (not in future, not > 120 years old)
- **Step 3:** Optional fields with range validation
  - Weight: 20-300 kg
  - Height: 50-250 cm
- **Step 4:** Emergency contact name, phone, and relation required

### 3. Group Dashboard
**File:** `public/liff/group-dashboard.html`

**Features:**
- Group info display
- Patient summary
- Primary caregiver info
- Members list with roles
- Quick action buttons

**File:** `public/liff/js/group-dashboard.js`

**Features:**
- ✅ Load group data by LINE Group ID
- ✅ Auto-redirect to registration if group not found
- ✅ Display group members with roles
- ✅ Format dates and role labels in Thai
- ✅ Loading states

### 4. CSS Enhancements
**File:** `public/liff/css/style.css`

**Added:**
- `.loading-spinner` - Animated loading spinner
- `.quick-actions` - Dashboard quick action buttons layout
- Responsive and elderly-friendly design

## 📁 Files Created/Modified

### Created:
1. `public/liff/group-registration.html` (280 lines)
2. `public/liff/js/group-form.js` (650 lines)
3. `public/liff/group-dashboard.html` (90 lines)
4. `public/liff/js/group-dashboard.js` (200 lines)

### Modified:
1. `public/liff/css/style.css` (Added group dashboard styles)

## 🎯 Key Integration Points

### API Endpoints Used:
1. `POST /api/groups/check` - Check if group already registered
2. `POST /api/groups/register` - Register new group
3. `GET /api/groups/by-line-id/:lineGroupId` - Get group data

### LIFF Features Used:
- `liff.init()` - Initialize LIFF
- `liff.getProfile()` - Get user profile (for caregiver auto-fill)
- `liff.getContext()` - Get group context
- `liff.closeWindow()` - Close LIFF window

### LocalStorage:
- Draft saving: `localStorage.setItem('draft-group', JSON.stringify(formData))`
- Draft loading: `localStorage.getItem('draft-group')`
- Draft clearing: `localStorage.removeItem('draft-group')`

## 🧪 Testing Checklist

### Prerequisites:
- [ ] LIFF app created and registered
- [ ] Group routes registered in backend (`/api/groups/*`)
- [ ] Database migration complete (groups, group_members tables)
- [ ] .env configured with SUPABASE_URL and SUPABASE_SERVICE_KEY

### Test Cases:

#### TC1: Access Registration from Group
1. Create a LINE Group
2. Add bot to group
3. Open LIFF URL from group
4. Expected: Shows registration form Step 1

#### TC2: Group Context Validation
1. Try to open LIFF URL from 1:1 chat
2. Expected: Shows error "กรุณาเปิดหน้านี้จากกลุ่ม LINE"

#### TC3: Duplicate Registration Check
1. Register a group successfully
2. Try to register same group again
3. Expected: Auto-redirect to dashboard with message "กลุ่มนี้ลงทะเบียนแล้ว"

#### TC4: Step 1 Validation
1. Try to click "ถัดไป" without filling required fields
2. Expected: Shows error for missing fields
3. Fill all required fields
4. Expected: Moves to Step 2

#### TC5: Step 2 Validation
1. Try invalid birth date (future date)
2. Expected: Shows error "วันเกิดไม่ถูกต้อง (อนาคต)"
3. Try birth date > 120 years ago
4. Expected: Shows error "วันเกิดไม่ถูกต้อง (มากกว่า 120 ปี)"
5. Fill valid data
6. Expected: Moves to Step 3

#### TC6: Step 3 Optional Fields
1. Leave all fields empty
2. Click "ถัดไป"
3. Expected: Moves to Step 4 (optional fields)

#### TC7: Step 4 Emergency Contact
1. Leave emergency contact fields empty
2. Click "ลงทะเบียนกลุ่ม"
3. Expected: Shows error for missing fields
4. Fill all required fields
5. Click "ลงทะเบียนกลุ่ม"
6. Expected: Shows loading, then success message, redirects to dashboard

#### TC8: Draft Save/Load
1. Fill Step 1 data
2. Close LIFF
3. Reopen LIFF
4. Expected: Step 1 data is pre-filled from draft

#### TC9: Dashboard Display
1. Complete registration
2. Dashboard loads
3. Expected: Shows group name, patient name, caregiver name, members list

#### TC10: Dashboard from Registered Group
1. Open dashboard LIFF from registered group
2. Expected: Loads group data correctly
3. Try from unregistered group
4. Expected: Redirects to registration

## 🔄 User Flow

```
[User adds bot to LINE Group]
        ↓
[Opens group registration LIFF]
        ↓
[System checks: Is this from group context?]
   Yes ↓              No → Error
        ↓
[System checks: Is group registered?]
   No ↓               Yes → Redirect to Dashboard
        ↓
[Shows registration form Step 1]
        ↓
[User fills caregiver info]
        ↓
[Step 2: Patient basic info]
        ↓
[Step 3: Patient health info]
        ↓
[Step 4: Emergency contact]
        ↓
[Submit to API]
        ↓
[Success! Redirect to Dashboard]
```

## 📝 Sample Form Data

```json
{
  "lineGroupId": "Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "groupName": "ครอบครัวคุณยาย",
  "caregiver": {
    "lineUserId": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "displayName": "ทดสอบ ดูแล",
    "pictureUrl": "https://profile.line-scdn.net/...",
    "firstName": "ทดสอบ",
    "lastName": "ดูแล",
    "phoneNumber": "0812345678"
  },
  "patient": {
    "firstName": "คุณยาย",
    "lastName": "ทดสอบ",
    "nickname": "ยาย",
    "birthDate": "1950-01-15",
    "gender": "female",
    "weightKg": 55,
    "heightCm": 155,
    "bloodType": "O+",
    "chronicDiseases": ["hypertension", "diabetes"],
    "drugAllergies": ["penicillin"],
    "foodAllergies": [],
    "address": "123 หมู่ 1 ต.ทดสอบ อ.ทดสอบ จ.กรุงเทพ 10100",
    "phoneNumber": "0823456789",
    "emergencyContactName": "ลูกสาว",
    "emergencyContactPhone": "0834567890",
    "emergencyContactRelation": "child"
  }
}
```

## 🚀 Deployment Notes

### Environment Variables Required:
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxxxx
LIFF_ID=xxxxx-xxxxx
LINE_CHANNEL_SECRET=xxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
```

### LIFF Configuration:
1. Create new LIFF app in LINE Developers Console
2. Set Endpoint URL: `https://your-domain.com/liff/group-registration.html`
3. Set Size: Full
4. Enable "Scan QR" permission (for future features)
5. Module mode: ON

### Rich Menu Update (Future):
Add button to launch group registration LIFF:
```json
{
  "action": {
    "type": "uri",
    "label": "ลงทะเบียนกลุ่ม",
    "uri": "https://liff.line.me/{LIFF_ID}"
  }
}
```

## 🐛 Known Issues / Limitations

1. **Patient without LINE:**
   - Patient info is collected but patient won't be added to group_members table
   - This is expected behavior for MVP (patients may not have LINE)

2. **Group Name:**
   - Currently optional, uses auto-generated name if not provided
   - Format: "กลุ่มดูแล{PatientFirstName}"

3. **Dashboard Features:**
   - Quick actions (Log Activity, View Reports, Settings) are placeholders
   - Will be implemented in Phase 4 and Phase 5

## 📋 Next Steps (Phase 3)

Phase 3 will implement:
1. Webhook handling for group events (join, leave, member changes)
2. Message routing in group context
3. Actor tracking for group messages
4. Group-aware activity logging

## 🎉 Phase 2 Complete!

All Phase 2 deliverables have been implemented and are ready for testing.

**Total Implementation Time:** ~2 hours
**Files Created:** 4
**Lines of Code:** ~1,220 lines

Ready to proceed to Phase 3: Webhook & Group Logic!
