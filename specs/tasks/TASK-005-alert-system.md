# TASK-005: Alert System

**Priority:** 🔴 CRITICAL
**Status:** 📋 Ready to Start
**Owner:** Backend Developer / AlertAgent Specialist
**Estimated Time:** 5-6 hours
**Dependencies:** TASK-001 (Registration), TASK-003 (Health Logging)

---

## 📝 Overview

พัฒนาระบบแจ้งเตือนอัจฉริยะ เพื่อแจ้งผู้ดูแลเมื่อ:
- 🆘 **ฉุกเฉิน** (Emergency keyword detected)
- ⚠️ **ความดันผิดปกติ** (Abnormal vitals)
- 🔕 **ไม่ตอบกลับ** (No response for X hours)
- 💊 **ลืมกินยา** (Missed medication)
- 📉 **พฤติกรรมผิดปกติ** (Unusual patterns)

---

## 🎯 User Stories

### Story 1: Emergency Alert
**As a** ผู้ป่วย
**I want** กดแจ้งเตือนฉุกเฉิน
**So that** ผู้ดูแลได้รับแจ้งทันที

**Acceptance Criteria:**
- ✅ พิมพ์ "ฉุกเฉิน" → แจ้งผู้ดูแลทุกคนทันที
- ✅ แจ้งพร้อมตำแหน่ง (ถ้ามี)
- ✅ แจ้งพร้อมข้อมูลสุขภาพล่าสุด
- ✅ ผู้ดูแลกด Acknowledge ได้
- ✅ Log เก็บประวัติ

### Story 2: Abnormal Vitals Alert
**As a** ผู้ดูแล
**I want** ได้รับแจ้งเตือนเมื่อความดันผิดปกติ
**So that** ดูแลทันที

**Acceptance Criteria:**
- ✅ ความดันสูง > 140/90 → แจ้งเตือน
- ✅ ความดันต่ำ < 90/60 → แจ้งเตือน
- ✅ อัตราการเต้นหัวใจผิดปกติ → แจ้งเตือน
- ✅ แจ้งพร้อมค่าที่วัดได้

### Story 3: Inactivity Alert
**As a** ผู้ดูแล
**I want** ได้รับแจ้งเตือนเมื่อผู้ป่วยไม่ตอบกลับนาน
**So that** ตรวจสอบความปลอดภัย

**Acceptance Criteria:**
- ✅ ไม่มีกิจกรรม 4 ชม. → แจ้งเตือน Level 1
- ✅ ไม่มีกิจกรรม 8 ชม. → แจ้งเตือน Level 2
- ✅ ไม่มีกิจกรรม 12 ชม. → แจ้งเตือน Level 3 (Critical)

### Story 4: Medication Reminder
**As a** ผู้ดูแล
**I want** ได้รับแจ้งเตือนเมื่อผู้ป่วยลืมกินยา
**So that** เตือนให้กินยาตรงเวลา

**Acceptance Criteria:**
- ✅ ไม่บันทึกการกินยาตามเวลา → แจ้งเตือนผู้ป่วย
- ✅ ไม่กิน 2 ชม. หลังเวลา → แจ้งเตือนผู้ดูแล

---

## 🛠 Technical Implementation

### 1. Database Schema

```sql
-- Alerts Table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- emergency, vitals, inactivity, medication, pattern
  severity VARCHAR(20) NOT NULL, -- info, warning, urgent, critical
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  alert_data JSONB,

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, acknowledged, resolved
  acknowledged_by UUID REFERENCES caregivers(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_alert_type CHECK (alert_type IN ('emergency', 'vitals', 'inactivity', 'medication', 'pattern')),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'urgent', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'acknowledged', 'resolved'))
);

-- Notification Log
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL, -- caregiver_id or patient_id
  recipient_type VARCHAR(20) NOT NULL, -- patient, caregiver
  channel VARCHAR(20) NOT NULL, -- line, sms, email
  status VARCHAR(20) NOT NULL, -- sent, failed, delivered
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  error_message TEXT,

  CONSTRAINT valid_recipient_type CHECK (recipient_type IN ('patient', 'caregiver')),
  CONSTRAINT valid_channel CHECK (channel IN ('line', 'sms', 'email')),
  CONSTRAINT valid_status CHECK (status IN ('sent', 'failed', 'delivered'))
);

-- Indexes
CREATE INDEX idx_alerts_patient ON alerts(patient_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_notification_log_alert ON notification_log(alert_id);
CREATE INDEX idx_notification_log_recipient ON notification_log(recipient_id);

-- RLS Policies
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Patients can view their own alerts
CREATE POLICY "Patients can view own alerts"
  ON alerts FOR SELECT
  USING (patient_id IN (
    SELECT id FROM patients WHERE line_user_id = auth.uid()::text
  ));

-- Caregivers can view linked patients' alerts
CREATE POLICY "Caregivers can view linked patients alerts"
  ON alerts FOR SELECT
  USING (patient_id IN (
    SELECT patient_id FROM caregiver_links
    WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE line_user_id = auth.uid()::text
    )
    AND status = 'approved'
  ));

-- Service role can manage alerts
CREATE POLICY "Service can manage alerts"
  ON alerts FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 2. API Endpoints

**File:** `src/routes/alert.routes.ts` (new file)

```typescript
import { Router } from 'express';
import { SupabaseService } from '../services/supabase.service';
import { Client } from '@line/bot-sdk';

const router = Router();
const supabase = new SupabaseService();
const lineClient = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || ''
});

// POST /api/alerts/create
router.post('/create', async (req, res) => {
  try {
    const {
      patient_id,
      alert_type,
      severity,
      title,
      message,
      alert_data
    } = req.body;

    // Create alert
    const { data: alert, error } = await supabase.client
      .from('alerts')
      .insert({
        patient_id,
        alert_type,
        severity,
        title,
        message,
        alert_data,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    // Notify caregivers
    await notifyCaregivers(patient_id, alert);

    res.json({ success: true, data: alert });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:alert_id/acknowledge
router.post('/:alert_id/acknowledge', async (req, res) => {
  try {
    const { alert_id } = req.params;
    const { caregiver_id } = req.body;

    const { data, error } = await supabase.client
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: caregiver_id,
        acknowledged_at: new Date()
      })
      .eq('id', alert_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:alert_id/resolve
router.post('/:alert_id/resolve', async (req, res) => {
  try {
    const { alert_id } = req.params;

    const { data, error } = await supabase.client
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date()
      })
      .eq('id', alert_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/patient/:patient_id
router.get('/patient/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { status, severity, limit = 50 } = req.query;

    let query = supabase.client
      .from('alerts')
      .select('*')
      .eq('patient_id', patient_id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (status) {
      query = query.eq('status', status);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to notify caregivers
async function notifyCaregivers(patientId: string, alert: any) {
  try {
    // Get approved caregivers
    const { data: links } = await supabase.client
      .from('caregiver_links')
      .select('caregiver_id, caregivers(line_user_id, first_name, notification_settings)')
      .eq('patient_id', patientId)
      .eq('status', 'approved');

    if (!links || links.length === 0) return;

    // Get patient info
    const { data: patient } = await supabase.client
      .from('patients')
      .select('first_name, last_name')
      .eq('id', patientId)
      .single();

    const patientName = `${patient?.first_name} ${patient?.last_name}`;

    // Send LINE notification to each caregiver
    for (const link of links) {
      const caregiver = link.caregivers as any;

      // Check if notifications enabled
      if (caregiver.notification_settings?.enabled === false) continue;

      // Check severity level preference
      const minSeverity = caregiver.notification_settings?.min_severity || 'warning';
      if (!shouldNotify(alert.severity, minSeverity)) continue;

      // Create notification message
      const message = createAlertMessage(patientName, alert);

      // Send LINE message
      try {
        await lineClient.pushMessage(caregiver.line_user_id, message);

        // Log notification
        await supabase.client.from('notification_log').insert({
          alert_id: alert.id,
          recipient_id: link.caregiver_id,
          recipient_type: 'caregiver',
          channel: 'line',
          status: 'sent'
        });

      } catch (error) {
        console.error('Failed to send notification:', error);

        // Log failure
        await supabase.client.from('notification_log').insert({
          alert_id: alert.id,
          recipient_id: link.caregiver_id,
          recipient_type: 'caregiver',
          channel: 'line',
          status: 'failed',
          error_message: error.message
        });
      }
    }

  } catch (error) {
    console.error('Error notifying caregivers:', error);
  }
}

function shouldNotify(alertSeverity: string, minSeverity: string): boolean {
  const levels = { info: 1, warning: 2, urgent: 3, critical: 4 };
  return levels[alertSeverity] >= levels[minSeverity];
}

function createAlertMessage(patientName: string, alert: any) {
  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    urgent: '🚨',
    critical: '🆘'
  };

  return {
    type: 'flex',
    altText: `${severityEmoji[alert.severity]} ${alert.title}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${severityEmoji[alert.severity]} ${alert.title}`,
            weight: 'bold',
            size: 'lg',
            color: alert.severity === 'critical' ? '#F44336' : alert.severity === 'urgent' ? '#FF9800' : '#4CAF50'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `ผู้ป่วย: ${patientName}`,
            size: 'sm',
            weight: 'bold'
          },
          {
            type: 'text',
            text: alert.message,
            size: 'sm',
            wrap: true,
            margin: 'md'
          },
          {
            type: 'text',
            text: `เวลา: ${new Date(alert.created_at).toLocaleString('th-TH')}`,
            size: 'xs',
            color: '#999999',
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'รับทราบ',
              data: `action=acknowledge&alert_id=${alert.id}`
            },
            color: '#4CAF50'
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ดูรายละเอียด',
              text: 'ดูรายละเอียด alert'
            }
          }
        ]
      }
    }
  };
}

export default router;
```

### 3. Update AlertAgent

**File:** `src/agents/specialized/AlertAgent.ts`

```typescript
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';

export class AlertAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'alert',
      role: 'Monitor and escalate critical situations',
      model: 'claude-3-haiku-20240307',
      temperature: 0.2,
      maxTokens: 200,
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Alert Agent initialized');
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();

    try {
      const userId = message.context.userId;
      const content = message.content.toLowerCase();

      // Get patient
      const patient = await this.supabase.getPatientByLineId(userId);
      if (!patient) {
        return {
          success: false,
          error: 'Patient not registered',
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Detect emergency
      if (this.isEmergency(content)) {
        await this.createEmergencyAlert(patient.id, message);

        return {
          success: true,
          data: {
            response: '🆘 แจ้งเตือนฉุกเฉินถูกส่งไปยังผู้ดูแลทุกคนแล้วค่ะ\n\nกรุณารอสักครู่ ผู้ดูแลจะติดต่อกลับเร็วๆ นี้ค่ะ',
            alert_sent: true
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Check for abnormal vitals (from metadata)
      if (message.metadata?.alert) {
        await this.createVitalsAlert(patient.id, message.metadata);
      }

      return {
        success: true,
        data: {},
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.log('error', 'Alert processing failed', error);
      return {
        success: false,
        error: error.message,
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  private isEmergency(content: string): boolean {
    const emergencyKeywords = [
      'ฉุกเฉิน', 'ช่วยด้วย', 'emergency', 'help',
      'เจ็บ', 'ปวด', 'หายใจไม่ออก', 'เป็นลม',
      'ตกเลือด', 'เจ็บหน้าอก', 'วิงเวียน'
    ];

    return emergencyKeywords.some(keyword => content.includes(keyword));
  }

  private async createEmergencyAlert(patientId: string, message: Message) {
    const { data, error } = await this.supabase.client
      .from('alerts')
      .insert({
        patient_id: patientId,
        alert_type: 'emergency',
        severity: 'critical',
        title: 'แจ้งเตือนฉุกเฉิน',
        message: `ผู้ป่วยส่งข้อความ: "${message.content}"`,
        alert_data: {
          original_message: message.content,
          timestamp: new Date()
        },
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      this.log('error', 'Failed to create emergency alert', error);
      throw error;
    }

    this.log('info', 'Emergency alert created', { alert_id: data.id });

    // Trigger notification (will be handled by notifyCaregivers in API)
    await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/alerts/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  private async createVitalsAlert(patientId: string, metadata: any) {
    const { systolic, diastolic } = metadata;

    let severity = 'warning';
    let title = 'ความดันผิดปกติ';
    let message = `วัดความดันได้ ${systolic}/${diastolic}`;

    if (systolic > 160 || diastolic > 100) {
      severity = 'urgent';
      title = 'ความดันสูงมาก';
    } else if (systolic < 80 || diastolic < 50) {
      severity = 'urgent';
      title = 'ความดันต่ำมาก';
    }

    const { error } = await this.supabase.client
      .from('alerts')
      .insert({
        patient_id: patientId,
        alert_type: 'vitals',
        severity,
        title,
        message,
        alert_data: {
          systolic,
          diastolic,
          timestamp: new Date()
        },
        status: 'active'
      });

    if (error) {
      this.log('error', 'Failed to create vitals alert', error);
    }
  }

  getCapabilities(): string[] {
    return [
      'emergency-detection',
      'vitals-monitoring',
      'caregiver-notification',
      'alert-escalation'
    ];
  }
}
```

### 4. Inactivity Monitor (Cron Job)

**File:** `src/jobs/inactivity-monitor.ts` (new file)

```typescript
import { SupabaseService } from '../services/supabase.service';

const supabase = new SupabaseService();

export async function checkInactivity() {
  try {
    console.log('🔍 Checking patient inactivity...');

    // Get all patients
    const { data: patients } = await supabase.client
      .from('patients')
      .select('id, first_name, last_name, line_user_id');

    if (!patients) return;

    for (const patient of patients) {
      // Get last activity
      const { data: lastLog } = await supabase.client
        .from('health_logs')
        .select('logged_at')
        .eq('patient_id', patient.id)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single();

      if (!lastLog) continue;

      const hoursSinceActivity = (Date.now() - new Date(lastLog.logged_at).getTime()) / (1000 * 60 * 60);

      // Check alert levels
      let shouldAlert = false;
      let severity = 'info';
      let title = '';

      if (hoursSinceActivity >= 12) {
        shouldAlert = true;
        severity = 'critical';
        title = 'ไม่มีกิจกรรม 12 ชั่วโมง';
      } else if (hoursSinceActivity >= 8) {
        shouldAlert = true;
        severity = 'urgent';
        title = 'ไม่มีกิจกรรม 8 ชั่วโมง';
      } else if (hoursSinceActivity >= 4) {
        shouldAlert = true;
        severity = 'warning';
        title = 'ไม่มีกิจกรรม 4 ชั่วโมง';
      }

      if (shouldAlert) {
        // Check if alert already exists
        const { data: existingAlert } = await supabase.client
          .from('alerts')
          .select('id')
          .eq('patient_id', patient.id)
          .eq('alert_type', 'inactivity')
          .eq('status', 'active')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (!existingAlert) {
          // Create new alert
          await supabase.client.from('alerts').insert({
            patient_id: patient.id,
            alert_type: 'inactivity',
            severity,
            title,
            message: `${patient.first_name} ${patient.last_name} ไม่มีกิจกรรมมา ${Math.round(hoursSinceActivity)} ชั่วโมง`,
            alert_data: {
              hours_since_activity: hoursSinceActivity,
              last_activity: lastLog.logged_at
            },
            status: 'active'
          });

          console.log(`⚠️ Inactivity alert created for ${patient.first_name}`);
        }
      }
    }

  } catch (error) {
    console.error('Error checking inactivity:', error);
  }
}

// Run every hour
if (process.env.NODE_ENV === 'production') {
  setInterval(checkInactivity, 60 * 60 * 1000);
}
```

### 5. Update IntentAgent

**File:** `src/agents/specialized/IntentAgent.ts`

```typescript
private patterns = {
  // ... existing patterns
  emergency: [
    /ฉุกเฉิน/, /ช่วยด้วย/, /emergency/, /help/,
    /เจ็บ/, /ปวด/, /หายใจไม่ออก/, /เป็นลม/
  ]
};
```

### 6. Update OrchestratorAgent

**File:** `src/agents/core/OrchestratorAgent.ts`

```typescript
case 'emergency':
  plan.agents = ['alert', 'health'];
  plan.parallel = true;
  break;
```

### 7. Register Routes

**File:** `src/index.ts`

```typescript
import alertRoutes from './routes/alert.routes';

app.use('/api/alerts', alertRoutes);

// Handle postback for alert acknowledgement
app.post('/webhook', async (req, res) => {
  // ... existing code

  events.map(async (event) => {
    switch (event.type) {
      // ... existing cases
      case 'postback':
        return handlePostback(event);
    }
  });
});

async function handlePostback(event: any) {
  try {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');
    const alertId = data.get('alert_id');

    if (action === 'acknowledge' && alertId) {
      const userId = event.source?.userId;

      // Get caregiver
      const { data: caregiver } = await supabase.client
        .from('caregivers')
        .select('id')
        .eq('line_user_id', userId)
        .single();

      if (caregiver) {
        // Acknowledge alert
        await fetch(`${process.env.API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caregiver_id: caregiver.id })
        });

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '✅ รับทราบแจ้งเตือนแล้วค่ะ'
        });
      }
    }
  } catch (error) {
    console.error('Error handling postback:', error);
  }
}
```

---

## 📂 Files to Create/Modify

### New Files:
1. `src/routes/alert.routes.ts` - Alert API endpoints
2. `src/jobs/inactivity-monitor.ts` - Cron job for inactivity monitoring
3. `database/migrations/005_alerts.sql` - Alerts and notification tables

### Modified Files:
1. `src/agents/specialized/AlertAgent.ts` - Complete implementation
2. `src/agents/specialized/IntentAgent.ts` - Add emergency patterns
3. `src/agents/core/OrchestratorAgent.ts` - Add emergency routing
4. `src/index.ts` - Register routes, handle postback

---

## ✅ Testing Checklist

### API Tests
- [ ] POST /api/alerts/create
- [ ] POST /api/alerts/:alert_id/acknowledge
- [ ] POST /api/alerts/:alert_id/resolve
- [ ] GET /api/alerts/patient/:patient_id

### Alert Detection Tests
- [ ] พิมพ์ "ฉุกเฉิน" → สร้าง critical alert
- [ ] วัดความดัน 180/100 → สร้าง urgent alert
- [ ] ไม่มีกิจกรรม 4 ชม. → สร้าง warning alert
- [ ] ไม่มีกิจกรรม 12 ชม. → สร้าง critical alert

### Notification Tests
- [ ] Alert ส่งถึงผู้ดูแลทุกคน
- [ ] Flex Message แสดงผลถูกต้อง
- [ ] ปุ่ม "รับทราบ" ทำงาน
- [ ] Log notification บันทึกถูกต้อง

---

## 🚀 Deployment

```bash
# Create migration
cat > database/migrations/005_alerts.sql << 'EOF'
-- (SQL code from above)
EOF

# Run migration
psql $SUPABASE_DB_URL -f database/migrations/005_alerts.sql

# Build and test
npm run build
npm test

# Commit
git add .
git commit -m "Add alert system with emergency detection and caregiver notifications"
git push origin master
```

---

## 📊 Success Metrics

- ✅ Alert delivery < 5 วินาที
- ✅ Notification success rate > 95%
- ✅ False alert rate < 5%
- ✅ Response time to critical alerts < 10 นาที

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
