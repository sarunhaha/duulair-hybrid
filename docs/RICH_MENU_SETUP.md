# Rich Menu Setup Guide

**Date:** 2025-11-03
**Status:** Ready to Deploy
**LIFF ID:** `2008278683-5k69jxNq`

---

## 📊 Rich Menu Layout

```
┌──────────────────┬──────────────────┬──────────────────┐
│  📝 บันทึกสุขภาพ  │   📊 ดูรายงาน     │  👤 โปรไฟล์       │
│  Message         │  Message         │  URI             │
├──────────────────┼──────────────────┼──────────────────┤
│  📝 ลงทะเบียน     │   📦 แพ็คเกจ      │  ❓ ช่วยเหลือ     │
│  URI             │  Message         │  Message         │
└──────────────────┴──────────────────┴──────────────────┘
```

---

## 🎯 Button Actions

| Position | Label | Action Type | Action |
|----------|-------|-------------|--------|
| Top-Left | 📝 บันทึกสุขภาพ | **Message** | "บันทึกสุขภาพ" → Quick Reply (5 options) |
| Top-Center | 📊 ดูรายงาน | **Message** | "ดูรายงาน" → Quick Reply (3 options) |
| Top-Right | 👤 โปรไฟล์ | **URI** | `https://liff.line.me/2008278683-5k69jxNq/dashboard.html` |
| Bottom-Left | 📝 ลงทะเบียน | **URI** | `https://liff.line.me/2008278683-5k69jxNq/index.html` |
| Bottom-Center | 📦 แพ็คเกจ | **Message** | "แพ็คเกจ" → Flex Message (pricing) |
| Bottom-Right | ❓ ช่วยเหลือ | **Message** | "ช่วยเหลือ" → Flex Message (FAQ) |

---

## 🛠️ Setup Methods

### **Method 1: Via LINE Developers Console** (แนะนำ - ง่ายที่สุด)

#### Step 1: Create Rich Menu

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Provider: **Duulair**
3. เลือก Channel: **Duulair Messaging API**
4. ไปที่แท็บ **"Rich menus"**
5. คลิก **"Create"**

#### Step 2: Basic Settings

```
Name: Duulair Main Menu
Chat bar text: เมนู
Display period: Always
Selected by default: Yes
```

#### Step 3: Template Selection

```
Template: 2x3 (6 areas)
Size: 2500 x 1686
```

#### Step 4: Upload Image

**Option A: ใช้รูปตัวอย่าง**
- ดาวน์โหลด template จาก LINE
- แก้ไข text ให้ตรงกับ label ด้านบน
- Upload

**Option B: ให้ Claude สร้าง** (ต้องใช้ AI image generator)
- ขนาด: 2500 x 1686 px
- Layout: 2 แถว x 3 คอลัมน์
- ใส่ text ตาม label

#### Step 5: Configure Actions

**Area 1 (Top-Left):**
```
Type: Message
Text: บันทึกสุขภาพ
```

**Area 2 (Top-Center):**
```
Type: Message
Text: ดูรายงาน
```

**Area 3 (Top-Right):**
```
Type: URI
URI: https://liff.line.me/2008278683-5k69jxNq/dashboard.html
```

**Area 4 (Bottom-Left):**
```
Type: URI
URI: https://liff.line.me/2008278683-5k69jxNq/index.html
```

**Area 5 (Bottom-Center):**
```
Type: Message
Text: แพ็คเกจ
```

**Area 6 (Bottom-Right):**
```
Type: Message
Text: ช่วยเหลือ
```

#### Step 6: Save & Activate

1. คลิก **"Save"**
2. คลิก **"Set as default"** (ทำให้ทุก user เห็น Rich Menu นี้)

---

### **Method 2: Via API** (สำหรับ automation)

#### Step 1: Create Rich Menu

```bash
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @docs/rich-menu-config.json
```

Response:
```json
{
  "richMenuId": "richmenu-XXXXXXXXXXXXX"
}
```

#### Step 2: Upload Image

```bash
curl -X POST https://api-data.line.me/v2/bot/richmenu/richmenu-XXXXXXXXXXXXX/content \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-image.png
```

#### Step 3: Set as Default

```bash
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/richmenu-XXXXXXXXXXXXX \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

---

## 📐 Rich Menu Image Specifications

**Required:**
- Size: **2500 x 1686 pixels**
- Format: PNG or JPEG
- Max file size: 1 MB

**Grid Layout (2x3):**
```
┌─────────┬─────────┬─────────┐
│  833px  │  833px  │  834px  │  = 2500px total width
│         │         │         │
│  843px  │  843px  │  843px  │
├─────────┼─────────┼─────────┤
│  833px  │  833px  │  834px  │
│         │         │         │
│  843px  │  843px  │  843px  │
└─────────┴─────────┴─────────┘
   = 1686px total height
```

**Design Tips:**
- ใช้ฟอนต์ใหญ่ชัด (32px+)
- สีตัดกัน (พื้นขาวตัวดำ หรือกลับกัน)
- ใส่ emoji ให้เห็นชัด
- เหมาะกับผู้สูงอายุ

---

## 🔄 Switch Rich Menu Dynamically (Future)

สำหรับอนาคต: สร้าง 2 เวอร์ชัน

**Rich Menu A: สำหรับ User ใหม่** (ยังไม่ลงทะเบียน)
- มีปุ่ม "ลงทะเบียน"

**Rich Menu B: สำหรับ User ลงทะเบียนแล้ว**
- แทนที่ด้วยปุ่ม "โปรไฟล์" + "รหัสเชื่อมต่อ"

```typescript
// Switch after registration
async function switchToRegisteredMenu(userId: string) {
  const richMenuId = 'richmenu-XXXXX-registered';
  await lineClient.linkRichMenuToUser(userId, richMenuId);
}
```

---

## ✅ Testing Checklist

### After Setup:
- [ ] เปิด LINE bot
- [ ] เห็น Rich Menu ล่างสุด
- [ ] กด "โปรไฟล์" → เปิด LIFF dashboard
- [ ] กด "ลงทะเบียน" → เปิด LIFF registration
- [ ] กด "บันทึกสุขภาพ" → เห็น Quick Reply 5 ตัวเลือก
- [ ] กด "ดูรายงาน" → เห็น Quick Reply 3 ตัวเลือก
- [ ] กด "แพ็คเกจ" → เห็น Flex Message
- [ ] กด "ช่วยเหลือ" → เห็น Flex Message

---

## 📝 Related Tasks

- **TASK-002:** Implement Rich Menu responses (Quick Reply + Flex Messages)
- **TASK-003:** Health logging LIFF pages

---

## 🔗 Resources

- [LINE Rich Menu Documentation](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [Rich Menu Image Creator](https://developers.line.biz/console/richmenu-creator/)
- Config file: `docs/rich-menu-config.json`

---

**Created:** 2025-11-03
**Version:** 1.0.0
