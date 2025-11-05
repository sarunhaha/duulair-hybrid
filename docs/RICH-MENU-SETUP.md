# Rich Menu Setup Guide

## Overview

This guide explains how to create and set up the Rich Menu for Duulair bot.

## Rich Menu Design

### Layout: 2 rows × 3 columns
**Size:** 2500 × 1686 pixels

```
┌──────────────┬──────────────┬──────────────┐
│              │              │              │
│  📝 บันทึก   │  🏠 แดชบอร์ด │  📊 รายงาน   │
│  กิจกรรม     │              │              │
│              │              │              │
├──────────────┼──────────────┼──────────────┤
│              │              │              │
│  ⚙️ ตั้งค่า  │  ❓ วิธีใช้   │  📞 ฉุกเฉิน  │
│              │              │              │
│              │              │              │
└──────────────┴──────────────┴──────────────┘
```

### Button Actions

1. **📝 บันทึกกิจกรรม** (Top-Left)
   - Type: Message
   - Text: "📝 บันทึกกิจกรรม"
   - Opens Quick Reply with activity options

2. **🏠 แดชบอร์ด** (Top-Center)
   - Type: URI
   - URL: `https://liff.line.me/{LIFF_ID}/group-dashboard.html`
   - Opens LIFF dashboard

3. **📊 รายงาน** (Top-Right)
   - Type: Message
   - Text: "📊 ดูรายงาน"
   - Shows report options

4. **⚙️ ตั้งค่า** (Bottom-Left)
   - Type: Message
   - Text: "⚙️ ตั้งค่า"
   - Shows settings menu

5. **❓ วิธีใช้งาน** (Bottom-Center)
   - Type: Message
   - Text: "❓ วิธีใช้งาน"
   - Shows help/instructions

6. **📞 ติดต่อฉุกเฉิน** (Bottom-Right)
   - Type: Message
   - Text: "📞 ติดต่อฉุกเฉิน"
   - Shows emergency contacts

## Creating Rich Menu Image

### Design Requirements:
- **Size:** 2500 × 1686 pixels
- **Format:** PNG or JPEG
- **Max file size:** 1 MB
- **Color:** Use brand colors (#4CAF50 primary)

### Design Tools:
- Figma (recommended)
- Canva
- Adobe Illustrator
- Photoshop

### Template Elements:

Each button area: 833 × 843 pixels

```css
/* Top Row */
Button 1: x=0,    y=0,    w=833, h=843
Button 2: x=834,  y=0,    w=833, h=843
Button 3: x=1667, y=0,    w=833, h=843

/* Bottom Row */
Button 4: x=0,    y=843,  w=833, h=843
Button 5: x=834,  y=843,  w=833, h=843
Button 6: x=1667, y=843,  w=833, h=843
```

### Color Scheme:
- Primary: #4CAF50 (Green)
- Primary Dark: #388E3C
- Primary Light: #C8E6C9
- Text: #212121
- Background: #FFFFFF

### Typography:
- Font: Sarabun or Noto Sans Thai
- Button Label: 48-60px, Bold
- Icon: 80-100px

## Setup Steps

### Step 1: Create Rich Menu Image

1. Create image following design requirements
2. Export as PNG (recommended) or JPEG
3. Ensure file size < 1 MB

### Step 2: Upload Rich Menu via LINE Official Account Manager

#### Option A: Using LINE Official Account Manager (GUI)

1. Go to [LINE Official Account Manager](https://manager.line.biz/)
2. Select your bot account
3. Go to **Home** → **Rich menus**
4. Click **Create**
5. Fill in details:
   - **Title:** Duulair Group Menu
   - **Chat bar text:** เมนู
   - **Display period:** Always display
6. **Upload image** (2500 × 1686 px)
7. **Set template:** 2 rows × 3 columns
8. **Set actions** for each button:
   - Button 1: Message → "📝 บันทึกกิจกรรม"
   - Button 2: Link → `https://liff.line.me/{LIFF_ID}/group-dashboard.html`
   - Button 3: Message → "📊 ดูรายงาน"
   - Button 4: Message → "⚙️ ตั้งค่า"
   - Button 5: Message → "❓ วิธีใช้งาน"
   - Button 6: Message → "📞 ติดต่อฉุกเฉิน"
9. Click **Save**
10. Click **Apply** to activate

#### Option B: Using LINE Messaging API (Programmatic)

1. Upload image first:

```bash
curl -X POST https://api-data.line.me/v2/bot/richmenu/upload \
  -H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-image.png
```

2. Create rich menu:

```bash
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H 'Authorization: Bearer {CHANNEL_ACCESS_TOKEN}' \
  -H 'Content-Type: application/json' \
  -d @docs/rich-menu-group.json
```

Response:
```json
{
  "richMenuId": "richmenu-xxxxxxxxxxxxx"
}
```

3. Attach image to rich menu:

```bash
curl -X POST https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content \
  -H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-image.png
```

4. Set as default:

```bash
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/{richMenuId} \
  -H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}"
```

### Step 3: Test Rich Menu

1. Add bot as friend (if not already)
2. Open chat with bot
3. Tap **menu icon** at bottom (≡)
4. Rich menu should appear
5. Test each button:
   - ✅ Messages trigger commands
   - ✅ Dashboard opens LIFF
   - ✅ Quick Replies work

## Different Rich Menus for Different Contexts

### Option 1: Same Menu for All Users (Current)
- Simple to manage
- One menu for both 1:1 and groups

### Option 2: Context-Specific Menus (Future)

#### Rich Menu for Groups:
- Focus on group activities
- Member management
- Group reports

#### Rich Menu for 1:1:
- Focus on personal activities
- Individual settings
- Personal reports

To implement:
```typescript
// In webhook handler
if (sourceType === 'group') {
  // Use group rich menu
  await lineClient.linkRichMenuToUser(userId, GROUP_RICHMENU_ID);
} else {
  // Use 1:1 rich menu
  await lineClient.linkRichMenuToUser(userId, PERSONAL_RICHMENU_ID);
}
```

## Rich Menu Management

### Get List of Rich Menus
```bash
curl -X GET https://api.line.me/v2/bot/richmenu/list \
  -H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}"
```

### Delete Rich Menu
```bash
curl -X DELETE https://api.line.me/v2/bot/richmenu/{richMenuId} \
  -H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}"
```

### Get User's Current Rich Menu
```bash
curl -X GET https://api.line.me/v2/bot/user/{userId}/richmenu \
  -H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}"
```

### Link Rich Menu to Specific User
```bash
curl -X POST https://api.line.me/v2/bot/user/{userId}/richmenu/{richMenuId} \
  -H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}"
```

## Troubleshooting

### Rich Menu Not Showing
1. Check if rich menu is set as default
2. Verify image size and format
3. Check button coordinates
4. Try unlinking and relinking

### Buttons Not Working
1. Verify action types (message vs URI)
2. Check message text matches command handler
3. Test LIFF URL in browser first
4. Check webhook logs for command detection

### Image Quality Issues
1. Use PNG for better quality
2. Ensure 72-144 DPI
3. Test on multiple devices
4. Use web-safe colors

## Best Practices

### Design:
✅ Use clear, large icons (80-100px)
✅ High contrast text and background
✅ Consistent color scheme
✅ Simple, elderly-friendly labels
✅ Test on actual devices

### Content:
✅ Keep button labels short (1-3 words)
✅ Use emojis for visual clarity
✅ Prioritize most-used features
✅ Group related actions

### Technical:
✅ Optimize image size (< 500KB ideal)
✅ Test all button actions
✅ Monitor command usage analytics
✅ Update menu based on user feedback

## Resources

- [LINE Rich Menu Documentation](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [Rich Menu Image Design Guide](https://developers.line.biz/en/docs/messaging-api/rich-menu-design-guide/)
- [Figma Rich Menu Template](https://www.figma.com/community/file/line-rich-menu-template)

## Next Steps

After setting up Rich Menu:
1. Test all buttons in both group and 1:1 contexts
2. Monitor command usage in logs
3. Gather user feedback
4. Iterate on design and functionality
5. Consider A/B testing different layouts
