# Supabase Edge Functions + pg_cron Setup Guide

## Overview

ระบบแจ้งเตือนใช้ Supabase Edge Functions + pg_cron แทน node-cron เพราะ:
- Vercel Serverless ไม่รองรับ long-running processes
- pg_cron ทำงานใน database layer - เสถียรกว่า
- Edge Functions รองรับ concurrent requests

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     pg_cron (PostgreSQL)                    │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │ Every minute    │───▶│ HTTP POST to Edge Function  │    │
│  │ (send-reminders)│    │ /functions/v1/send-reminders│    │
│  └─────────────────┘    └─────────────────────────────┘    │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │ Every hour      │───▶│ HTTP POST to Edge Function  │    │
│  │ (check-missed)  │    │ /functions/v1/check-missed- │    │
│  └─────────────────┘    │ activities                  │    │
│                         └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Edge Functions                    │
│                                                             │
│  1. Query reminders from database                           │
│  2. Check if already sent today                             │
│  3. Send LINE notifications                                 │
│  4. Log to reminder_logs table                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Setup Steps

### Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# or npm
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

### Step 3: Link Project

```bash
cd /path/to/duulair-hybrid
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in: Supabase Dashboard > Project Settings > General > Reference ID

### Step 4: Set Environment Variables

ไปที่ Supabase Dashboard > Edge Functions > Settings และเพิ่ม:

| Variable | Value |
|----------|-------|
| `LINE_CHANNEL_ACCESS_TOKEN` | Your LINE Channel Access Token |

(SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY จะ set อัตโนมัติ)

### Step 5: Deploy Edge Functions

```bash
# Deploy send-reminders function
supabase functions deploy send-reminders

# Deploy check-missed-activities function
supabase functions deploy check-missed-activities
```

### Step 6: Enable pg_cron Extension

1. ไปที่ Supabase Dashboard > Database > Extensions
2. ค้นหา "pg_cron"
3. กด Enable

### Step 7: Enable pg_net Extension (for HTTP calls)

1. ไปที่ Supabase Dashboard > Database > Extensions
2. ค้นหา "pg_net" หรือ "http"
3. กด Enable

### Step 8: Run Migration

แก้ไข `docs/migrations/008_setup_pg_cron_reminders.sql`:
- แทนที่ `YOUR_PROJECT_REF` ด้วย project ref จริง
- แทนที่ `YOUR_SERVICE_ROLE_KEY` ถ้าจำเป็น

จากนั้นรัน SQL ใน Supabase Dashboard > SQL Editor

### Step 9: Verify Setup

```sql
-- ตรวจสอบ cron jobs
SELECT * FROM cron.job;

-- ตรวจสอบ job history (หลังจากรอสักครู่)
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Step 10: Check Edge Function Logs

ไปที่ Supabase Dashboard > Edge Functions > เลือก function > Logs

## Testing

### Test send-reminders manually

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

### Test check-missed-activities manually

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-missed-activities' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

## Troubleshooting

### pg_cron not working

1. ตรวจสอบว่า enable extension แล้ว
2. ตรวจสอบ URL ใน cron job ถูกต้อง
3. ตรวจสอบ service role key

### Edge Function errors

1. ดู logs ใน Dashboard
2. ตรวจสอบ environment variables
3. ทดสอบด้วย curl

### No notifications sent

1. ตรวจสอบ `reminder_logs` table
2. ตรวจสอบ `reminders` table มีข้อมูลและ `is_active = true`
3. ตรวจสอบ `time` format ต้องเป็น `HH:MM:00`

## Files

```
supabase/
└── functions/
    ├── send-reminders/
    │   └── index.ts          # ส่ง reminder notifications
    └── check-missed-activities/
        └── index.ts          # แจ้งเตือนถ้าไม่มี activity 4 ชม.

docs/migrations/
└── 008_setup_pg_cron_reminders.sql  # SQL สำหรับ setup pg_cron
```

## Cost

| Service | Free Tier | หมายเหตุ |
|---------|-----------|---------|
| Edge Functions | 500K invocations/เดือน | ~43K/เดือน สำหรับ cron ทุกนาที |
| pg_cron | ฟรี | Built-in |
| Database | 500 MB | Included |

**สรุป: ฟรี** สำหรับการใช้งานปกติ
