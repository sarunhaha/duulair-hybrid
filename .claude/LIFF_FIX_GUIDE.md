# 🔧 LIFF "External Page" Warning Fix Guide

## 🚨 IMPORTANT UPDATE (2025)

**LINE Policy Change:**
> "You can no longer add LIFF apps to a Messaging API channel. Use a LINE Login channel instead."

**What You Need:**
1. ✅ **LINE Login channel** (separate from Messaging API)
2. ✅ **LIFF app** created in LINE Login channel
3. ✅ **Link** LIFF to your Messaging API bot (optional)

**Complete Setup Guide:** See `.claude/LINE_LOGIN_SETUP.md`

---

## ❌ Problem

After registering, users see:
```
LINE
alert
400 Bad Request

About LINE Privacy Policy Terms and Conditions of Use
This is an external page. Some features may not work in this browser and there may be security concerns.
```

## 🔍 Root Cause

**LIFF Endpoint URL is configured incorrectly**

### From LINE LIFF Documentation:
> "The `liff.init()` method only functions reliably on URLs matching your endpoint URL or at deeper path levels."

**Example of WRONG configuration:**
```
LIFF Endpoint URL: https://your-app.vercel.app/liff/register.html ❌
```
- User navigates to `/liff/success.html` after registration
- `success.html` is NOT within `/liff/register.html` path
- LINE shows "External Page" warning

**Example of CORRECT configuration:**
```
LIFF Endpoint URL: https://your-app.vercel.app/liff/ ✅
```
- All pages (`register.html`, `success.html`, `role-selection.html`) are within `/liff/` path
- No external page warnings

---

## ✅ Solution - Fix LIFF Endpoint URL

### Step 1: Create LINE Login Channel (if not exists)

**⚠️ IMPORTANT:** LIFF apps must be created in LINE Login channel, NOT Messaging API channel.

1. Open: https://developers.line.biz/console/
2. Login with your LINE account
3. Select your **Provider**
4. Click **Create a new channel** → Select **LINE Login**
5. Fill in details and create channel

**See complete guide:** `.claude/LINE_LOGIN_SETUP.md`

### Step 2: Create LIFF App in LINE Login Channel

1. Open your **LINE Login channel** (NOT Messaging API channel)
2. Click **LIFF** tab in left sidebar
3. Click **Add** button
4. Fill in LIFF app details

### Step 3: Set Endpoint URL Correctly

**Current (WRONG):**
```
https://duulair-hybrid.vercel.app/liff/register
or
https://duulair-hybrid.vercel.app/liff/register.html
```

**Change to (CORRECT):**
```
https://duulair-hybrid.vercel.app/liff/
```

**IMPORTANT:**
- ✅ Must end with `/liff/` (with trailing slash)
- ✅ Should be the BASE PATH, not a specific file
- ✅ All LIFF pages will work under this path

### Step 4: Save Changes

1. Click **Update**
2. Wait 1-2 minutes for changes to propagate
3. Test again

---

## 🧪 Testing

After updating Endpoint URL:

### Test 1: Open LIFF URL
```
https://liff.line.me/2008278683-5k69jxNq
```
Should open `/liff/index.html` without warnings ✅

### Test 2: Complete Registration
1. Go through registration flow
2. Submit form
3. Should redirect to `/liff/success.html` **without warnings** ✅

### Test 3: Navigate Between Pages
- `/liff/` → `/liff/role-selection.html` ✅
- `/liff/role-selection.html` → `/liff/patient-registration.html` ✅
- `/liff/patient-registration.html` → `/liff/success.html` ✅

All should work without "External Page" warnings.

---

## 📋 Verification Checklist

- [ ] LIFF Endpoint URL = `https://your-app.vercel.app/liff/`
- [ ] Endpoint URL ends with trailing slash `/`
- [ ] Tested opening LIFF URL - no warnings
- [ ] Tested registration flow - redirects work
- [ ] Tested success page - displays correctly
- [ ] No "External Page" warnings appear

---

## 🔍 Why This Happens

### LINE LIFF URL Restriction Rules:

**Endpoint URL:** `https://app.vercel.app/liff/`

✅ **ALLOWED** (within path):
- `https://app.vercel.app/liff/`
- `https://app.vercel.app/liff/index.html`
- `https://app.vercel.app/liff/success.html`
- `https://app.vercel.app/liff/any/deep/path.html`

❌ **NOT ALLOWED** (outside path):
- `https://app.vercel.app/` (parent path)
- `https://app.vercel.app/other/` (different path)
- `https://app.vercel.app/liff2/` (different base)

### When External Warning Appears:

1. **Transitioning above endpoint URL level**
   - Endpoint: `/liff/page1.html`
   - Navigate to: `/liff/page2.html` → Warning!

2. **Opening non-LIFF domains**
   - Any external URL opened in same window

3. **URL mismatch after redirect**
   - Redirect to URL not covered by endpoint

---

## 🚨 Common Mistakes

### Mistake 1: Specific File as Endpoint
```
❌ https://app.vercel.app/liff/register.html
```
Only `register.html` will work, other pages show warnings.

### Mistake 2: No Trailing Slash
```
❌ https://app.vercel.app/liff
```
May cause issues with sub-paths.

### Mistake 3: Multiple LIFF Apps for Different Pages
```
❌ LIFF App 1: /liff/register.html
❌ LIFF App 2: /liff/success.html
```
Unnecessary complexity. Use ONE app with base path.

---

## ✅ Correct Configuration

**ONE LIFF App with Base Path:**
```
✅ Endpoint URL: https://your-app.vercel.app/liff/
✅ LIFF ID: 2008278683-5k69jxNq
```

**All pages work under this:**
- `/liff/` → index.html
- `/liff/register.html` → redirect to index
- `/liff/index.html` → main entry
- `/liff/role-selection.html` → role selection
- `/liff/patient-registration.html` → patient form
- `/liff/caregiver-registration.html` → caregiver form
- `/liff/success.html` → success page

---

## 📚 References

- [LINE LIFF Overview](https://developers.line.biz/en/docs/liff/overview/)
- [Developing LIFF Apps](https://developers.line.biz/en/docs/liff/developing-liff-apps/)
- [LIFF API Reference](https://developers.line.biz/en/reference/liff/)

---

**Last Updated:** 2025-10-25
**Issue:** External Page Warnings in LIFF
**Solution:** Configure Endpoint URL as base path, not specific file
