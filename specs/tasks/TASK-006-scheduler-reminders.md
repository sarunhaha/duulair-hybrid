# TASK-006: Scheduler & Reminders

**Priority:** 🟡 High
**Status:** 📋 Ready to Start
**Owner:** Backend Developer / Scheduler Specialist
**Estimated Time:** 6-8 hours
**Dependencies:** TASK-001 (Registration), TASK-003 (Health Logging)

---

## 📝 Overview

พัฒนาระบบแจ้งเตือนอัตโนมัติสำหรับ:
- 💊 **แจ้งเตือนกินยา** (Medication Reminders)
- 💧 **แจ้งเตือนดื่มน้ำ** (Water Reminders)
- 🚶 **แจ้งเตือนออกกำลังกาย** (Exercise Reminders)
- 📊 **ส่งรายงานประจำวัน** (Daily Report Delivery)
- 🎯 **เป้าหมายรายวัน** (Daily Goal Reminders)

---

## 🎯 User Stories

### Story 1: Medication Reminders
**As a** ผู้ป่วย
**I want** ได้รับแจ้งเตือนกินยาตามเวลา
**So that** ไม่ลืมกินยา

**Acceptance Criteria:**
- ✅ ตั้งเวลาแจ้งเตือนได้หลายรอบ (เช้า, กลางวัน, เย็น, ก่อนนอน)
- ✅ แจ้งล่วงหน้า 5 นาที
- ✅ แจ้งซ้ำถ้าไม่บันทึก (ทุก 30 นาที สูงสุด 3 ครั้ง)
- ✅ แจ้งผู้ดูแลถ้าไม่กิน 2 ชม.
- ✅ ปิด/เปิดการแจ้งเตือนได้

### Story 2: Water Reminders
**As a** ผู้ป่วย
**I want** ได้รับแจ้งเตือนดื่มน้ำทุก 2 ชม.
**So that** ดื่มน้ำครบตามเป้าหมาย

**Acceptance Criteria:**
- ✅ แจ้งทุก 2 ชั่วโมง (08:00-20:00)
- ✅ แสดงปริมาณน้ำที่ดื่มแล้ว/เป้าหมาย
- ✅ ข้าม Reminder ถ้าดื่มแล้ว
- ✅ ปรับเวลาได้

### Story 3: Exercise Reminders
**As a** ผู้ป่วย
**I want** ได้รับแจ้งเตือนออกกำลังกายวันละครั้ง
**So that** ออกกำลังกายสม่ำเสมอ

**Acceptance Criteria:**
- ✅ แจ้งเวลาที่กำหนด (default 07:00)
- ✅ ข้ามถ้าบันทึกแล้ว
- ✅ แนะนำกิจกรรม (เดิน, ยืดเหยียด)

### Story 4: Daily Report Auto-Send
**As a** ผู้ดูแล
**I want** ได้รับรายงานประจำวันอัตโนมัติ
**So that** ติดตามสุขภาพผู้ป่วยได้ทุกวัน

**Acceptance Criteria:**
- ✅ ส่งทุกวันเวลา 20:00
- ✅ ส่งถึงผู้ป่วย + ผู้ดูแลที่เปิดการแจ้งเตือน
- ✅ สรุปกิจกรรมวันนั้น
- ✅ ไฮไลต์ประเด็นสำคัญ

### Story 5: Daily Goal Check-in
**As a** ผู้ป่วย
**I want** เห็นความคืบหน้าเป้าหมายรายวัน
**So that** รู้ว่ายังขาดอะไร

**Acceptance Criteria:**
- ✅ แจ้งเวลา 12:00 และ 18:00
- ✅ แสดงสรุปสั้นๆ
- ✅ แนะนำสิ่งที่ยังขาด

---

## 🛠 Technical Implementation

### 1. Database Schema

```sql
-- Reminder Schedules Table
CREATE TABLE reminder_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  reminder_type VARCHAR(50) NOT NULL, -- medication, water, exercise, report, goal_checkin

  -- Schedule settings
  enabled BOOLEAN DEFAULT true,
  time_of_day TIME NOT NULL, -- HH:MM
  days_of_week JSONB DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]', -- Which days active

  -- Reminder content
  title VARCHAR(200) NOT NULL,
  message TEXT,
  reminder_data JSONB, -- Type-specific data (e.g., medication_id)

  -- Retry settings
  retry_enabled BOOLEAN DEFAULT true,
  retry_interval_minutes INT DEFAULT 30,
  max_retries INT DEFAULT 3,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('medication', 'water', 'exercise', 'report', 'goal_checkin'))
);

-- Reminder Log (track sent reminders)
CREATE TABLE reminder_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES reminder_schedules(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) NOT NULL, -- sent, failed, acknowledged, ignored

  -- If acknowledged
  acknowledged_at TIMESTAMPTZ,
  action_taken VARCHAR(50), -- logged_medication, logged_water, etc.

  -- Retry tracking
  retry_count INT DEFAULT 0,

  CONSTRAINT valid_status CHECK (status IN ('sent', 'failed', 'acknowledged', 'ignored'))
);

-- Indexes
CREATE INDEX idx_reminder_schedules_patient ON reminder_schedules(patient_id);
CREATE INDEX idx_reminder_schedules_type ON reminder_schedules(reminder_type);
CREATE INDEX idx_reminder_schedules_enabled ON reminder_schedules(enabled);
CREATE INDEX idx_reminder_log_schedule ON reminder_log(schedule_id);
CREATE INDEX idx_reminder_log_patient ON reminder_log(patient_id);
CREATE INDEX idx_reminder_log_sent_at ON reminder_log(sent_at DESC);

-- RLS Policies
ALTER TABLE reminder_schedules ENABLE ROW LEVEL SECURITY;

-- Patients can manage their own schedules
CREATE POLICY "Patients can manage own reminder schedules"
  ON reminder_schedules FOR ALL
  USING (patient_id IN (
    SELECT id FROM patients WHERE line_user_id = auth.uid()::text
  ))
  WITH CHECK (patient_id IN (
    SELECT id FROM patients WHERE line_user_id = auth.uid()::text
  ));

-- Service role can manage all
CREATE POLICY "Service can manage all reminder schedules"
  ON reminder_schedules FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 2. API Endpoints

**File:** `src/routes/reminder.routes.ts` (new file)

```typescript
import { Router } from 'express';
import { SupabaseService } from '../services/supabase.service';

const router = Router();
const supabase = new SupabaseService();

// POST /api/reminders/schedule
router.post('/schedule', async (req, res) => {
  try {
    const {
      patient_id,
      reminder_type,
      time_of_day,
      title,
      message,
      reminder_data,
      days_of_week
    } = req.body;

    const { data, error } = await supabase.client
      .from('reminder_schedules')
      .insert({
        patient_id,
        reminder_type,
        time_of_day,
        title,
        message,
        reminder_data,
        days_of_week: days_of_week || ["mon","tue","wed","thu","fri","sat","sun"],
        enabled: true
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reminders/patient/:patient_id
router.get('/patient/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { reminder_type, enabled } = req.query;

    let query = supabase.client
      .from('reminder_schedules')
      .select('*')
      .eq('patient_id', patient_id)
      .order('time_of_day', { ascending: true });

    if (reminder_type) {
      query = query.eq('reminder_type', reminder_type);
    }

    if (enabled !== undefined) {
      query = query.eq('enabled', enabled === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/reminders/:schedule_id
router.put('/:schedule_id', async (req, res) => {
  try {
    const { schedule_id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase.client
      .from('reminder_schedules')
      .update({
        ...updates,
        updated_at: new Date()
      })
      .eq('id', schedule_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/reminders/:schedule_id
router.delete('/:schedule_id', async (req, res) => {
  try {
    const { schedule_id } = req.params;

    const { error } = await supabase.client
      .from('reminder_schedules')
      .delete()
      .eq('id', schedule_id);

    if (error) throw error;

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reminders/:schedule_id/toggle
router.post('/:schedule_id/toggle', async (req, res) => {
  try {
    const { schedule_id } = req.params;

    // Get current state
    const { data: current } = await supabase.client
      .from('reminder_schedules')
      .select('enabled')
      .eq('id', schedule_id)
      .single();

    // Toggle
    const { data, error } = await supabase.client
      .from('reminder_schedules')
      .update({
        enabled: !current.enabled,
        updated_at: new Date()
      })
      .eq('id', schedule_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reminders/log/:patient_id
router.get('/log/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { start_date, end_date, limit = 100 } = req.query;

    let query = supabase.client
      .from('reminder_log')
      .select('*, reminder_schedules(reminder_type, title)')
      .eq('patient_id', patient_id)
      .order('sent_at', { ascending: false })
      .limit(Number(limit));

    if (start_date) {
      query = query.gte('sent_at', start_date);
    }

    if (end_date) {
      query = query.lte('sent_at', end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 3. Scheduler Service

**File:** `src/services/scheduler.service.ts` (new file)

```typescript
import { SupabaseService } from './supabase.service';
import { Client } from '@line/bot-sdk';
import cron from 'node-cron';

const supabase = new SupabaseService();
const lineClient = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || ''
});

export class SchedulerService {
  private static instance: SchedulerService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  start() {
    console.log('📅 Starting Scheduler Service...');

    // Check every minute for due reminders
    cron.schedule('* * * * *', () => {
      this.checkDueReminders();
    });

    // Daily report at 20:00
    cron.schedule('0 20 * * *', () => {
      this.sendDailyReports();
    });

    console.log('✅ Scheduler Service started');
  }

  private async checkDueReminders() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
      const currentDay = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];

      // Get active schedules for current time
      const { data: schedules } = await supabase.client
        .from('reminder_schedules')
        .select('*, patients(line_user_id, first_name)')
        .eq('enabled', true)
        .eq('time_of_day', currentTime)
        .contains('days_of_week', [currentDay]);

      if (!schedules || schedules.length === 0) return;

      for (const schedule of schedules) {
        await this.sendReminder(schedule);
      }

    } catch (error) {
      console.error('Error checking due reminders:', error);
    }
  }

  private async sendReminder(schedule: any) {
    try {
      const patient = schedule.patients;

      // Check if already sent today
      const today = new Date().toISOString().split('T')[0];
      const { data: sentToday } = await supabase.client
        .from('reminder_log')
        .select('id')
        .eq('schedule_id', schedule.id)
        .gte('sent_at', today)
        .single();

      if (sentToday) {
        console.log(`Reminder ${schedule.id} already sent today`);
        return;
      }

      // Check if action already taken (e.g., medication already logged)
      if (await this.isActionAlreadyTaken(schedule)) {
        console.log(`Action already taken for reminder ${schedule.id}`);
        return;
      }

      // Send LINE message
      const message = this.createReminderMessage(schedule);

      await lineClient.pushMessage(patient.line_user_id, message);

      // Log reminder
      await supabase.client.from('reminder_log').insert({
        schedule_id: schedule.id,
        patient_id: schedule.patient_id,
        status: 'sent',
        retry_count: 0
      });

      console.log(`✅ Sent reminder: ${schedule.title} to ${patient.first_name}`);

    } catch (error) {
      console.error('Error sending reminder:', error);

      // Log failure
      await supabase.client.from('reminder_log').insert({
        schedule_id: schedule.id,
        patient_id: schedule.patient_id,
        status: 'failed',
        retry_count: 0
      });
    }
  }

  private async isActionAlreadyTaken(schedule: any): boolean {
    const today = new Date().toISOString().split('T')[0];

    switch (schedule.reminder_type) {
      case 'medication':
        const { data: medLog } = await supabase.client
          .from('health_logs')
          .select('id')
          .eq('patient_id', schedule.patient_id)
          .eq('log_type', 'medication')
          .gte('logged_at', today)
          .limit(1)
          .single();
        return !!medLog;

      case 'exercise':
        const { data: exerciseLog } = await supabase.client
          .from('health_logs')
          .select('id')
          .eq('patient_id', schedule.patient_id)
          .eq('log_type', 'exercise')
          .gte('logged_at', today)
          .limit(1)
          .single();
        return !!exerciseLog;

      default:
        return false;
    }
  }

  private createReminderMessage(schedule: any) {
    const typeEmoji = {
      medication: '💊',
      water: '💧',
      exercise: '🚶',
      goal_checkin: '🎯'
    };

    const emoji = typeEmoji[schedule.reminder_type] || '⏰';

    return {
      type: 'flex',
      altText: `${emoji} ${schedule.title}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${emoji} ${schedule.title}`,
              weight: 'bold',
              size: 'lg',
              color: '#4CAF50'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: schedule.message || 'ถึงเวลาแล้วค่ะ',
              wrap: true,
              size: 'sm'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'message',
                label: this.getActionLabel(schedule.reminder_type),
                text: this.getActionText(schedule.reminder_type)
              },
              color: '#4CAF50'
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'postback',
                label: 'เลื่อน 30 นาที',
                data: `action=snooze&schedule_id=${schedule.id}&minutes=30`
              }
            }
          ],
          spacing: 'sm'
        }
      }
    };
  }

  private getActionLabel(reminderType: string): string {
    const labels = {
      medication: 'บันทึกกินยา',
      water: 'บันทึกดื่มน้ำ',
      exercise: 'บันทึกออกกำลังกาย',
      goal_checkin: 'ดูความคืบหน้า'
    };
    return labels[reminderType] || 'บันทึก';
  }

  private getActionText(reminderType: string): string {
    const texts = {
      medication: 'กินยาแล้ว',
      water: 'ดื่มน้ำแล้ว',
      exercise: 'เดินแล้ว',
      goal_checkin: 'ดูความคืบหน้า'
    };
    return texts[reminderType] || 'เสร็จแล้ว';
  }

  private async sendDailyReports() {
    try {
      console.log('📊 Sending daily reports...');

      // Get all patients
      const { data: patients } = await supabase.client
        .from('patients')
        .select('id, line_user_id, first_name');

      if (!patients) return;

      for (const patient of patients) {
        // Generate daily report
        const reportUrl = `${process.env.API_BASE_URL}/api/reports/daily/${patient.id}`;
        const response = await fetch(reportUrl);
        const reportData = await response.json();

        if (reportData.success) {
          // Send to patient
          // ... (implement using ReportAgent's flex message)
        }

        // Send to caregivers
        const { data: caregivers } = await supabase.client
          .from('caregiver_links')
          .select('caregiver_id, caregivers(line_user_id, notification_settings)')
          .eq('patient_id', patient.id)
          .eq('status', 'approved');

        if (caregivers) {
          for (const link of caregivers) {
            const caregiver = link.caregivers as any;
            if (caregiver.notification_settings?.daily_report !== false) {
              // Send report to caregiver
              // ... (implement)
            }
          }
        }
      }

    } catch (error) {
      console.error('Error sending daily reports:', error);
    }
  }
}
```

### 4. Auto-create Default Schedules on Registration

**File:** `src/routes/registration.routes.ts` (modify existing)

```typescript
// After patient registration success
async function createDefaultReminders(patientId: string) {
  const defaultSchedules = [
    // Medication reminders (morning, lunch, dinner)
    {
      reminder_type: 'medication',
      time_of_day: '08:00:00',
      title: 'แจ้งเตือนกินยาเช้า',
      message: 'ถึงเวลากินยาแล้วค่ะ อย่าลืมกินตรงเวลานะคะ'
    },
    {
      reminder_type: 'medication',
      time_of_day: '12:00:00',
      title: 'แจ้งเตือนกินยาเที่ยง',
      message: 'ถึงเวลากินยาแล้วค่ะ'
    },
    {
      reminder_type: 'medication',
      time_of_day: '18:00:00',
      title: 'แจ้งเตือนกินยาเย็น',
      message: 'ถึงเวลากินยาแล้วค่ะ'
    },
    // Water reminders (every 2 hours)
    {
      reminder_type: 'water',
      time_of_day: '08:00:00',
      title: 'แจ้งเตือนดื่มน้ำ',
      message: 'อย่าลืมดื่มน้ำนะคะ เป้าหมายวันนี้ 2000 ml'
    },
    {
      reminder_type: 'water',
      time_of_day: '10:00:00',
      title: 'แจ้งเตือนดื่มน้ำ',
      message: 'อย่าลืมดื่มน้ำนะคะ'
    },
    {
      reminder_type: 'water',
      time_of_day: '14:00:00',
      title: 'แจ้งเตือนดื่มน้ำ',
      message: 'อย่าลืมดื่มน้ำนะคะ'
    },
    {
      reminder_type: 'water',
      time_of_day: '16:00:00',
      title: 'แจ้งเตือนดื่มน้ำ',
      message: 'อย่าลืมดื่มน้ำนะคะ'
    },
    // Exercise reminder
    {
      reminder_type: 'exercise',
      time_of_day: '07:00:00',
      title: 'แจ้งเตือนออกกำลังกาย',
      message: 'เช้านี้ออกไปเดินเล่นกันนะคะ เป้าหมาย 30 นาที'
    },
    // Goal check-in
    {
      reminder_type: 'goal_checkin',
      time_of_day: '12:00:00',
      title: 'ตรวจสอบความคืบหน้า',
      message: 'มาดูกันว่าเช้านี้ทำอะไรไปแล้วบ้าง'
    },
    {
      reminder_type: 'goal_checkin',
      time_of_day: '18:00:00',
      title: 'ตรวจสอบความคืบหน้า',
      message: 'วันนี้เหลืออะไรที่ยังไม่ได้ทำบ้างคะ'
    }
  ];

  for (const schedule of defaultSchedules) {
    await supabase.client.from('reminder_schedules').insert({
      patient_id: patientId,
      ...schedule,
      enabled: true
    });
  }
}
```

### 5. Start Scheduler in index.ts

**File:** `src/index.ts`

```typescript
import { SchedulerService } from './services/scheduler.service';
import reminderRoutes from './routes/reminder.routes';

// Register routes
app.use('/api/reminders', reminderRoutes);

// Start scheduler (only in production or if enabled)
if (process.env.ENABLE_SCHEDULER === 'true') {
  const scheduler = SchedulerService.getInstance();
  scheduler.start();
}

// Handle postback for snooze
async function handlePostback(event: any) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  if (action === 'snooze') {
    const scheduleId = data.get('schedule_id');
    const minutes = parseInt(data.get('minutes') || '30');

    // Schedule a one-time reminder
    // ... (implement snooze logic)

    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `⏰ เลื่อนการแจ้งเตือนไป ${minutes} นาทีค่ะ`
    });
  }
}
```

---

## 📂 Files to Create/Modify

### New Files:
1. `src/routes/reminder.routes.ts` - Reminder API endpoints
2. `src/services/scheduler.service.ts` - Scheduler service
3. `database/migrations/006_reminders.sql` - Reminder tables

### Modified Files:
1. `src/routes/registration.routes.ts` - Auto-create default schedules
2. `src/index.ts` - Start scheduler, register routes

### Dependencies to Install:
```bash
npm install node-cron
npm install @types/node-cron --save-dev
```

---

## ✅ Testing Checklist

### API Tests
- [ ] POST /api/reminders/schedule
- [ ] GET /api/reminders/patient/:patient_id
- [ ] PUT /api/reminders/:schedule_id
- [ ] DELETE /api/reminders/:schedule_id
- [ ] POST /api/reminders/:schedule_id/toggle

### Scheduler Tests
- [ ] Medication reminder ส่งตรงเวลา
- [ ] Water reminder ส่งทุก 2 ชม.
- [ ] Exercise reminder ส่งเช้า
- [ ] Daily report ส่งเวลา 20:00
- [ ] Snooze ทำงาน

### Skip Logic Tests
- [ ] ข้าม reminder ถ้าบันทึกแล้ว
- [ ] ไม่ส่ง reminder ซ้ำในวันเดียวกัน

---

## 🚀 Deployment

```bash
# Install dependencies
npm install node-cron @types/node-cron

# Create migration
cat > database/migrations/006_reminders.sql << 'EOF'
-- (SQL code from above)
EOF

# Run migration
psql $SUPABASE_DB_URL -f database/migrations/006_reminders.sql

# Add environment variable
# Vercel: ENABLE_SCHEDULER=true

# Build and deploy
npm run build
git add .
git commit -m "Add scheduler and reminder system"
git push origin master
```

---

## 📊 Success Metrics

- ✅ Reminder delivery accuracy > 99%
- ✅ Reminder response rate > 60%
- ✅ Snooze usage < 20%
- ✅ User satisfaction with reminders > 80%

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
