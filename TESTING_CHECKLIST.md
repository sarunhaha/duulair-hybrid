# 🧪 LIFF Registration Testing Checklist

**Version:** 1.0.0
**Last Updated:** 2025-11-02
**Tested By:** _________________
**Date:** _________________

---

## 📋 Pre-Testing Setup

### Environment Check
- [ ] Backend is running (`npm run dev`)
- [ ] Database connection is working
- [ ] `.env` file configured correctly
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_KEY`
  - [ ] `LINE_CHANNEL_ACCESS_TOKEN`
  - [ ] `LINE_CHANNEL_SECRET`
- [ ] LIFF App created in LINE Developers Console
- [ ] LIFF ID configured in `public/liff/js/liff-init.js`
- [ ] LIFF Endpoint URL set correctly

### Tools Needed
- [ ] LINE app (iOS/Android) or LINE Desktop
- [ ] QR Code scanner (for testing QR feature)
- [ ] Second LINE account (for testing caregiver flow)

---

## 🧑‍⚕️ PART 1: Patient Registration Flow

### 1.1 First Time User - Entry Point
- [ ] Open LIFF for first time
- [ ] See loading indicator
- [ ] Redirected to role selection page
- [ ] Page displays correctly (no layout issues)
- [ ] Both role buttons visible and clickable

**Expected:** User sees "ยินดีต้อนรับ" with 2 role options

---

### 1.2 Patient Registration - Step 1 (ข้อมูลพื้นฐาน)
- [ ] Click "ลงทะเบียนเป็นผู้ป่วย" button
- [ ] Redirected to patient registration page
- [ ] Progress bar shows Step 1/4 active
- [ ] Form fields display correctly:
  - [ ] ชื่อ (required)
  - [ ] นามสกุล (required)
  - [ ] ชื่อเล่น (optional)
  - [ ] วันเกิด (required with date picker)
  - [ ] เพศ (required radio buttons)

**Validation Tests:**
- [ ] Try clicking "ถัดไป" without filling anything → shows error
- [ ] Fill only first name → shows "กรุณากรอกนามสกุล"
- [ ] Fill invalid birthdate (future date) → shows error
- [ ] Fill all required fields → can proceed to Step 2

**Data Entry:**
```
ชื่อ: [Your Test Name]
นามสกุล: [Your Test Surname]
ชื่อเล่น: แดง
วันเกิด: 1953-01-15 (should be 70+ years old)
เพศ: ชาย/หญิง
```

---

### 1.3 Patient Registration - Step 2 (ข้อมูลสุขภาพ)
- [ ] Progress bar shows Step 2/4 active
- [ ] Form fields display correctly:
  - [ ] น้ำหนัก (optional)
  - [ ] ส่วนสูง (optional)
  - [ ] กลุ่มเลือด (dropdown)
  - [ ] โรคประจำตัว (checkboxes)
  - [ ] แพ้ยา (text input)
  - [ ] แพ้อาหาร (text input)

**Validation Tests:**
- [ ] Enter invalid weight (e.g., 500) → shows error "น้ำหนักไม่ถูกต้อง"
- [ ] Enter invalid height (e.g., 300) → shows error "ส่วนสูงไม่ถูกต้อง"
- [ ] All fields optional → can skip to Step 3

**Data Entry:**
```
น้ำหนัก: 65
ส่วนสูง: 165
กลุ่มเลือด: O+
โรคประจำตัว: ✓ ความดันโลหิตสูง, ✓ เบาหวาน
แพ้ยา: Penicillin, Aspirin
แพ้อาหาร: กุ้ง, นม
```

**Navigation:**
- [ ] Click "ย้อนกลับ" → returns to Step 1 with data preserved
- [ ] Click "ถัดไป" → proceeds to Step 3

---

### 1.4 Patient Registration - Step 3 (ยาที่กินประจำ)
- [ ] Progress bar shows Step 3/4 active
- [ ] Shows "ยังไม่มียาที่เพิ่ม" initially
- [ ] Add medication form visible

**Add Medication Test:**
- [ ] Fill medication name only → click "เพิ่มยา" → shows "กรุณาเลือกเวลาที่กินยา"
- [ ] Fill name + select frequency → click "เพิ่มยา" → medication added to list
- [ ] Medication shows correctly with:
  - [ ] ชื่อยา
  - [ ] ขนาดยา (if filled)
  - [ ] เวลาที่กิน (เช้า, เที่ยง, เย็น, ก่อนนอน)
  - [ ] ปุ่ม "ลบ"

**Test Data:**
```
Medication 1:
- ชื่อยา: Amlodipine
- ขนาด: 5 mg
- เวลา: ✓ เช้า, ✓ เย็น

Medication 2:
- ชื่อยา: Metformin
- ขนาด: 500 mg
- เวลา: ✓ เช้า, ✓ เที่ยง, ✓ เย็น
```

**Remove Medication:**
- [ ] Click "ลบ" on a medication → medication removed from list
- [ ] List updates correctly

**Navigation:**
- [ ] Can skip step (no medications) → proceeds to Step 4
- [ ] With medications → proceeds to Step 4

---

### 1.5 Patient Registration - Step 4 (ติดต่อฉุกเฉิน)
- [ ] Progress bar shows Step 4/4 active
- [ ] Form fields display correctly:
  - [ ] ที่อยู่ (optional)
  - [ ] เบอร์โทรศัพท์ (optional but validated if filled)
  - [ ] ชื่อผู้ติดต่อฉุกเฉิน (required)
  - [ ] เบอร์โทรผู้ติดต่อ (required)
  - [ ] ความสัมพันธ์ (required dropdown)

**Validation Tests:**
- [ ] Click "ลงทะเบียน" without filling required → shows errors
- [ ] Fill invalid phone (e.g., 12345) → shows "เบอร์โทรศัพท์ไม่ถูกต้อง"
- [ ] Fill all required fields → can submit

**Test Data:**
```
ที่อยู่: 123 ถนนสุขุมวิท กรุงเทพ 10110
เบอร์โทรศัพท์: 0812345678
ชื่อผู้ติดต่อ: นายสมชาย ใจดี
เบอร์ผู้ติดต่อ: 0898765432
ความสัมพันธ์: ลูก
```

**Buttons:**
- [ ] "ย้อนกลับ" button visible and works
- [ ] "ถัดไป" button hidden
- [ ] "✅ ลงทะเบียน" button visible

---

### 1.6 Patient Registration - Submission
- [ ] Click "✅ ลงทะเบียน"
- [ ] Shows loading "กำลังลงทะเบียน..."
- [ ] Loading indicator displays properly
- [ ] No console errors

**Check Backend:**
```bash
# Monitor backend logs
npm run dev

# Should see:
✅ POST /api/registration/patient
✅ Database insert successful
```

**Expected Result:**
- [ ] Redirected to success page (`/liff/success.html?patient_id=xxx`)
- [ ] Success page loads without errors

---

### 1.7 Success Page - Link Code Display
- [ ] Success icon ✅ displays
- [ ] Title shows "ลงทะเบียนสำเร็จ!"
- [ ] Link code section visible
- [ ] **Link Code displays correctly (6 digits)**
- [ ] **QR Code generates and displays**
- [ ] QR Code is scannable
- [ ] Expiry info shows (if applicable)

**Test Buttons:**
- [ ] "📤 แชร์รหัส" button works
  - [ ] Opens LINE share picker
  - [ ] Can select chat/group
  - [ ] Message sent with correct format
- [ ] "📋 คัดลอกรหัส" button works
  - [ ] Shows success message
  - [ ] Code copied to clipboard (verify by pasting)
- [ ] "ปิด" button closes LIFF

**Record Link Code:** `______` (write it down for caregiver test)

---

### 1.8 Returning Patient User
- [ ] Close LIFF
- [ ] Open LIFF again (same patient account)
- [ ] Should skip role selection
- [ ] **Auto-redirect to success page with `returning=true`**
- [ ] Shows "ยินดีต้อนรับกลับ!" instead of "ลงทะเบียนสำเร็จ"
- [ ] Same Link Code displays
- [ ] QR Code displays

**Expected:** No need to register again, can view link code anytime

---

## 👨‍👩‍👧 PART 2: Caregiver Registration Flow

### 2.1 Caregiver Registration - Entry
**Use a different LINE account!**

- [ ] Open LIFF with caregiver account
- [ ] Not registered → redirected to role selection
- [ ] Click "ลงทะเบียนเป็นผู้ดูแล"
- [ ] Redirected to caregiver registration page
- [ ] Form displays correctly

---

### 2.2 Caregiver Registration - Form
- [ ] Form fields visible:
  - [ ] ชื่อ (required)
  - [ ] นามสกุล (required)
  - [ ] เบอร์โทรศัพท์ (optional)
  - [ ] รหัสเชื่อมต่อ 6 หลัก (required)
  - [ ] ความสัมพันธ์ (required dropdown)

**Validation Tests:**
- [ ] Click "ลงทะเบียน" without filling → shows errors
- [ ] Fill invalid link code (e.g., "abc") → shows error
- [ ] Fill link code < 6 digits → shows error
- [ ] Fill wrong link code (e.g., "999999") → API error "รหัสไม่ถูกต้อง"

**Test Data:**
```
ชื่อ: สมหญิง
นามสกุล: รักษ์ป่า
เบอร์โทรศัพท์: 0823456789
รหัสเชื่อมต่อ: [USE CODE FROM PATIENT TEST]
ความสัมพันธ์: ลูก
```

---

### 2.3 QR Code Scanner Test
**Note:** This only works in LINE mobile app, not desktop!

- [ ] Click "📷 สแกน QR Code" button
- [ ] Camera opens (or permission requested)
- [ ] Scan QR Code from patient's success page
- [ ] Link code auto-fills in input field
- [ ] Shows success message "สแกน QR Code สำเร็จ"

**If not in mobile LINE:**
- [ ] Shows error "การสแกน QR Code ใช้ได้เฉพาะใน LINE เท่านั้น"

---

### 2.4 Caregiver Registration - Submission
- [ ] Click "✅ ลงทะเบียนและเชื่อมต่อ"
- [ ] Shows loading "กำลังลงทะเบียน..."
- [ ] Wait for API response

**Check Backend:**
```bash
# Should see:
✅ POST /api/registration/caregiver
✅ POST /api/registration/link-patient
✅ Database records created
```

**Expected Result:**
- [ ] Shows success message "ลงทะเบียนสำเร็จ! รอผู้ป่วยอนุมัติการเชื่อมต่อ"
- [ ] Redirected to success page after 2 seconds
- [ ] Success page shows "ส่งคำขอเรียบร้อย!"
- [ ] Shows waiting message

---

### 2.5 Returning Caregiver User
- [ ] Close LIFF
- [ ] Open LIFF again (same caregiver account)
- [ ] Should be recognized as registered
- [ ] Shows "คุณลงทะเบียนเรียบร้อยแล้ว"
- [ ] LIFF closes after 2 seconds

**Expected:** No re-registration needed

---

## 🔗 PART 3: Link Code Functionality

### 3.1 Link Code Validation
- [ ] Link code is exactly 6 digits
- [ ] Link code is unique (no duplicates)
- [ ] Link code can be used only once per caregiver
- [ ] Expired codes rejected (if expiry implemented)

### 3.2 QR Code Validation
- [ ] QR Code format: `DUULAIR:123456`
- [ ] QR Code scannable by any QR reader app
- [ ] QR Code matches displayed link code
- [ ] QR Code image quality good (not pixelated)

### 3.3 Link Code Retrieval
- [ ] Patient can see code anytime by opening LIFF
- [ ] Code persists (same code on multiple opens)
- [ ] Code displays correctly after backend restart

---

## 🔧 PART 4: Database Verification

### 4.1 Check Database Records
Open Supabase Dashboard and verify:

**users table:**
- [ ] Patient user created with `role = 'patient'`
- [ ] Caregiver user created with `role = 'caregiver'`
- [ ] `line_user_id` matches LINE user ID

**patient_profiles table:**
- [ ] Patient profile created
- [ ] All fields saved correctly (first_name, last_name, birth_date, etc.)
- [ ] Chronic diseases stored as array
- [ ] Allergies stored correctly

**caregiver_profiles table:**
- [ ] Caregiver profile created
- [ ] Fields match input data

**link_codes table:**
- [ ] Link code record exists
- [ ] Code matches displayed code
- [ ] `expires_at` is set (24 hours from creation)
- [ ] `used = false` initially

**patient_caregivers table:**
- [ ] Link record created
- [ ] `patient_id` and `caregiver_id` correct
- [ ] `relationship` matches selection
- [ ] `status = 'pending'` (awaiting approval)

**patient_medications table:**
- [ ] Medications saved (if added)
- [ ] Frequency array correct
- [ ] `is_active = true`

---

## ❌ PART 5: Error Handling Tests

### 5.1 Network Errors
- [ ] Turn off WiFi → try to register
- [ ] Should show "เกิดข้อผิดพลาด" message
- [ ] Turn WiFi back on → retry works

### 5.2 Invalid Data
- [ ] Birth date in future → rejected
- [ ] Age < 18 years → rejected (if validation exists)
- [ ] Invalid phone format → rejected
- [ ] SQL injection attempts → rejected safely

### 5.3 Duplicate Registration
- [ ] Try to register same LINE account twice
- [ ] Should detect existing user
- [ ] Redirect to success page (not error)

### 5.4 Invalid Link Code
- [ ] Use expired link code → shows error
- [ ] Use already-used code → shows error
- [ ] Use non-existent code (999999) → shows "รหัสไม่ถูกต้อง"
- [ ] Use malformed code (abc123) → validation error

### 5.5 LIFF Errors
- [ ] Open LIFF outside LINE → should show error or redirect
- [ ] LIFF initialization fails → shows error message
- [ ] LIFF ID mismatch → shows error

---

## 📱 PART 6: UI/UX Tests

### 6.1 Responsive Design
Test on different devices:
- [ ] iPhone (iOS Safari)
- [ ] Android Phone (Chrome)
- [ ] iPad/Tablet
- [ ] LINE Desktop (if applicable)

**Check:**
- [ ] All text readable (font size ok for elderly)
- [ ] Buttons large enough to tap
- [ ] Forms don't overflow screen
- [ ] QR Code visible and scannable
- [ ] Progress bar displays correctly

### 6.2 Accessibility
- [ ] Form labels clear and descriptive
- [ ] Error messages visible and easy to understand
- [ ] Loading indicators clear
- [ ] Success/error colors distinguishable

### 6.3 Thai Language
- [ ] All text in Thai (no English except where appropriate)
- [ ] Thai date format displays correctly
- [ ] No encoding issues (ภาษาไทยแสดงผลถูกต้อง)

---

## 🚀 PART 7: Performance Tests

- [ ] Page load time < 3 seconds
- [ ] Form submission < 5 seconds
- [ ] QR Code generation < 2 seconds
- [ ] No memory leaks (test multiple opens/closes)
- [ ] Smooth transitions between steps

---

## 🐛 PART 8: Browser Console Checks

During all tests, check console for:
- [ ] No JavaScript errors
- [ ] No failed API calls
- [ ] LIFF initialization logs visible
- [ ] API response logs visible
- [ ] No 404 errors on resources

---

## ✅ Testing Summary

**Total Tests:** ~100+ checkpoints
**Passed:** _____
**Failed:** _____
**Blocked:** _____

### Critical Issues Found
1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

### Minor Issues Found
1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

### Recommendations
1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

---

## 📝 Notes

### What Went Well
-
-
-

### What Needs Improvement
-
-
-

### Next Steps
- [ ] Fix critical issues
- [ ] Re-test failed scenarios
- [ ] Deploy to production
- [ ] Monitor production usage

---

**Tester Signature:** _________________
**Date Completed:** _________________
**Status:** ⬜ PASSED / ⬜ FAILED / ⬜ NEEDS REVIEW
