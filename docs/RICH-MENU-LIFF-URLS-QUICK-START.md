# Rich Menu LIFF URLs - Quick Start Guide

## 🎯 สิ่งที่คุณต้องทำ (3 ขั้นตอน)

### ขั้นที่ 1: สร้าง LIFF Apps ใน LINE Developers Console
ไปที่ https://developers.line.biz/console/ และสร้าง LIFF App **4 อันนี้**:

| ลำดับ | ชื่อ LIFF App | Endpoint URL | Size |
|-------|--------------|--------------|------|
| 1 | Patient Profile | `https://your-domain.com/liff/patient-profile.html` | Full |
| 2 | Reminders | `https://your-domain.com/liff/reminders.html` | Full |
| 3 | Medications | `https://your-domain.com/liff/medications.html` | Full |
| 4 | Settings | `https://your-domain.com/liff/settings.html` | Full |

**⚠️ แทนที่ `your-domain.com` ด้วยโดเมนจริงของคุณ!**

หลังสร้างแล้ว คุณจะได้ **LIFF ID** (ตัวอย่าง: `1234567890-AbCdEfGh`)

---

### ขั้นที่ 2: ใส่ LIFF IDs ลงในเทมเพลตด้านล่าง

คัดลอกเทมเพลตนี้และแทนที่ `[PASTE_YOUR_LIFF_ID_HERE]` ด้วย LIFF ID จริงของคุณ:

```
✅ ปุ่มที่ 1 (📝 บันทึกกิจกรรม)
ประเภท: Message
ข้อความ: 📝 บันทึกกิจกรรม
(ไม่ต้องใส่ URL)

✅ ปุ่มที่ 2 (📊 รายงาน)
ประเภท: Message
ข้อความ: 📊 ดูรายงาน
(ไม่ต้องใส่ URL)

✅ ปุ่มที่ 3 (👤 ข้อมูลผู้ป่วย)
ประเภท: URI
URL: https://liff.line.me/[PASTE_PATIENT_PROFILE_LIFF_ID_HERE]

✅ ปุ่มที่ 4 (🔔 เตือน)
ประเภท: URI
URL: https://liff.line.me/[PASTE_REMINDERS_LIFF_ID_HERE]

✅ ปุ่มที่ 5 (💊 ยา)
ประเภท: URI
URL: https://liff.line.me/[PASTE_MEDICATIONS_LIFF_ID_HERE]

✅ ปุ่มที่ 6 (⚙️ ตั้งค่า)
ประเภท: URI
URL: https://liff.line.me/[PASTE_SETTINGS_LIFF_ID_HERE]
```

---

### ขั้นที่ 3: ไปตั้งค่าใน LINE Official Account Manager

1. เข้า https://manager.line.biz/
2. เลือก Official Account ของคุณ
3. ไปที่ **Home > Rich menus**
4. กด **Create rich menu**
5. อัปโหลดรูปภาพ Rich Menu (ขนาด 2500×1686 pixels)
6. **กำหนด Action สำหรับแต่ละปุ่ม** ตามเทมเพลตข้างบน

---

## 📝 ตัวอย่างที่กรอกแล้ว (Example)

สมมติว่าคุณสร้าง LIFF Apps แล้วได้ LIFF IDs ดังนี้:

```
✅ ปุ่มที่ 1 (📝 บันทึกกิจกรรม)
ประเภท: Message
ข้อความ: 📝 บันทึกกิจกรรม

✅ ปุ่มที่ 2 (📊 รายงาน)
ประเภท: Message
ข้อความ: 📊 ดูรายงาน

✅ ปุ่มที่ 3 (👤 ข้อมูลผู้ป่วย)
ประเภท: URI
URL: https://liff.line.me/1234567890-AbCdEfGh

✅ ปุ่มที่ 4 (🔔 เตือน)
ประเภท: URI
URL: https://liff.line.me/1234567890-IjKlMnOp

✅ ปุ่มที่ 5 (💊 ยา)
ประเภท: URI
URL: https://liff.line.me/1234567890-QrStUvWx

✅ ปุ่มที่ 6 (⚙️ ตั้งค่า)
ประเภท: URI
URL: https://liff.line.me/1234567890-YzAbCdEf
```

---

## ⚠️ สิ่งสำคัญที่ต้องจำ

### ✅ LIFF URL ที่ถูกต้อง:
```
https://liff.line.me/1234567890-AbCdEfGh
```
- เริ่มด้วย `https://liff.line.me/`
- ตามด้วย LIFF ID
- **ไม่มีพาธไฟล์** (ไม่ต้องใส่ `/liff/patient-profile.html`)

### ❌ LIFF URL ที่ผิด:
```
https://liff.line.me/1234567890-AbCdEfGh/liff/patient-profile.html  ❌ ผิด!
https://your-domain.com/liff/patient-profile.html  ❌ ผิด! (นี่คือ Endpoint URL)
```

---

## 🎨 Rich Menu Image Layout

รูป Rich Menu ขนาด **2500×1686 pixels** แบ่งเป็น 6 ปุ่ม:

```
┌──────────────────┬──────────────────┬──────────────────┐
│  ปุ่ม 1 (833px)  │  ปุ่ม 2 (833px)  │  ปุ่ม 3 (833px)  │
│                  │                  │                  │
│  📝 บันทึก        │   📊 รายงาน       │  👤 ข้อมูลผู้ป่วย  │
│  กิจกรรม         │                  │                  │
│  (Message)       │  (Message)       │  (LIFF)          │
│                  │                  │                  │
│  843px สูง       │                  │                  │
├──────────────────┼──────────────────┼──────────────────┤
│  ปุ่ม 4 (833px)  │  ปุ่ม 5 (833px)  │  ปุ่ม 6 (833px)  │
│                  │                  │                  │
│  🔔 เตือน         │   💊 ยา          │  ⚙️ ตั้งค่า       │
│                  │                  │                  │
│  (LIFF)          │  (LIFF)          │  (LIFF)          │
│                  │                  │                  │
│  843px สูง       │                  │                  │
└──────────────────┴──────────────────┴──────────────────┘
```

**พิกัดแต่ละปุ่ม (สำหรับกำหนด Action Area):**

| ปุ่ม | X | Y | Width | Height | Action Type | URL/Message |
|------|---|---|-------|--------|-------------|-------------|
| 1 | 0 | 0 | 833 | 843 | Message | `📝 บันทึกกิจกรรม` |
| 2 | 834 | 0 | 833 | 843 | Message | `📊 ดูรายงาน` |
| 3 | 1667 | 0 | 833 | 843 | URI | `https://liff.line.me/[LIFF_ID]` |
| 4 | 0 | 843 | 833 | 843 | URI | `https://liff.line.me/[LIFF_ID]` |
| 5 | 834 | 843 | 833 | 843 | URI | `https://liff.line.me/[LIFF_ID]` |
| 6 | 1667 | 843 | 833 | 843 | URI | `https://liff.line.me/[LIFF_ID]` |

---

## ✅ Checklist

- [ ] อัปโหลดไฟล์ LIFF (4 ไฟล์) ไปที่ web server
  - [ ] `patient-profile.html`
  - [ ] `reminders.html`
  - [ ] `medications.html`
  - [ ] `settings.html`

- [ ] แทนที่ Supabase URL และ API key ในทุกไฟล์ LIFF

- [ ] สร้าง LIFF Apps 4 อัน ใน LINE Developers Console
  - [ ] Patient Profile → ได้ LIFF ID: `________________`
  - [ ] Reminders → ได้ LIFF ID: `________________`
  - [ ] Medications → ได้ LIFF ID: `________________`
  - [ ] Settings → ได้ LIFF ID: `________________`

- [ ] สร้างรูปภาพ Rich Menu (2500×1686px)

- [ ] ไปตั้งค่าใน LINE OA Manager
  - [ ] อัปโหลดรูปภาพ
  - [ ] กำหนด Action สำหรับปุ่ม 1 (Message)
  - [ ] กำหนด Action สำหรับปุ่ม 2 (Message)
  - [ ] กำหนด Action สำหรับปุ่ม 3 (LIFF URL)
  - [ ] กำหนด Action สำหรับปุ่ม 4 (LIFF URL)
  - [ ] กำหนด Action สำหรับปุ่ม 5 (LIFF URL)
  - [ ] กำหนด Action สำหรับปุ่ม 6 (LIFF URL)

- [ ] เผยแพร่ Rich Menu

- [ ] ทดสอบในแชท LINE จริง

---

## 🔗 ลิงก์ที่เกี่ยวข้อง

- **LINE Developers Console:** https://developers.line.biz/console/
- **LINE Official Account Manager:** https://manager.line.biz/
- **LIFF Documentation:** https://developers.line.biz/en/docs/liff/overview/

---

## 💡 Tips

1. **LIFF ID จะอยู่ในรูปแบบ:** `1234567890-AbCdEfGh` (10 หลัก + ขีด + 8 ตัวอักษร)
2. **Endpoint URL ต้องเป็น HTTPS** (ไม่ใช่ HTTP)
3. **Rich Menu Size ต้องเป็น Full** สำหรับทุก LIFF App
4. **ทดสอบบน Mobile เท่านั้น** - LIFF ไม่ทำงานบน LINE Desktop
5. **ใช้รูป PNG** สำหรับ Rich Menu Image (JPG อาจเบลอ)

---

**Created:** January 5, 2025
**Version:** 1.0
**For:** Duulair Hybrid - Phase 4.1 Rich Menu Setup
