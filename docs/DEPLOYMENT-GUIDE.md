# 🚀 Oonjai Feedback - Deployment & Testing Guide

**Quick Reference for Deploying All Changes**

---

## 📋 Pre-Deployment Checklist

- [ ] Have Supabase project access
- [ ] Have LINE Developers Console access
- [ ] Have hosting platform access (for LIFF pages)
- [ ] Backup current database
- [ ] Test in staging environment first

---

## Step 1: Database Migrations (15 minutes)

### Connect to Supabase

**Option A: SQL Editor (Recommended)**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click "SQL Editor" in sidebar
4. Create new query

**Option B: CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref
```

### Run Migrations in Order

#### Migration 1: Phase 1 - Flexible Reminders & Water Tracking

```bash
# Copy content from:
docs/migrations/003_oonjai_feedback_phase1.sql

# Or use CLI:
supabase db push --file docs/migrations/003_oonjai_feedback_phase1.sql
```

**Verify:**
```sql
-- Check new tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('water_intake_logs', 'water_intake_goals');

-- Should return 2 rows

-- Check medications columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'medications'
AND column_name IN ('dosage_amount', 'dosage_form', 'frequency', 'days_of_week');

-- Should return 4 rows
```

#### Migration 2: Phase 2 - Enhanced Medical Information

```bash
# Copy content from:
docs/migrations/004_oonjai_feedback_phase2.sql
```

**Verify:**
```sql
-- Check allergies table
SELECT * FROM allergies LIMIT 1;

-- Check patient_profiles columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'patient_profiles'
AND column_name IN ('medical_condition', 'hospital_name', 'doctor_name');

-- Should return 3 rows
```

#### Migration 3: Phase 3 - Premium Features

```bash
# Copy content from:
docs/migrations/005_premium_features.sql
```

**Verify:**
```sql
-- Check packages inserted
SELECT * FROM subscription_packages;

-- Should show: free and plus packages

-- Check functions exist
SELECT proname FROM pg_proc WHERE proname IN ('has_feature_access', 'get_data_retention_days');

-- Should return 2 rows
```

### Seed Default Subscriptions

```sql
-- Create free subscriptions for all existing groups
INSERT INTO user_subscriptions (group_id, package_id, status)
SELECT
  cg.id,
  (SELECT id FROM subscription_packages WHERE package_name = 'free'),
  'active'
FROM caregiver_groups cg
WHERE NOT EXISTS (
  SELECT 1 FROM user_subscriptions WHERE group_id = cg.id
);

-- Create default report settings
INSERT INTO report_settings (group_id)
SELECT cg.id
FROM caregiver_groups cg
WHERE NOT EXISTS (
  SELECT 1 FROM report_settings WHERE group_id = cg.id
);
```

**✅ Database migrations complete!**

---

## Step 2: Backend Deployment (10 minutes)

### Install Dependencies (Optional - for PDF generation)

```bash
# If you want PDF downloads (otherwise CSV only works)
npm install pdfkit @types/pdfkit

# OR use Puppeteer (heavier but more flexible)
npm install puppeteer
```

### Build Backend

```bash
# Build TypeScript
npm run build

# Or if using ts-node
npm run dev
```

### Verify Backend Services

```bash
# Start server
npm start

# Test endpoints
curl http://localhost:3000/
# Should return: {"status":"ok","service":"Duulair Multi-Agent System"}

# Test report API (should return 400 for missing params)
curl http://localhost:3000/api/reports/download
# Expected: {"success":false,"error":"Missing required parameters..."}
```

**✅ Backend ready!**

---

## Step 3: LIFF Pages Deployment (20 minutes)

### Update Environment Variables in HTML Files

**Files to update:**
- `public/liff/water-tracking.html`
- `public/liff/medications.html`
- `public/liff/reminders.html`
- `public/liff/patient-profile.html`
- `public/liff/settings.html`

**Find and replace in EACH file:**

```javascript
// BEFORE
const LIFF_ID = 'YOUR_LIFF_ID';
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// AFTER (example values)
const LIFF_ID = '2008278683-5k69jxNq';
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Quick Replace Script:**

```bash
# Create a script to replace in all files
cd public/liff

# Set your values
LIFF_ID="2008278683-5k69jxNq"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-anon-key-here"

# Replace in all HTML files
for file in *.html; do
  sed -i '' "s/YOUR_LIFF_ID/$LIFF_ID/g" "$file"
  sed -i '' "s|YOUR_SUPABASE_URL|$SUPABASE_URL|g" "$file"
  sed -i '' "s/YOUR_SUPABASE_ANON_KEY/$SUPABASE_KEY/g" "$file"
done
```

### Deploy to Hosting

**Option A: Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy LIFF pages
cd public/liff
vercel deploy --name duulair-liff

# Get URLs
vercel ls
```

**Option B: Netlify**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd public/liff
netlify deploy --prod

# Get URL
netlify open
```

**Option C: Supabase Storage**

```bash
# Upload to Supabase Storage bucket
# 1. Create bucket 'liff-pages' in Supabase
# 2. Set public access
# 3. Upload files
```

### Register LIFF Pages in LINE

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel
3. Go to "LIFF" tab
4. Click "Add" for each page:

| Page | Endpoint URL | Size |
|------|--------------|------|
| Water Tracking | `https://your-domain.com/water-tracking.html` | Full |
| Medications | `https://your-domain.com/medications.html` | Full |
| Reminders | `https://your-domain.com/reminders.html` | Full |
| Patient Profile | `https://your-domain.com/patient-profile.html` | Full |
| Settings | `https://your-domain.com/settings.html` | Full |

5. Copy each LIFF ID and update Rich Menu

**✅ LIFF pages deployed!**

---

## Step 4: Rich Menu Update (15 minutes)

### Option A: LINE Manager (GUI)

1. Go to [LINE Official Account Manager](https://manager.line.biz/)
2. Select your account
3. Go to "Rich menu" in left sidebar
4. Click "Create"
5. Upload image (2500×1686 pixels)
6. Set button areas:

```
Grid: 2 rows × 3 columns (recommended)

Button 1 (Top-Left): 📝 บันทึกกิจกรรม
  → Action: LIFF
  → URL: https://liff.line.me/{YOUR_LIFF_ID}/water-tracking.html

Button 2 (Top-Middle): 🏠 แดชบอร์ด
  → Action: LIFF
  → URL: https://liff.line.me/{YOUR_LIFF_ID}/dashboard.html

Button 3 (Top-Right): 💊 ยา
  → Action: LIFF
  → URL: https://liff.line.me/{YOUR_LIFF_ID}/medications.html

Button 4 (Bottom-Left): 🔔 เตือน
  → Action: LIFF
  → URL: https://liff.line.me/{YOUR_LIFF_ID}/reminders.html

Button 5 (Bottom-Middle): 👤 ข้อมูลผู้ป่วย
  → Action: LIFF
  → URL: https://liff.line.me/{YOUR_LIFF_ID}/patient-profile.html

Button 6 (Bottom-Right): ⚙️ ตั้งค่า
  → Action: LIFF
  → URL: https://liff.line.me/{YOUR_LIFF_ID}/settings.html
```

7. Set as default rich menu

### Option B: API (Automated)

Use the rich menu JSON template:

```bash
# Copy docs/rich-menu-group.json
# Replace {LIFF_ID} with your actual LIFF IDs
# Upload using Messaging API

curl -X POST https://api.line.me/v2/bot/richmenu \
  -H 'Authorization: Bearer {YOUR_CHANNEL_ACCESS_TOKEN}' \
  -H 'Content-Type: application/json' \
  -d @docs/rich-menu-group.json
```

**✅ Rich menu configured!**

---

## Step 5: Testing (30 minutes)

### Automated Tests

```bash
# Run unit tests (if implemented)
npm test

# Run integration tests
npm run test:integration
```

### Manual Testing Checklist

#### Water Tracking Page

1. Open LINE app
2. Tap "📝 บันทึกกิจกรรม" from Rich Menu
3. Test:
   - [ ] Add 250ml → Progress bar updates
   - [ ] Add 500ml → Progress shows correctly
   - [ ] Custom amount 1000ml → Accepts
   - [ ] Try 6000ml → Validation error
   - [ ] Change goal to 2500ml → Saves
   - [ ] Delete a log → Removes and updates total
   - [ ] Toggle reminder → Saves state

**Expected:** All features work smoothly

#### Medications Page

1. Tap "💊 ยา" from Rich Menu
2. Test:
   - [ ] Add medication → Form opens
   - [ ] Select "เม็ด" → Shows tablet options
   - [ ] Select "½ เม็ด" → Displays as "½ เม็ด" in list
   - [ ] Select "น้ำ" → Changes to ml options
   - [ ] Select "5 ml" → Shows "5 ml (1 ชอนชา)"
   - [ ] Select frequency "เลือกวัน" → Days checkboxes appear
   - [ ] Check Mon/Wed/Fri → Saves correctly
   - [ ] Hover "?" icon → Tooltip shows
   - [ ] Edit medication → All fields pre-filled
   - [ ] Delete medication → Confirms first

**Expected:** All dosage formats work, conversions correct

#### Reminders Page

1. Tap "🔔 เตือน" from Rich Menu
2. Test:
   - [ ] See 5 sections (ยา, น้ำ, วัดความดัน, อาหาร, ออกกำลังกาย)
   - [ ] Click "+ เพิ่มเตือน" in กินยา section → Modal opens with pill icon
   - [ ] Select time "07:30" → Accepts any time
   - [ ] Select "เลือกวัน" → Days checkboxes show
   - [ ] Select Mon/Wed → Saves only those days
   - [ ] Add reminder → Appears in correct section
   - [ ] Toggle off → Grays out but stays in list
   - [ ] Edit reminder → Opens pre-filled form
   - [ ] Delete reminder → Confirms and removes

**Expected:** Flexible time selection, reminders organized by type

#### Patient Profile Page

1. Tap "👤 ข้อมูลผู้ป่วย" from Rich Menu
2. Go to "ข้อมูลทางการแพทย์" tab
3. Test:
   - [ ] Fill "ลักษณะอาการป่วย" → Saves
   - [ ] Fill hospital name → Saves
   - [ ] Fill doctor name → Saves
   - [ ] Fill doctor phone → Saves
   - [ ] Click "ยา" tab in allergies → Shows medication allergies only
   - [ ] Click "+ เพิ่มอาการแพ้" → Form shows
   - [ ] Add "Penicillin" as severe → Saves with red badge
   - [ ] Switch to "อาหาร" tab → Empty (correct)
   - [ ] Add "Peanuts" → Shows only in food tab
   - [ ] Delete allergy → Confirms first

**Expected:** All medical fields save, allergies properly categorized

#### Settings Page

1. Tap "⚙️ ตั้งค่า" from Rich Menu
2. Test:
   - [ ] No "การแจ้งเตือนอัตโนมัติ" tab (deleted)
   - [ ] Only see: กลุ่ม, รายงาน, แพคเกจ, ช่วยเหลือ
   - [ ] Go to "รายงาน" tab
   - [ ] See "📥 ดาวน์โหลดรายงาน" section
   - [ ] Date picker shows last 30 days by default
   - [ ] Try invalid range (to < from) → Validation error
   - [ ] **Free user:** Download button locked with message
   - [ ] **Free user:** Custom time inputs disabled (gray)
   - [ ] **Plus user:** (create test Plus subscription)
     - [ ] Can edit weekly report time
     - [ ] Can edit monthly report time
     - [ ] Save button works
     - [ ] Download button enabled
   - [ ] Go to "แพคเกจ" tab
   - [ ] See "Plus" with badge "เร็วๆ นี้" (not "Pro")

**Expected:** Redundant tab removed, Plus features locked for Free users

### API Testing

```bash
# Test CSV download (Plus user)
curl -X GET "http://localhost:3000/api/reports/download?patientId=xxx&from=2025-01-01&to=2025-01-13&format=csv" \
  -H "x-group-id: yyy" \
  -o test-report.csv

# Check CSV file
cat test-report.csv
# Should have Thai headers and data

# Test access control (Free user)
# (Use group_id with free subscription)
# Expected: 403 Forbidden with upgrade message
```

### Database Verification

```sql
-- Check water logs are being saved
SELECT * FROM water_intake_logs ORDER BY logged_at DESC LIMIT 5;

-- Check medications with new fields
SELECT id, name, dosage_amount, dosage_form, frequency, days_of_week
FROM medications
WHERE dosage_amount < 1 OR dosage_form = 'liquid'
LIMIT 5;

-- Check allergies are categorized
SELECT allergy_type, allergen_name, severity
FROM allergies
ORDER BY patient_id, allergy_type;

-- Check report downloads logged
SELECT * FROM report_downloads ORDER BY downloaded_at DESC LIMIT 5;
```

**✅ All tests passing!**

---

## Step 6: Rollback Plan (Just in Case)

### If Database Migration Fails

```sql
-- Rollback migrations in reverse order

-- Rollback 005
DROP TABLE IF EXISTS report_downloads;
DROP TABLE IF EXISTS report_settings;
DROP TABLE IF EXISTS analytics_settings;
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS subscription_packages;
DROP FUNCTION IF EXISTS has_feature_access;
DROP FUNCTION IF EXISTS get_data_retention_days;

-- Rollback 004
DROP TABLE IF EXISTS medication_history;
DROP TABLE IF EXISTS medical_history;
DROP TABLE IF EXISTS allergies;
ALTER TABLE patient_profiles
  DROP COLUMN IF EXISTS medical_condition,
  DROP COLUMN IF EXISTS hospital_name,
  DROP COLUMN IF EXISTS doctor_name,
  DROP COLUMN IF EXISTS doctor_phone;

-- Rollback 003
DROP TABLE IF EXISTS water_intake_goals;
DROP TABLE IF EXISTS water_intake_logs;
ALTER TABLE medications
  DROP COLUMN IF EXISTS days_of_week,
  DROP COLUMN IF EXISTS dosage_amount,
  DROP COLUMN IF EXISTS dosage_form,
  DROP COLUMN IF EXISTS dosage_unit,
  DROP COLUMN IF EXISTS frequency;
ALTER TABLE reminders
  DROP COLUMN IF EXISTS custom_time,
  DROP COLUMN IF EXISTS days_of_week,
  DROP COLUMN IF EXISTS frequency;
```

### If LIFF Pages Have Issues

1. Revert to old HTML files (backup first!)
2. Clear browser cache
3. Check browser console for errors
4. Verify LIFF IDs are correct

### If API Errors Occur

1. Check server logs
2. Verify Supabase connection
3. Test API endpoints individually
4. Rollback to previous backend code if needed

---

## 🔍 Monitoring & Logs

### What to Monitor

**Database:**
- Table sizes growing normally
- No deadlocks or slow queries
- Subscription statuses are correct

**API:**
- Response times < 2 seconds
- Error rate < 1%
- Download success rate for Plus users

**LIFF:**
- Page load times < 3 seconds
- No JavaScript errors in console
- Forms submitting successfully

### Log Locations

**Backend Logs:**
```bash
# Check server logs
pm2 logs duulair

# Or if using Node directly
tail -f logs/app.log
```

**Database Logs:**
```sql
-- Supabase Dashboard → Database → Logs
-- Or query:
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

**LIFF Logs:**
```javascript
// Browser console (F12)
// Check for errors or warnings
```

---

## ✅ Post-Deployment Checklist

- [ ] All 3 database migrations ran successfully
- [ ] Default packages and subscriptions seeded
- [ ] Backend server running without errors
- [ ] All 5 LIFF pages accessible
- [ ] LIFF IDs updated in HTML files
- [ ] Rich menu configured and set as default
- [ ] Water tracking page works end-to-end
- [ ] Medications page shows ½ เม็ด correctly
- [ ] Liquid medications show ชอนชา conversion
- [ ] Reminders allow flexible time selection
- [ ] Patient profile saves medical info
- [ ] Allergies separated by type (ยา/อาหาร/อื่นๆ)
- [ ] Settings has no redundant tab
- [ ] Free users see locked premium features
- [ ] Plus users can access all features
- [ ] CSV download works for Plus users
- [ ] Package shows "Plus" and "เร็วๆ นี้"
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Database queries performant (< 500ms)

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** "LIFF ID not found"
- **Fix:** Double-check LIFF ID in LINE Developers Console matches HTML files

**Issue:** "Supabase error: relation does not exist"
- **Fix:** Run migrations in correct order (003 → 004 → 005)

**Issue:** "403 Forbidden" when downloading
- **Fix:** Verify user has Plus subscription in user_subscriptions table

**Issue:** Days of week not saving
- **Fix:** Check JavaScript console, ensure days_of_week sent as array

**Issue:** ½ เม็ด shows as "0.5 เม็ด"
- **Fix:** Verify formatDosage() function is being called in medications.html

**Issue:** PDF download returns 501
- **Fix:** This is expected. Install pdfkit and uncomment PDF generation code

### Need Help?

1. Check browser console for errors (F12)
2. Check server logs for backend errors
3. Verify database tables and columns exist
4. Test each component individually
5. Review implementation docs

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ Users can set custom reminder times
✅ Water tracking is separate from medications
✅ ½ เม็ด displays correctly in medications list
✅ Liquid medications show teaspoon conversions
✅ Specific days of week can be selected
✅ Medical information saves properly
✅ Allergies organized by type in tabs
✅ Settings page has no redundant tab
✅ Free users see upgrade prompts for premium features
✅ Plus users can download reports and set custom times
✅ Package displays as "Plus" with "เร็วๆ นี้" badge

**Congratulations! All Oonjai feedback has been deployed! 🚀**

---

**Last Updated:** 2025-01-13
**Version:** 1.0.0
