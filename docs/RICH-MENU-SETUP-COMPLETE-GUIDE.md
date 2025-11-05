# Rich Menu Setup - Complete Guide

## Overview

คู่มือนี้จะแนะนำการ setup Rich Menu สำหรับ Duulair แบบ step-by-step ครบทุกขั้นตอน

**Rich Menu แบบใหม่:** Caregiver-Focused (5 tabs)

---

## 📱 Rich Menu Layout

```
┌──────────────────┬──────────────────┬──────────────────┐
│  📝 บันทึก        │   📊 รายงาน       │  👤 ข้อมูลผู้ป่วย  │
│  กิจกรรม         │  วันนี้/สัปดาห์   │  ดู/แก้ไข        │
│  (Message)       │  (Message)       │  (LIFF) ✨        │
├──────────────────┼──────────────────┼──────────────────┤
│  🔔 เตือน         │   💊 ยา          │  ⚙️ ตั้งค่า       │
│  ดู/แก้ไขเวลา    │  รายการยา        │  กลุ่ม/แจ้งเตือน  │
│  (LIFF) ✨        │  (LIFF) ✨        │  (LIFF) ✨        │
└──────────────────┴──────────────────┴──────────────────┘
```

**Size:** 2500 × 1686 pixels (2:1 ratio)

---

## 🎯 Button Configuration

| # | ปุ่ม | ประเภท | Action | LIFF File | LIFF URL Required? |
|---|------|--------|--------|-----------|-------------------|
| 1 | 📝 บันทึกกิจกรรม | **Message** | Send text "📝 บันทึกกิจกรรม" | - | ❌ No |
| 2 | 📊 รายงาน | **Message** | Send text "📊 ดูรายงาน" | - | ❌ No |
| 3 | 👤 ข้อมูลผู้ป่วย | **LIFF** ✨ | Open LIFF | `patient-profile.html` | ✅ Yes |
| 4 | 🔔 เตือน | **LIFF** ✨ | Open LIFF | `reminders.html` | ✅ Yes |
| 5 | 💊 ยา | **LIFF** ✨ | Open LIFF | `medications.html` | ✅ Yes |
| 6 | ⚙️ ตั้งค่า | **LIFF** ✨ | Open LIFF | `settings.html` | ✅ Yes |

---

## 📋 ขั้นตอนที่ 1: เตรียม LIFF Files

### 1.1 อัพโหลด LIFF Files ไปยัง Web Server

LIFF files ทั้งหมดอยู่ใน `public/liff/`:

```bash
# ตัวอย่าง: Upload to server
scp public/liff/*.html user@your-server.com:/var/www/duulair/liff/

# หรือ deploy to Vercel/Netlify
vercel deploy public/liff/
```

**เช็คว่า files พร้อมใช้งาน:**
```
✅ https://your-domain.com/liff/patient-profile.html
✅ https://your-domain.com/liff/reminders.html
✅ https://your-domain.com/liff/medications.html
✅ https://your-domain.com/liff/settings.html
```

### 1.2 อัพเดท Supabase Config ใน LIFF Files

แก้ไขไฟล์ทั้ง 4 files:

```javascript
// เปลี่ยนจาก
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// เป็น
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## 📋 ขั้นตอนที่ 2: สร้าง LIFF Apps ใน LINE Console

### 2.1 เข้า LINE Developers Console

1. ไปที่ https://developers.line.biz/console/
2. เลือก Provider ของคุณ
3. เลือก Channel (Messaging API) ของ Duulair

### 2.2 สร้าง LIFF App ทั้ง 4 Apps

#### **LIFF App #1: Patient Profile**

1. ไปที่แท็บ **LIFF** → คลิก **Add**
2. กรอกข้อมูล:
   ```
   LIFF app name:     Duulair - Patient Profile
   Size:              Full
   Endpoint URL:      https://your-domain.com/liff/patient-profile.html
   Scope:             profile, openid
   Bot link feature:  On (Normal)
   ```
3. คลิก **Add**
4. **คัดลอก LIFF ID** → เช่น `1234567890-AbCdEfGh`

#### **LIFF App #2: Reminders**

1. คลิก **Add** อีกครั้ง
2. กรอกข้อมูล:
   ```
   LIFF app name:     Duulair - Reminders
   Size:              Full
   Endpoint URL:      https://your-domain.com/liff/reminders.html
   Scope:             profile, openid
   Bot link feature:  On (Normal)
   ```
3. คลิก **Add**
4. **คัดลอก LIFF ID** → เช่น `1234567890-IjKlMnOp`

#### **LIFF App #3: Medications**

1. คลิก **Add** อีกครั้ง
2. กรอกข้อมูล:
   ```
   LIFF app name:     Duulair - Medications
   Size:              Full
   Endpoint URL:      https://your-domain.com/liff/medications.html
   Scope:             profile, openid
   Bot link feature:  On (Normal)
   ```
3. คลิก **Add**
4. **คัดลอก LIFF ID** → เช่น `1234567890-QrStUvWx`

#### **LIFF App #4: Settings**

1. คลิก **Add** อีกครั้ง
2. กรอกข้อมูล:
   ```
   LIFF app name:     Duulair - Settings
   Size:              Full
   Endpoint URL:      https://your-domain.com/liff/settings.html
   Scope:             profile, openid
   Bot link feature:  On (Normal)
   ```
3. คลิก **Add**
4. **คัดลอก LIFF ID** → เช่น `1234567890-YzAbCdEf`

### 2.3 เก็บ LIFF IDs ไว้

สร้างไฟล์ `LIFF_IDS.txt`:

```
LIFF_ID_PATIENT_PROFILE=1234567890-AbCdEfGh
LIFF_ID_REMINDERS=1234567890-IjKlMnOp
LIFF_ID_MEDICATIONS=1234567890-QrStUvWx
LIFF_ID_SETTINGS=1234567890-YzAbCdEf
```

---

## 📋 ขั้นตอนที่ 3: อัพเดท Rich Menu JSON

### 3.1 เปิดไฟล์ `docs/rich-menu-group.json`

### 3.2 แทนที่ `LIFF_ID` ด้วย LIFF ID จริง

**ก่อนแก้:**
```json
{
  "bounds": {"x": 1667, "y": 0, "width": 833, "height": 843},
  "action": {
    "type": "uri",
    "uri": "https://liff.line.me/LIFF_ID/patient-profile.html"
  }
}
```

**หลังแก้:**
```json
{
  "bounds": {"x": 1667, "y": 0, "width": 833, "height": 843},
  "action": {
    "type": "uri",
    "uri": "https://liff.line.me/1234567890-AbCdEfGh/patient-profile.html"
  }
}
```

### 3.3 Full Updated JSON

```json
{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": true,
  "name": "Duulair Group Menu - Caregiver",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": {"x": 0, "y": 0, "width": 833, "height": 843},
      "action": {
        "type": "message",
        "text": "📝 บันทึกกิจกรรม"
      }
    },
    {
      "bounds": {"x": 834, "y": 0, "width": 833, "height": 843},
      "action": {
        "type": "message",
        "text": "📊 ดูรายงาน"
      }
    },
    {
      "bounds": {"x": 1667, "y": 0, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/1234567890-AbCdEfGh"
      }
    },
    {
      "bounds": {"x": 0, "y": 843, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/1234567890-IjKlMnOp"
      }
    },
    {
      "bounds": {"x": 834, "y": 843, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/1234567890-QrStUvWx"
      }
    },
    {
      "bounds": {"x": 1667, "y": 843, "width": 833, "height": 843},
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/1234567890-YzAbCdEf"
      }
    }
  ]
}
```

**⚠️ สำคัญ:** LIFF URI format คือ `https://liff.line.me/{LIFF_ID}` (ไม่ต้องใส่ path ของ HTML file)

---

## 📋 ขั้นตอนที่ 4: สร้าง Rich Menu Image

### 4.1 Design Specifications

**ขนาด:** 2500 × 1686 pixels
**Format:** PNG (แนะนำ) หรือ JPEG
**Max file size:** 1 MB
**DPI:** 72-144 DPI

### 4.2 Button Areas

แต่ละปุ่มมีขนาด **833 × 843 pixels**

```
Row 1 (Top):
  Button 1: x=0,    y=0,   w=833, h=843  (📝 บันทึก)
  Button 2: x=834,  y=0,   w=833, h=843  (📊 รายงาน)
  Button 3: x=1667, y=0,   w=833, h=843  (👤 ข้อมูลผู้ป่วย)

Row 2 (Bottom):
  Button 4: x=0,    y=843, w=833, h=843  (🔔 เตือน)
  Button 5: x=834,  y=843, w=833, h=843  (💊 ยา)
  Button 6: x=1667, y=843, w=833, h=843  (⚙️ ตั้งค่า)
```

### 4.3 Design Elements

**Colors:**
- Primary: `#667eea` (Purple)
- Secondary: `#4facfe` (Blue)
- Success: `#4caf50` (Green)
- Text: `#333333` (Dark Gray)

**Fonts:**
- Thai: Sarabun Bold
- Icon size: 80-100px
- Label size: 28-32px

### 4.4 Design Tools

- **Figma** (แนะนำ): https://figma.com
- **Canva**: https://canva.com
- **Photoshop/Illustrator**

### 4.5 Export Image

```bash
# บันทึกเป็น
rich-menu-duulair-caregiver.png

# ตรวจสอบ
# - Size: 2500x1686 px ✓
# - Format: PNG ✓
# - File size: < 1 MB ✓
```

---

## 📋 ขั้นตอนที่ 5: Upload Rich Menu via API

### 5.1 เตรียม Channel Access Token

1. ไปที่ LINE Developers Console
2. ไปที่แท็บ **Messaging API**
3. Scroll ลงไปหา **Channel access token**
4. คลิก **Issue** (ถ้ายังไม่มี)
5. **คัดลอก Token** → ยาวมาก ~ 170 ตัวอักษร

```bash
# บันทึกไว้ใน .env หรือ notepad
CHANNEL_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI...
```

### 5.2 Create Rich Menu (API)

```bash
# Step 1: Create rich menu
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H 'Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d @docs/rich-menu-group.json

# Response:
# {
#   "richMenuId": "richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# }
```

**บันทึก richMenuId ที่ได้!**

### 5.3 Upload Image to Rich Menu

```bash
# Step 2: Upload image
curl -X POST https://api-data.line.me/v2/bot/richmenu/richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx/content \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-duulair-caregiver.png

# Response:
# {} (empty response = success)
```

### 5.4 Set as Default Rich Menu

```bash
# Step 3: Set as default for all users
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"

# Response:
# {} (empty response = success)
```

---

## 📋 ขั้นตอนที่ 6: Verify Setup

### 6.1 Test Rich Menu

1. เปิด LINE app
2. ไปที่แชทกับบอท Duulair
3. กดปุ่ม **≡** (menu icon) ที่มุมล่างซ้าย
4. Rich menu ควรแสดงขึ้นมา

### 6.2 Test Message Commands

**กดปุ่ม "📝 บันทึกกิจกรรม":**
- ✅ ส่งข้อความ "📝 บันทึกกิจกรรม"
- ✅ บอทตอบกลับด้วย Quick Reply (5 ตัวเลือก)

**กดปุ่ม "📊 รายงาน":**
- ✅ ส่งข้อความ "📊 ดูรายงาน"
- ✅ บอทตอบกลับด้วย Quick Reply (3 ตัวเลือก)

### 6.3 Test LIFF Apps

**กดปุ่ม "👤 ข้อมูลผู้ป่วย":**
- ✅ เปิด LIFF app (patient-profile.html)
- ✅ แสดง 3 tabs: ข้อมูลทั่วไป, ทางการแพทย์, ฉุกเฉิน
- ✅ สามารถแก้ไขข้อมูลได้

**กดปุ่ม "🔔 เตือน":**
- ✅ เปิด LIFF app (reminders.html)
- ✅ แสดงรายการเตือน
- ✅ สามารถเพิ่ม/แก้ไข/ลบได้

**กดปุ่ม "💊 ยา":**
- ✅ เปิด LIFF app (medications.html)
- ✅ แสดงรายการยา
- ✅ สามารถจัดการได้

**กดปุ่ม "⚙️ ตั้งค่า":**
- ✅ เปิด LIFF app (settings.html)
- ✅ แสดง 5 tabs: กลุ่ม, แจ้งเตือน, รายงาน, แพ็คเกจ, ช่วยเหลือ
- ✅ สามารถตั้งค่าได้

---

## 📋 ขั้นตอนที่ 7 (Optional): Setup via LINE Manager

### 7.1 เข้า LINE Official Account Manager

1. ไปที่ https://manager.line.biz/
2. เลือก Official Account ของ Duulair
3. ไปที่ **Home** → **Rich menus**

### 7.2 Create Rich Menu (GUI)

1. คลิก **Create**
2. กรอกข้อมูล:
   ```
   Title:              Duulair - Caregiver Menu
   Display period:     Always display
   Chat bar text:      เมนู
   ```
3. **Upload image** (rich-menu-duulair-caregiver.png)
4. **Set template:** 2 rows × 3 columns

### 7.3 Configure Buttons

**Button 1 (Top-Left):**
- Type: Message
- Text: `📝 บันทึกกิจกรรม`

**Button 2 (Top-Center):**
- Type: Message
- Text: `📊 ดูรายงาน`

**Button 3 (Top-Right):**
- Type: Link
- URL: `https://liff.line.me/1234567890-AbCdEfGh`

**Button 4 (Bottom-Left):**
- Type: Link
- URL: `https://liff.line.me/1234567890-IjKlMnOp`

**Button 5 (Bottom-Center):**
- Type: Link
- URL: `https://liff.line.me/1234567890-QrStUvWx`

**Button 6 (Bottom-Right):**
- Type: Link
- URL: `https://liff.line.me/1234567890-YzAbCdEf`

### 7.4 Save & Apply

1. คลิก **Save**
2. คลิก **Apply** เพื่อ activate

---

## 🔧 Troubleshooting

### Issue 1: Rich Menu ไม่แสดง

**วิธีแก้:**
1. ตรวจสอบว่า Rich Menu ถูก set เป็น default แล้ว
2. ลองลบ Rich Menu เก่าออกก่อน
3. ลอง unfollow → follow บอทใหม่

```bash
# ดู Rich Menu ที่มี
curl -X GET https://api.line.me/v2/bot/richmenu/list \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"

# ลบ Rich Menu เก่า
curl -X DELETE https://api.line.me/v2/bot/richmenu/richmenu-OLD_ID \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### Issue 2: LIFF App ไม่เปิด

**วิธีแก้:**
1. ตรวจสอบ LIFF URL ว่าใช้ `https://liff.line.me/{LIFF_ID}` (ไม่ใส่ path)
2. ตรวจสอบว่า LIFF App มี **Endpoint URL** ถูกต้อง
3. ลองเปิด Endpoint URL ใน browser ตรง ๆ

### Issue 3: LIFF Loading แล้วค้าง

**วิธีแก้:**
1. เช็ค JavaScript console ใน LIFF app
2. ตรวจสอบ Supabase URL และ key
3. ตรวจสอบว่า LIFF scope มี `openid` และ `profile`

### Issue 4: Image บิดเบี้ยว

**วิธีแก้:**
1. ตรวจสอบขนาดภาพ: ต้อง 2500×1686 px เท่านั้น
2. ใช้ PNG format
3. ลอง upload image ใหม่

---

## 📊 Rich Menu Management Commands

### Get All Rich Menus

```bash
curl -X GET https://api.line.me/v2/bot/richmenu/list \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### Get Specific Rich Menu

```bash
curl -X GET https://api.line.me/v2/bot/richmenu/richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### Delete Rich Menu

```bash
curl -X DELETE https://api.line.me/v2/bot/richmenu/richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### Get User's Rich Menu

```bash
curl -X GET https://api.line.me/v2/bot/user/{userId}/richmenu \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### Link Rich Menu to Specific User

```bash
curl -X POST https://api.line.me/v2/bot/user/{userId}/richmenu/richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### Unlink Rich Menu from User

```bash
curl -X DELETE https://api.line.me/v2/bot/user/{userId}/richmenu \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

---

## 📝 Checklist

### Before Setup:
- [ ] LIFF files deployed to web server
- [ ] Supabase config updated in all LIFF files
- [ ] Rich Menu image designed (2500×1686px PNG)
- [ ] Channel Access Token obtained

### LIFF Setup:
- [ ] LIFF App #1 created (Patient Profile)
- [ ] LIFF App #2 created (Reminders)
- [ ] LIFF App #3 created (Medications)
- [ ] LIFF App #4 created (Settings)
- [ ] All LIFF IDs copied and saved

### Rich Menu Setup:
- [ ] rich-menu-group.json updated with LIFF IDs
- [ ] Rich Menu created via API
- [ ] Image uploaded to Rich Menu
- [ ] Set as default Rich Menu

### Testing:
- [ ] Rich Menu displays in LINE app
- [ ] Message commands work (บันทึก, รายงาน)
- [ ] LIFF apps open correctly
- [ ] Can edit data in LIFF apps
- [ ] Data saves to Supabase

---

## 🎯 Summary

### LIFF URLs Format

```
ปุ่ม                LIFF ID                          Full LIFF URL
────────────────────────────────────────────────────────────────────
👤 ข้อมูลผู้ป่วย    1234567890-AbCdEfGh     →  https://liff.line.me/1234567890-AbCdEfGh
🔔 เตือน           1234567890-IjKlMnOp     →  https://liff.line.me/1234567890-IjKlMnOp
💊 ยา              1234567890-QrStUvWx     →  https://liff.line.me/1234567890-QrStUvWx
⚙️ ตั้งค่า         1234567890-YzAbCdEf     →  https://liff.line.me/1234567890-YzAbCdEf
```

### Command Summary

```bash
# 1. Create Rich Menu
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d @docs/rich-menu-group.json

# 2. Upload Image
curl -X POST https://api-data.line.me/v2/bot/richmenu/RICHMENU_ID/content \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-duulair-caregiver.png

# 3. Set as Default
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/RICHMENU_ID \
  -H "Authorization: Bearer TOKEN"
```

---

## 📚 Resources

- [LINE Messaging API - Rich Menu](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/overview/)
- [Rich Menu Design Guide](https://developers.line.biz/en/docs/messaging-api/rich-menu-design-guide/)
- [Figma Rich Menu Template](https://www.figma.com/community/search?q=line%20rich%20menu)

---

**Last Updated:** January 5, 2025
**Version:** 2.0 (Caregiver-Focused)
**Author:** Claude Code (Sonnet 4.5)
