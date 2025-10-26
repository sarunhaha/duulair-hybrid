# 🔐 LINE Login Channel + LIFF Setup Guide

## 🚨 Important Update (2025)

LINE has changed their policy:
> **"You can no longer add LIFF apps to a Messaging API channel. Use a LINE Login channel instead."**

**What This Means:**
- ❌ Cannot create LIFF in Messaging API channel
- ✅ Must create separate LINE Login channel
- ✅ Create LIFF app in LINE Login channel
- ✅ Then link it with Messaging API channel (optional)

---

## 📋 Step-by-Step Setup Guide

### Step 1: Create LINE Login Channel

1. **Go to LINE Developers Console**
   - URL: https://developers.line.biz/console/

2. **Select Your Provider**
   - Provider: "Duulair Healthcare" (or your provider name)

3. **Create New Channel**
   - Click **Create a new channel**
   - Select **LINE Login** (NOT Messaging API)

4. **Fill in Channel Information**
   ```
   Channel type: LINE Login
   Provider: Duulair Healthcare
   Region: Thailand (or your region)

   Channel icon: [Upload logo image]
   Channel name: Duulair Login
   Channel description: LINE Login for Duulair healthcare registration

   App types: Web app ✅

   Email address: your-email@example.com
   Privacy policy URL: (optional for now)
   Terms of use URL: (optional for now)
   ```

5. **Agree to Terms**
   - ✅ I have read and agree to the LINE Developers Agreement

6. **Click Create**

---

### Step 2: Create LIFF App in LINE Login Channel

1. **After channel is created**, you'll see the channel dashboard

2. **Go to LIFF tab** (left sidebar)

3. **Click "Add" button** (green button, top right)

4. **Fill in LIFF App Information**
   ```
   LIFF app name: Duulair Registration

   Size: Full ✅
   (Use entire screen)

   Endpoint URL: https://duulair-hybrid.vercel.app/liff/
   ⚠️ IMPORTANT: Must end with / (slash)
   ⚠️ Must be BASE PATH, not specific file

   Scope:
   ✅ profile (Get user profile)
   ✅ openid (OpenID Connect)
   ✅ email (optional - if you want user email)

   Bot link feature:
   ○ On (normal) - Links to Messaging API bot
   ○ On (aggressive) - Strongly prompts to add bot
   ○ Off - No bot linking

   Select: On (normal) ✅

   Linked bot: [Select your Messaging API channel]
   → "Duulair Care Bot"

   Scan QR: Off (unless you need it)

   Module mode: Off (unless you need it)
   ```

5. **Click Add**

6. **Copy LIFF ID**
   - You'll see LIFF ID like: `2008278683-XXXXXXXX`
   - Copy this - you'll need it in code!

---

### Step 3: Get Channel Credentials

Still in LINE Login channel dashboard:

1. **Go to "Basic settings" tab**

2. **Copy these values:**
   ```
   Channel ID: 123456789
   Channel secret: [secret key]
   ```

3. **Go to "LIFF" tab**

4. **Copy LIFF ID:**
   ```
   LIFF ID: 2008278683-XXXXXXXX
   ```

---

### Step 4: Update Code with New LIFF ID

Update in your codebase:

**File 1: `public/liff/js/liff-init.js`**
```javascript
// OLD
const LIFF_ID = '2008278683-5k69jxNq';

// NEW - Replace with your actual LIFF ID
const LIFF_ID = '2008278683-XXXXXXXX';
```

**File 2: `src/index.ts`**
```typescript
// Update .env file
LIFF_ID=2008278683-XXXXXXXX
LINE_LOGIN_CHANNEL_ID=123456789
LINE_LOGIN_CHANNEL_SECRET=your_channel_secret
```

---

### Step 5: Update Environment Variables

**In Vercel:**

1. Go to https://vercel.com/your-project/settings/environment-variables

2. Add/Update these variables:
   ```
   LIFF_ID=2008278683-XXXXXXXX
   LINE_LOGIN_CHANNEL_ID=123456789
   LINE_LOGIN_CHANNEL_SECRET=your_channel_secret
   ```

3. Redeploy:
   ```bash
   git push origin master
   # Or in Vercel dashboard: Deployments → Redeploy
   ```

---

### Step 6: Test LIFF App

1. **Get LIFF URL**
   ```
   https://liff.line.me/2008278683-XXXXXXXX
   ```
   (Replace XXXXXXXX with your actual LIFF ID)

2. **Open in LINE**
   - Open LINE app on mobile
   - Send LIFF URL to yourself
   - Tap to open

3. **Should See:**
   - ✅ LIFF app opens in LINE browser
   - ✅ Login automatically (no external warning)
   - ✅ Can navigate between pages
   - ✅ Registration works

---

## 🔗 Linking Messaging API + LINE Login

**Why Link?**
- When user opens LIFF, they can also add your bot
- Bot can send messages after LIFF interaction

**How It's Linked:**
- Set "Bot link feature: On" when creating LIFF
- Select your Messaging API channel as "Linked bot"
- Users will see option to add bot when using LIFF

**Result:**
```
User opens LIFF URL
→ LINE Login authentication
→ See "Add Duulair Care Bot?" prompt
→ User adds bot
→ Bot can now send messages to user
```

---

## 📊 Architecture After Setup

```
Provider: Duulair Healthcare
├── Messaging API Channel: "Duulair Care Bot"
│   ├── Webhook: https://your-app.vercel.app/webhook
│   ├── Channel Access Token: (for sending messages)
│   └── Rich Menu, Flex Messages, etc.
│
└── LINE Login Channel: "Duulair Login"
    ├── LIFF App: "Duulair Registration"
    │   ├── LIFF ID: 2008278683-XXXXXXXX
    │   ├── Endpoint URL: https://your-app.vercel.app/liff/
    │   └── Linked to: Duulair Care Bot ✅
    ├── Channel ID: 123456789
    └── Channel Secret: [secret]
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] LINE Login channel created
- [ ] LIFF app created in LINE Login channel
- [ ] LIFF ID copied
- [ ] Endpoint URL = `https://your-app.vercel.app/liff/` (with trailing /)
- [ ] Bot link feature = On (normal)
- [ ] Linked bot = Your Messaging API channel
- [ ] Code updated with new LIFF ID
- [ ] Environment variables updated in Vercel
- [ ] Redeployed to Vercel
- [ ] Tested LIFF URL - opens without warnings
- [ ] Tested registration flow - works end-to-end

---

## 🚨 Common Issues

### Issue 1: "This is an external page" warning still appears

**Cause:** Endpoint URL is wrong

**Fix:**
- Must be: `https://your-app.vercel.app/liff/` (base path)
- NOT: `https://your-app.vercel.app/liff/register.html` (specific file)

### Issue 2: LIFF doesn't initialize

**Cause:** LIFF ID mismatch

**Fix:**
- Check LIFF ID in code matches LIFF ID in LINE console
- Check `public/liff/js/liff-init.js` line 5
- Check `.env` and Vercel environment variables

### Issue 3: Bot link doesn't work

**Cause:** Bot link feature not enabled or wrong bot selected

**Fix:**
- Edit LIFF app → Bot link feature = On
- Select correct Messaging API channel as linked bot

### Issue 4: 404 on LIFF pages

**Cause:** Vercel routes not configured

**Fix:**
- Check `vercel.json` has correct routes
- See `.claude/DEPLOYMENT_CHECKLIST.md` Issue 1

---

## 📚 References

- [LINE Login Documentation](https://developers.line.biz/en/docs/line-login/)
- [LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [News: LIFF apps to Messaging API channels](https://developers.line.biz/en/news/2023/09/26/liff-messaging-api-restriction/)

---

## 🆘 Need Help?

If you encounter issues:

1. Check LIFF tab in LINE Login channel (not Messaging API channel)
2. Verify Endpoint URL has trailing `/`
3. Confirm LIFF ID matches in code
4. Test LIFF URL: `https://liff.line.me/YOUR-LIFF-ID`
5. Check Vercel deployment logs
6. Review `.claude/DEPLOYMENT_CHECKLIST.md`

---

**Last Updated:** 2025-10-25
**Issue:** LINE policy change - LIFF requires LINE Login channel
**Status:** Active - New projects must use LINE Login channel
