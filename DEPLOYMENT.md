# 🚀 Duulair Deployment Guide

> Complete guide for deploying Duulair to Vercel

---

## 📋 Prerequisites

- ✅ Vercel account
- ✅ Supabase project
- ✅ LINE Developer account (Messaging API + Login channel)
- ✅ Anthropic API key (Claude)
- ✅ GitHub repository

---

## 🔧 Step 1: Prepare Database

### 1.1 Run Migration

Connect to your Supabase project and run:

```bash
psql -U postgres -h your-supabase-host -d your-database \
  < database/migrations/001_user_registration.sql
```

Or via Supabase SQL Editor:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Paste contents of `database/migrations/001_user_registration.sql`
5. Click **Run**

### 1.2 Verify Tables

Check that these tables exist:
- `users`
- `patient_profiles`
- `caregiver_profiles`
- `patient_caregivers`
- `link_codes`
- `patient_medications`
- `health_goals`
- `notification_settings`

---

## 🌐 Step 2: Deploy to Vercel

### 2.1 Connect Repository

1. Go to https://vercel.com/new
2. Import your GitHub repository `duulair-hybrid`
3. Select the repository
4. Click **Import**

### 2.2 Configure Build Settings

Vercel should auto-detect:
- **Framework Preset**: Other
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

If not, set these manually.

### 2.3 Add Environment Variables

Go to **Settings** → **Environment Variables** and add:

#### 🔴 CRITICAL (Required)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-api03-...
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
LINE_LOGIN_CHANNEL_ID=your-channel-id
LINE_LOGIN_CHANNEL_SECRET=your-login-secret
LIFF_ID=your-liff-id
```

#### 🟡 IMPORTANT (Recommended)

```env
NODE_ENV=production
DEFAULT_TIMEZONE=Asia/Bangkok
ALERT_NO_RESPONSE_HOURS=18
DAILY_REPORT_TIME=22:00
MORNING_CHECKIN_TIME=08:00
EVENING_CHECKIN_TIME=20:00
```

#### 🟢 OPTIONAL (If used)

```env
N8N_WEBHOOK_URL=https://your-n8n.cloud/webhook/...
AIRTABLE_BASE_ID=appXXX
AIRTABLE_PERSONAL_ACCESS_TOKEN=patXXX
```

### 2.4 Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-3 minutes)
3. Get your deployment URL: `https://duulair-hybrid.vercel.app`

---

## 🔗 Step 3: Configure LINE Webhooks

### 3.1 Messaging API Webhook

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your **Messaging API Channel**
3. Go to **Messaging API** tab
4. Set **Webhook URL**:
   ```
   https://your-vercel-url.vercel.app/webhook
   ```
5. Enable **Use webhook**
6. Click **Verify** to test

### 3.2 LIFF Endpoint URL

1. Go to your **LINE Login Channel**
2. Go to **LIFF** tab
3. Select your LIFF app
4. Set **Endpoint URL**:
   ```
   https://your-vercel-url.vercel.app/liff
   ```
5. Save changes

---

## ✅ Step 4: Test Deployment

### 4.1 Health Check

```bash
curl https://your-vercel-url.vercel.app/test \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "สวัสดี"}'
```

Expected response:
```json
{
  "success": true,
  "intent": "dialog",
  "response": "..."
}
```

### 4.2 Registration API

```bash
curl https://your-vercel-url.vercel.app/api/registration/check \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"lineUserId": "U1234567890"}'
```

Expected response:
```json
{
  "exists": false
}
```

### 4.3 LINE Webhook

Send a message to your LINE Bot and check:
1. Message is received
2. Intent is classified correctly
3. Response is sent back

---

## 🐛 Step 5: Monitoring & Debugging

### 5.1 View Logs

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Deployments** → Select latest
4. Click **Functions** → View logs

### 5.2 Common Issues

#### Error: "supabaseUrl is required"
- **Solution**: Check `SUPABASE_URL` is set in Environment Variables

#### Error: "LINE webhook verification failed"
- **Solution**: Verify `LINE_CHANNEL_SECRET` is correct

#### Error: "Claude API error"
- **Solution**: Check `ANTHROPIC_API_KEY` is valid and has credits

#### Error: "Cannot find module"
- **Solution**: Make sure all dependencies are in `package.json`
- Run `npm install` and re-deploy

### 5.3 Enable Debug Logs

Set environment variable:
```env
LOG_LEVEL=debug
```

Then redeploy and check logs.

---

## 🔄 Step 6: Updates & Redeployment

### Automatic Deployment

Every push to `master` branch will trigger auto-deployment.

```bash
git add .
git commit -m "Update feature"
git push origin master
```

Vercel will automatically:
1. Pull latest code
2. Run build
3. Deploy new version
4. Update production URL

### Manual Redeployment

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Deployments**
4. Click **...** on latest deployment
5. Click **Redeploy**

---

## 📊 Step 7: Production Checklist

Before going live:

- [ ] Database migration applied
- [ ] All environment variables set
- [ ] LINE webhook configured and verified
- [ ] LIFF app tested
- [ ] Registration flow working
- [ ] Patient-Caregiver linking tested
- [ ] Health logging tested
- [ ] Alerts tested
- [ ] Reports tested
- [ ] Error monitoring setup (e.g., Sentry)
- [ ] Backup strategy defined
- [ ] Security review done

---

## 🎯 Production URLs

After deployment:

- **API Base**: `https://your-app.vercel.app/api`
- **Webhook**: `https://your-app.vercel.app/webhook`
- **Admin Test**: `https://your-app.vercel.app/test/admin-test.html`
- **Health Check**: `https://your-app.vercel.app/test`

---

## 🔒 Security Notes

1. **Never commit** `.env` file
2. **Rotate keys** regularly
3. **Use different keys** for development vs production
4. **Enable RLS** on Supabase tables
5. **Set up CORS** if needed
6. **Monitor API usage** and set rate limits
7. **Backup database** regularly

---

## 📞 Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **LINE Docs**: https://developers.line.biz/en/docs/
- **Anthropic Docs**: https://docs.anthropic.com/

---

## 🚨 Troubleshooting

### Issue: Build fails on Vercel

**Check**:
- `package.json` has all dependencies
- `tsconfig.json` is correct
- No TypeScript errors locally (`npm run build`)

**Solution**:
```bash
# Test build locally
npm run build

# Check for errors
npm run lint
```

### Issue: Function timeout

**Increase timeout** in `vercel.json`:
```json
{
  "functions": {
    "src/index.ts": {
      "maxDuration": 60
    }
  }
}
```

### Issue: Environment variables not working

**Check**:
1. Variable names are correct (case-sensitive)
2. Values don't have extra spaces
3. Redeployed after adding variables

---

**Last Updated**: 2024-01-20
**Version**: 1.0.0
