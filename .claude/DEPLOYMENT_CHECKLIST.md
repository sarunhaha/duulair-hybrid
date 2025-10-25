# Deployment Checklist & Best Practices

## Pre-Commit Checklist

**ALWAYS check these before every commit:**

- [ ] **Read relevant documentation:**
  - [ ] LINE LIFF docs: https://developers.line.biz/en/docs/liff/
  - [ ] Vercel docs: https://vercel.com/docs
  - [ ] Supabase docs: https://supabase.com/docs (when using DB)

- [ ] **Test build locally:**
  ```bash
  npm run build
  ```

- [ ] **Verify TypeScript compiles:**
  ```bash
  tsc --noEmit
  ```

- [ ] **Check for unused imports:**
  - Especially `path` module if not using static files

- [ ] **Review vercel.json:**
  - Static files use `@vercel/static` builder
  - Routes are correct (`/liff/*` → `/public/liff/*`)
  - No conflicting configurations

- [ ] **Environment-specific code:**
  - Check `NODE_ENV` conditions
  - Verify paths work for both localhost and production

## Known Issues & Solutions

### Issue 0: LIFF "External Page" Warning (2025-10-25) 🔴 CRITICAL

**Problem:**
- After registration, LINE shows: "This is an external page. Some features may not work in this browser and there may be security concerns."
- User sees "400 Bad Request" toast
- Redirects within LIFF trigger external page warnings

**Root Cause:**
- **LIFF Endpoint URL configured incorrectly**
- Endpoint URL set to specific file: `/liff/register.html` instead of base path: `/liff/`
- Per LINE LIFF docs: "The `liff.init()` method only functions reliably on URLs matching your endpoint URL or at deeper path levels."

**Solution:**

1. **Go to LINE Developers Console**
   - URL: https://developers.line.biz/console/
   - Select your Messaging API Channel
   - Go to **LIFF** tab

2. **Update Endpoint URL**
   ```
   ❌ WRONG: https://duulair-hybrid.vercel.app/liff/register.html
   ✅ CORRECT: https://duulair-hybrid.vercel.app/liff/
   ```

3. **IMPORTANT Rules:**
   - Must be BASE PATH, not specific file
   - Must end with trailing slash `/`
   - All LIFF pages must be within this path

**Why This Works:**
- Endpoint = `https://app.vercel.app/liff/`
- All pages are within path:
  - ✅ `/liff/index.html` - covered
  - ✅ `/liff/register.html` - covered
  - ✅ `/liff/success.html` - covered
  - ✅ `/liff/role-selection.html` - covered
- No external page warnings!

**Complete Guide:** See `.claude/LIFF_FIX_GUIDE.md`

---

### Issue 1: LIFF 404 Error (2025-10-25) - UPDATED

**Problem:**
- LIFF files not accessible on Vercel
- `Cannot GET /liff/register` returns 404
- `/liff/register` doesn't map to `/liff/register.html`

**Root Causes:**
1. Vercel's `@vercel/node` doesn't automatically serve `public/` directory
2. Using `express.static('public')` fails in serverless environment
3. **Route pattern doesn't add `.html` extension automatically**
4. `/liff/register` maps to `/public/liff/register` (no file) instead of `/public/liff/register.html`

**Solutions Applied:**

**Step 1: Add @vercel/static builder**
```json
// vercel.json
{
  "builds": [
    {"src": "public/**", "use": "@vercel/static"},
    {"src": "src/index.ts", "use": "@vercel/node"}
  ]
}
```

**Step 2: Add explicit routes for each LIFF page**
```json
// vercel.json - Explicit HTML routes
{
  "routes": [
    {"src": "/liff/?$", "dest": "/public/liff/index.html"},
    {"src": "/liff/register/?$", "dest": "/public/liff/register.html"},
    {"src": "/liff/role-selection/?$", "dest": "/public/liff/role-selection.html"},
    {"src": "/liff/patient-registration/?$", "dest": "/public/liff/patient-registration.html"},
    {"src": "/liff/caregiver-registration/?$", "dest": "/public/liff/caregiver-registration.html"},
    {"src": "/liff/success/?$", "dest": "/public/liff/success.html"},
    {"src": "/liff/(.*\\.(html|css|js|png|jpg|jpeg|gif|svg|ico))", "dest": "/public/liff/$1"},
    {"src": "/(.*)", "dest": "src/index.ts"}
  ]
}
```

**Step 3: Dev-only static middleware**
```typescript
// src/index.ts - Static files only in development
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}
```

**Lessons Learned:**
- Vercel serverless functions != traditional servers
- Static files need separate builder in Vercel
- **Routes must be explicit - no auto .html extension**
- Order matters: specific routes before catch-all
- Always check Vercel build logs for ignored files

---

### Issue 2: Flex Message 400 Error

**Problem:**
- LINE API returns 400 Bad Request for Flex Messages

**Common Causes:**
- Invalid property: `height` in button (buttons don't have height)
- Empty `contents: []` arrays in boxes
- Invalid `flex` property in vertical layouts

**Solution:**
- Always validate Flex Messages with LINE Simulator
- Remove unsupported properties
- Check LINE Messaging API docs

---

### Issue 3: Webhook Retry Loop & Invalid Reply Token

**Problem:**
- Webhook logs show repeated delivery with `"isRedelivery":true`
- Error: `Invalid reply token` on retry events
- 400 Bad Request shown to users

**Root Causes:**
1. Error thrown in webhook handler prevents 200 OK response → LINE retries
2. `replyToken` expires after first use or over time
3. Retry events (`isRedelivery: true`) have expired replyTokens
4. Cannot use same replyToken multiple times (e.g., Flex Message fail → Fallback text)

**Solutions:**

**Solution 1: Skip Redelivery Events**
```typescript
async function handleTextMessage(event: any) {
  const isRedelivery = event.deliveryContext?.isRedelivery || false;

  console.log(`📨 Message: ${message.text}${isRedelivery ? ' [REDELIVERY]' : ''}`);

  // Skip redelivery events - replyToken is likely expired
  if (isRedelivery) {
    console.log('⏭️ Skipping redelivery event - replyToken may be invalid');
    return { success: true, skipped: true, reason: 'redelivery' };
  }

  // ... process message normally
}
```

**Solution 2: Always Return 200 OK**
```typescript
// Wrap all lineClient calls with try-catch
try {
  await lineClient.replyMessage(replyToken, message);
} catch (error) {
  console.error('Failed to send:', error);
  // DON'T throw - just log
}

// Always return success from handler
return { success: false, error: error.message };
```

**Why This Works:**
- Skip retry events → no expired replyToken errors
- Return 200 OK always → LINE stops retrying
- First delivery attempt gets processed, retries get skipped

---

### Issue 4: Incomplete Error Logging (2025-10-25)

**Problem:**
- Flex Message fails with 400 but error details not visible
- Can't diagnose root cause from logs

**Root Cause:**
- Error logging doesn't include `response.data` from LINE API
- LINE API error details are in `error.originalError?.response?.data`

**Solution:**
```typescript
// Proper error logging for LINE API calls
try {
  await lineClient.replyMessage(replyToken, flexMessage);
  console.log('✅ Flex Message sent:', flexMessageType);
} catch (sendError: any) {
  // Log ALL error details including LINE API response
  console.error('❌ Failed to send Flex Message:', {
    error: sendError.message,
    statusCode: sendError.statusCode,
    statusMessage: sendError.statusMessage,
    responseData: sendError.originalError?.response?.data  // ← CRITICAL!
  });

  // Fallback: Send text message instead
  const responseText = result.data?.combined?.response;
  if (responseText) {
    try {
      await lineClient.replyMessage(replyToken, { type: 'text', text: responseText });
      console.log('✅ Sent fallback text message');
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
    }
  }
}
```

**Lessons Learned:**
- Always log `error.originalError?.response?.data` for LINE API errors
- Add fallback text message when Flex Message fails
- Don't leave users without a response

---

### Issue 5: Webhook Returns 500 on Error (2025-10-25)

**Problem:**
- Webhook handler returns 500 on internal errors
- Causes LINE to retry infinitely (`"isRedelivery":true`)

**Root Cause:**
```typescript
// ❌ WRONG - Returns 500
catch (error) {
  res.status(500).json({ error: 'Internal server error' });
}
```

**Solution:**
```typescript
// ✅ CORRECT - Always return 200
catch (error) {
  console.error('❌ Webhook error:', error);
  // Return 200 to prevent LINE retry loop
  res.json({ status: 'error', error: 'Internal server error', details: error.message });
}
```

**Lessons Learned:**
- Webhook must ALWAYS return 200 OK
- Errors are logged, no need for LINE to retry
- 500 errors cause infinite retry loops

---

## Documentation Reading Protocol

**Before ANY deployment work, read:**

1. **LINE LIFF Documentation**
   - Endpoint URL requirements
   - LIFF SDK initialization
   - Browser compatibility

2. **Vercel Documentation**
   - Serverless function limitations
   - Static file serving patterns
   - Build configuration

3. **Supabase Documentation** (when applicable)
   - Connection pooling for serverless
   - Edge functions vs traditional queries
   - Row Level Security (RLS)

## Agent Responsibilities

**This checklist is maintained by:** Claude Code Development Agent

**Review frequency:** Before every git commit

**Last updated:** 2025-10-25

---

## Quick Reference

**Vercel Static Files Pattern (LIFF):**
```json
{
  "builds": [
    {"src": "public/**", "use": "@vercel/static"},
    {"src": "src/index.ts", "use": "@vercel/node"}
  ],
  "routes": [
    // Explicit LIFF pages (with .html extension)
    {"src": "/liff/?$", "dest": "/public/liff/index.html"},
    {"src": "/liff/register/?$", "dest": "/public/liff/register.html"},

    // Static assets (CSS, JS, images)
    {"src": "/liff/(.*\\.(html|css|js|png|jpg|svg))", "dest": "/public/liff/$1"},

    // Catch-all for API/webhook
    {"src": "/(.*)", "dest": "src/index.ts"}
  ]
}
```

**Express Development-only Static:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}
```

**LINE Webhook Error Handling:**
```typescript
try {
  await lineClient.replyMessage(replyToken, message);
  console.log('✅ Sent');
} catch (error) {
  console.error('❌ Failed:', error);
  // DON'T throw!
}
return result; // Always return, never throw
```

**Skip Redelivery Events:**
```typescript
async function handleTextMessage(event: any) {
  const isRedelivery = event.deliveryContext?.isRedelivery || false;

  // Log redelivery status
  console.log(`📨 Message: ${text}${isRedelivery ? ' [REDELIVERY]' : ''}`);

  // Skip retry events - replyToken is expired
  if (isRedelivery) {
    console.log('⏭️ Skipping redelivery event');
    return { success: true, skipped: true };
  }

  // Process normally...
}
```

**LINE API Error Logging (with response.data):**
```typescript
try {
  await lineClient.replyMessage(replyToken, flexMessage);
} catch (sendError: any) {
  console.error('❌ Failed:', {
    error: sendError.message,
    statusCode: sendError.statusCode,
    responseData: sendError.originalError?.response?.data  // ← Get error details!
  });

  // Fallback to text message
  await lineClient.replyMessage(replyToken, { type: 'text', text: fallbackText });
}
```

**Webhook Handler (Always Return 200):**
```typescript
app.post('/webhook', async (req, res) => {
  try {
    // ... process events ...
    res.json({ status: 'ok', processed: results.length });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // ✅ Return 200 to prevent LINE retry loop
    res.json({ status: 'error', error: error.message });
  }
});
```
