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

### Issue 1: LIFF 404 Error (2025-10-25)

**Problem:**
- LIFF files not accessible on Vercel
- `Cannot GET /liff/register`

**Root Cause:**
- Vercel's `@vercel/node` doesn't automatically serve `public/` directory
- Using `express.static('public')` with relative path fails in serverless environment

**Solution:**
```json
// vercel.json - Use hybrid approach
{
  "builds": [
    {"src": "public/**", "use": "@vercel/static"},
    {"src": "src/index.ts", "use": "@vercel/node"}
  ],
  "routes": [
    {"src": "/liff/(.*)", "dest": "/public/liff/$1"},
    {"src": "/(.*)", "dest": "src/index.ts"}
  ]
}
```

```typescript
// src/index.ts - Static files only in development
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}
```

**Lessons Learned:**
- Vercel serverless functions != traditional servers
- Static files need separate builder in Vercel
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

### Issue 3: Webhook Retry Loop

**Problem:**
- Webhook logs show repeated delivery with `"isRedelivery":true`

**Root Cause:**
- Error thrown in webhook handler prevents 200 OK response
- LINE retries failed webhooks indefinitely

**Solution:**
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

**Vercel Static Files Pattern:**
```json
{
  "builds": [
    {"src": "public/**", "use": "@vercel/static"},
    {"src": "src/index.ts", "use": "@vercel/node"}
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
