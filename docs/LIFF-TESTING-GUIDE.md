# 🧪 LIFF Testing Guide - การทดสอบ LIFF Pages

## ✅ สถานะปัจจุบัน (Updated)

### ไฟล์ที่แก้ไขแล้ว:
- ✅ `public/liff/patient-profile.html` - Updated Supabase + LIFF ID
- ✅ `public/liff/reminders.html` - Updated Supabase + LIFF ID
- ✅ `public/liff/medications.html` - Updated Supabase + LIFF ID
- ✅ `public/liff/settings.html` - Updated Supabase + LIFF ID

### Configuration ที่ใช้:
```javascript
SUPABASE_URL = 'https://xibtslxxjxossybxisdr.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJI...' // (จาก .env)
LIFF_ID = '2008278683-5k69jxNq'
```

---

## 🎯 LIFF URLs สำหรับ Rich Menu (พร้อมใช้งาน)

```
✅ ปุ่มที่ 3 (👤 ข้อมูลผู้ป่วย)
https://liff.line.me/2008278683-5k69jxNq/patient-profile.html

✅ ปุ่มที่ 4 (🔔 เตือน)
https://liff.line.me/2008278683-5k69jxNq/reminders.html

✅ ปุ่มที่ 5 (💊 ยา)
https://liff.line.me/2008278683-5k69jxNq/medications.html

✅ ปุ่มที่ 6 (⚙️ ตั้งค่า)
https://liff.line.me/2008278683-5k69jxNq/settings.html
```

---

## 📋 ขั้นตอนการทดสอบ

### Step 1: Update LIFF Endpoint URL ใน LINE Console

1. ไปที่ https://developers.line.biz/console/
2. เลือก Provider และ Channel ของคุณ
3. ไปที่แท็บ **LIFF**
4. คลิกที่ LIFF app ID: `2008278683-5k69jxNq`
5. **Edit Endpoint URL** เป็น:
   ```
   https://your-production-domain.com/liff/
   ```
   หรือถ้าใช้ Vercel/Netlify:
   ```
   https://your-app.vercel.app/liff/
   ```
6. Save

⚠️ **สำคัญ:** Endpoint URL ต้องเป็น **HTTPS** (ไม่ใช่ HTTP หรือ localhost)

---

### Step 2: Deploy ไฟล์ LIFF ไปยัง Production

#### วิธีที่ 1: Deploy ด้วย Vercel (แนะนำ)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd /Users/sarunseangsomboon/Documents/Projects/duulair-hybrid
vercel --prod

# Vercel จะให้ URL เช่น: https://duulair-hybrid.vercel.app
# Endpoint URL จะเป็น: https://duulair-hybrid.vercel.app/liff/
```

#### วิธีที่ 2: Deploy ด้วย Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd /Users/sarunseangsomboon/Documents/Projects/duulair-hybrid
netlify deploy --prod --dir=public

# Netlify จะให้ URL เช่น: https://duulair-hybrid.netlify.app
# Endpoint URL จะเป็น: https://duulair-hybrid.netlify.app/liff/
```

#### วิธีที่ 3: Upload ไปยัง VPS/Server ของตัวเอง

```bash
# SCP upload
scp -r public/liff/* user@your-server.com:/var/www/html/liff/

# หรือใช้ FTP/SFTP client
# Endpoint URL จะเป็น: https://your-server.com/liff/
```

---

### Step 3: ทดสอบ LIFF URLs

#### A. ทดสอบด้วย LINE Browser (วิธีที่ดีที่สุด)

1. เปิดแชท LINE ใดก็ได้
2. ส่งข้อความ URL เหล่านี้ให้ตัวเอง:
   ```
   https://liff.line.me/2008278683-5k69jxNq/patient-profile.html
   ```
3. คลิกที่ URL
4. LIFF จะเปิดใน LINE Browser

#### B. สร้าง QR Code เพื่อทดสอบ

1. ไปที่ https://www.qr-code-generator.com/
2. ใส่ URL: `https://liff.line.me/2008278683-5k69jxNq/patient-profile.html`
3. Generate QR Code
4. Scan ด้วย LINE Camera
5. LINE จะเปิด LIFF App โดยอัตโนมัติ

#### C. ทดสอบด้วย LIFF Inspector (สำหรับ Desktop)

1. ติดตั้ง Chrome Extension: [LIFF Inspector](https://chrome.google.com/webstore/detail/liff-inspector/...)
2. เปิด: `https://liff.line.me/2008278683-5k69jxNq/patient-profile.html`
3. Extension จะ mock LIFF environment ให้

---

### Step 4: ตรวจสอบ Console Logs

เมื่อเปิด LIFF ควรเห็น logs ดังนี้:

```javascript
✅ LIFF initialized
✅ User is logged in
✅ User ID: U1234567890abcdef...
✅ Loading patient data...
```

ถ้าเกิด error:
```javascript
❌ LIFF init failed: { code: "LIFF_ID_NOT_FOUND" }
```
→ ตรวจสอบ LIFF ID ถูกต้องหรือไม่

```javascript
❌ Failed to load data: 401 Unauthorized
```
→ ตรวจสอบ Supabase RLS policies

---

## 🔍 Checklist การทดสอบแต่ละหน้า

### 1. Patient Profile (`patient-profile.html`)

- [ ] หน้าโหลดได้ไม่มี error
- [ ] แสดง 3 tabs: ข้อมูลทั่วไป, ทางการแพทย์, ติดต่อฉุกเฉิน
- [ ] สลับ tabs ได้ไม่สะดุด
- [ ] กรอกข้อมูลและกด Save
- [ ] แสดง Success alert
- [ ] Refresh หน้า - ข้อมูลยังอยู่

**Expected behavior:**
- แสดง Loading spinner ขณะโหลดข้อมูล
- ถ้ายังไม่มีข้อมูล form ว่างเปล่า
- ถ้ามีข้อมูลแล้ว แสดงข้อมูลเดิม

---

### 2. Reminders (`reminders.html`)

- [ ] หน้าโหลดได้ไม่มี error
- [ ] กด "➕ เพิ่มเวลาเตือน" แสดง modal
- [ ] เลือกประเภทเตือน (💊, 🩺, 💧, etc.)
- [ ] กรอกหัวข้อและเวลา
- [ ] เลือกวัน (Mon-Sun)
- [ ] กด Save - แสดง reminder card ใหม่
- [ ] Toggle on/off reminder
- [ ] กด Edit - แสดง modal พร้อมข้อมูลเดิม
- [ ] กด Delete - ลบ reminder

**Expected behavior:**
- Reminder cards แสดงเวลาเด่นชัด
- Day badges แสดงสีตามที่เลือก
- Toggle animation เรียบ

---

### 3. Medications (`medications.html`)

- [ ] หน้าโหลดได้ไม่มี error
- [ ] แสดงจำนวนยาทั้งหมด
- [ ] กด "➕ เพิ่มยา" แสดง modal
- [ ] กรอกชื่อยา, ปริมาณ, หน่วย
- [ ] เลือกเวลาทานยา (เช้า, กลางวัน, เย็น, ก่อนนอน)
- [ ] เลือกวิธีรับประทาน
- [ ] กด Save - แสดง medication card ใหม่
- [ ] กด Edit - แสดง modal พร้อมข้อมูลเดิม
- [ ] กด Delete - ลบยา
- [ ] Medication count อัปเดตถูกต้อง

**Expected behavior:**
- Time badges แสดงตามเวลาที่เลือก
- Instructions แสดงในรูปแบบที่อ่านง่าย
- หมายเหตุแสดงใน yellow alert box

---

### 4. Settings (`settings.html`)

- [ ] หน้าโหลดได้ไม่มี error
- [ ] แสดง 5 tabs: กลุ่ม, การแจ้งเตือน, รายงาน, แพ็คเกจ, ช่วยเหลือ
- [ ] **Tab กลุ่ม:**
  - [ ] แสดง Link Code ขนาดใหญ่
  - [ ] แสดงรายชื่อสมาชิก
  - [ ] แสดง role badge (primary/member)
  - [ ] แก้ไขชื่อกลุ่มได้
- [ ] **Tab การแจ้งเตือน:**
  - [ ] Toggle เตือนกินยา, วัดความดัน, ดื่มน้ำ, ออกกำลัง
  - [ ] Toggle แจ้งกลุ่มเมื่อมีกิจกรรม/ฉุกเฉิน
- [ ] **Tab รายงาน:**
  - [ ] Toggle รายงานประจำวัน/สัปดาห์/เดือน
  - [ ] Toggle ส่งในกลุ่ม/ผู้ดูแลหลัก
- [ ] **Tab แพ็คเกจ:**
  - [ ] แสดง 3 แพ็คเกจ: Free, Pro, Enterprise
  - [ ] แพ็คเกจปัจจุบันแสดง "ใช้งานอยู่"
- [ ] **Tab ช่วยเหลือ:**
  - [ ] แสดง FAQ 6 ข้อ
  - [ ] แสดงข้อมูลติดต่อ (Email, LINE, Website)
  - [ ] แสดง version และ About

**Expected behavior:**
- Toggle switches มี animation
- Settings save อัตโนมัติเมื่อเปลี่ยนแปลง
- แสดง success message หลัง save

---

## 🚨 Common Issues & Solutions

### Issue 1: "LIFF_ID_NOT_FOUND"
**สาเหตุ:** LIFF ID ไม่ถูกต้องหรือ LIFF App ถูกลบ
**แก้ไข:**
- ตรวจสอบ LIFF ID ใน LINE Console
- สร้าง LIFF App ใหม่ถ้าจำเป็น

### Issue 2: "Failed to fetch"
**สาเหตุ:** Endpoint URL ไม่ถูกต้องหรือไฟล์ไม่พบ
**แก้ไข:**
- ตรวจสอบ Endpoint URL ใน LIFF settings
- ตรวจสอบว่าไฟล์ถูก deploy แล้ว
- ทดสอบเปิด URL โดยตรง เช่น `https://your-domain.com/liff/patient-profile.html`

### Issue 3: CORS Error
**สาเหตุ:** Supabase CORS settings
**แก้ไข:**
- ไปที่ Supabase Dashboard > Settings > API
- เพิ่ม `https://liff.line.me` ใน Allowed origins

### Issue 4: "401 Unauthorized" from Supabase
**สาเหตุ:** RLS policies หรือ authentication ไม่ถูกต้อง
**แก้ไข:**
- ตรวจสอบ RLS policies ใน Supabase
- ตรวจสอบว่าใช้ ANON_KEY ถูกต้อง
- Debug ด้วย console.log เพื่อดู user ID

### Issue 5: หน้าจอขาว/ไม่แสดงอะไร
**สาเหตุ:** JavaScript error
**แก้ไข:**
- เปิด DevTools (F12)
- ดู Console logs
- แก้ไข syntax errors

---

## 🔧 Debug Mode

### เปิด Debug Logs:

เพิ่มใน script tag:
```javascript
// Enable debug mode
const DEBUG = true;

function debug(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}

// ใช้งาน
debug('LIFF initialized', liff.getContext());
debug('User profile:', profile);
debug('Supabase response:', data);
```

### ดู LIFF Context:

```javascript
const context = liff.getContext();
console.log('Context:', {
  type: context.type,        // 'utou', 'room', 'group'
  userId: context.userId,    // User ID
  utouId: context.utouId,    // 1:1 chat ID
  roomId: context.roomId,    // Group room ID
  groupId: context.groupId,  // Group ID
});
```

---

## 📱 Production Deployment Checklist

- [ ] ไฟล์ LIFF ทั้ง 4 อัปโหลดแล้ว
- [ ] Endpoint URL update แล้วใน LINE Console
- [ ] Endpoint URL เป็น HTTPS
- [ ] ทดสอบเปิด URL โดยตรงได้
- [ ] Database schema migration เสร็จแล้ว
- [ ] Supabase RLS policies ตั้งค่าแล้ว
- [ ] CORS settings ถูกต้อง
- [ ] ทดสอบทุกหน้าใน LINE Browser
- [ ] Rich Menu image สร้างแล้ว
- [ ] Rich Menu configure แล้วใน LINE Manager
- [ ] ทดสอบกด Rich Menu buttons ทุกปุ่ม
- [ ] ทดสอบ CRUD operations ทุก feature

---

## 🎯 Next Steps

1. **Deploy ไปยัง Production Server**
   - เลือก hosting provider (Vercel, Netlify, VPS)
   - Deploy และได้ HTTPS URL

2. **Update Endpoint URL**
   - ไปที่ LINE Console
   - Update Endpoint URL ของ LIFF App

3. **ทดสอบใน LINE**
   - เปิดผ่าน LIFF URLs
   - ทดสอบทุก feature

4. **Setup Rich Menu**
   - สร้างรูป Rich Menu (2500×1686px)
   - Configure ใน LINE OA Manager
   - ใส่ LIFF URLs ทั้ง 4

5. **Go Live!**
   - เผยแพร่ Rich Menu
   - แจ้งผู้ใช้
   - Monitor logs และ errors

---

**Created:** January 5, 2025
**Last Updated:** January 5, 2025
**Status:** ✅ Ready for Testing
