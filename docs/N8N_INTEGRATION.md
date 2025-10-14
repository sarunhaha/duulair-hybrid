# 🔄 N8N Integration Guide

> Automate workflows and integrate external services with Duulair Multi-Agent System

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Use Cases](#use-cases)
3. [Setup N8N](#setup-n8n)
4. [Workflow Examples](#workflow-examples)
5. [API Endpoints](#api-endpoints)
6. [Best Practices](#best-practices)

---

## Overview

N8N เป็น workflow automation tool ที่ใช้เชื่อมต่อ Duulair กับ external services ผ่าน:

- 📨 **Webhooks** - รับ/ส่งข้อมูลแบบ real-time
- ⏰ **Scheduled Tasks** - รันงานตาม schedule
- 🔗 **External APIs** - เชื่อมกับ services อื่นๆ
- 🔄 **Data Transformation** - แปลงข้อมูลก่อนส่งเข้า agents

---

## Use Cases

### 1. 📅 Scheduled Medication Reminders

N8N ส่ง reminder ตามเวลาที่กำหนด:

```
N8N Schedule (9:00 AM)
  ↓
Query Supabase (patients + medication schedule)
  ↓
Send to Duulair API (/test endpoint)
  ↓
Dialog Agent responds
  ↓
Send LINE message to patient
```

### 2. 🔔 External Alert Integration

เชื่อม Duulair กับ external monitoring systems:

```
IoT Device (Blood Pressure Monitor)
  ↓
N8N Webhook receives data
  ↓
Transform to Duulair format
  ↓
POST to /test endpoint
  ↓
Health Agent logs + Alert Agent notifies
```

### 3. 📊 Daily Report Generation

Auto-generate reports ทุกวันเวลา 8 PM:

```
N8N Schedule (8:00 PM)
  ↓
Fetch patient data from Supabase
  ↓
Send to Report Agent
  ↓
Generate PDF report
  ↓
Email to caregivers
```

### 4. 🔗 Third-Party Service Integration

เชื่อมกับ Google Calendar, Notion, Slack, etc:

```
Google Calendar Event (Doctor Appointment)
  ↓
N8N receives webhook
  ↓
Send reminder to Duulair
  ↓
Dialog Agent creates friendly message
  ↓
Notify patient via LINE
```

---

## Setup N8N

### Option 1: N8N Cloud (Easiest)

1. Go to https://n8n.io
2. Sign up for N8N Cloud
3. Create new workflow

### Option 2: Self-Hosted (Free)

```bash
# Install N8N globally
npm install n8n -g

# Run N8N
n8n start

# Access at http://localhost:5678
```

### Option 3: Docker

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

---

## Workflow Examples

### Example 1: Daily Medication Reminder

**N8N Workflow:**

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.schedule",
      "name": "Every day 9 AM",
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 24
            }
          ]
        },
        "hour": 9,
        "minute": 0
      }
    },
    {
      "type": "n8n-nodes-base.supabase",
      "name": "Get Patients",
      "parameters": {
        "operation": "getAll",
        "tableId": "patients",
        "returnAll": true
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Send to Duulair",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/test",
        "options": {
          "bodyContentType": "json"
        },
        "bodyParametersJson": "={\"message\": \"เวลากินยาแล้วค่ะ อย่าลืมนะคะ\", \"context\": {\"source\": \"n8n\", \"userId\": \"{{$json.line_user_id}}\", \"patientId\": \"{{$json.id}}\"}}"
      }
    }
  ]
}
```

**How it works:**
1. ⏰ Trigger at 9:00 AM daily
2. 📊 Fetch all patients from Supabase
3. 🔄 Loop through each patient
4. 📨 Send medication reminder to Duulair
5. 💊 Health Agent logs + Dialog Agent responds
6. 📱 LINE message sent to patient

---

### Example 2: IoT Blood Pressure Monitor

**N8N Workflow:**

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "Webhook",
      "parameters": {
        "path": "bp-monitor",
        "responseMode": "responseNode"
      }
    },
    {
      "type": "n8n-nodes-base.function",
      "name": "Transform Data",
      "parameters": {
        "functionCode": "const data = items[0].json;\nreturn [{\n  json: {\n    message: `วัดความดันได้ ${data.systolic}/${data.diastolic}`,\n    context: {\n      source: 'n8n',\n      patientId: data.patientId,\n      userId: data.userId\n    },\n    metadata: {\n      device: 'IoT BP Monitor',\n      systolic: data.systolic,\n      diastolic: data.diastolic,\n      heartRate: data.heartRate\n    }\n  }\n}];"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Send to Duulair",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/test",
        "options": {
          "bodyContentType": "json"
        },
        "bodyParametersJson": "={{$json}}"
      }
    },
    {
      "type": "n8n-nodes-base.respondToWebhook",
      "name": "Respond",
      "parameters": {
        "responseBody": "={{$json}}"
      }
    }
  ]
}
```

**How it works:**
1. 📡 IoT device sends BP reading to N8N webhook
2. 🔄 Transform device data to Duulair format
3. 📨 POST to Duulair `/test` endpoint
4. 💊 Health Agent validates and logs vitals
5. 🚨 Alert Agent checks for abnormal values
6. ✅ Respond to IoT device

---

### Example 3: Weekly Report Generation

**N8N Workflow:**

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.schedule",
      "name": "Every Sunday 8 PM",
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "weeks",
              "weeksInterval": 1
            }
          ]
        },
        "dayOfWeek": 0,
        "hour": 20,
        "minute": 0
      }
    },
    {
      "type": "n8n-nodes-base.supabase",
      "name": "Get Patients",
      "parameters": {
        "operation": "getAll",
        "tableId": "patients"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Generate Report",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/test",
        "bodyParametersJson": "={\"message\": \"ขอรายงานสัปดาห์นี้\", \"context\": {\"source\": \"n8n\", \"patientId\": \"{{$json.id}}\"}, \"metadata\": {\"reportType\": \"weekly\"}}"
      }
    },
    {
      "type": "n8n-nodes-base.emailSend",
      "name": "Email Report",
      "parameters": {
        "fromEmail": "reports@duulair.com",
        "toEmail": "={{$json.caregiver_email}}",
        "subject": "Weekly Health Report - {{$json.patient_name}}",
        "html": "={{$json.response}}"
      }
    }
  ]
}
```

---

### Example 4: Google Calendar Integration

**Scenario:** ส่ง reminder เมื่อมีนัดหมายใน Google Calendar

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.googleCalendar",
      "name": "Get Upcoming Events",
      "parameters": {
        "operation": "getAll",
        "calendarId": "primary",
        "timeMin": "={{$now}}",
        "timeMax": "={{$now.plus({hours: 24})}}"
      }
    },
    {
      "type": "n8n-nodes-base.filter",
      "name": "Filter Doctor Appointments",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.summary}}",
              "operation": "contains",
              "value2": "หมอ"
            }
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Send Reminder",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/test",
        "bodyParametersJson": "={\"message\": \"พรุ่งนี้มีนัดหมาย{{$json.summary}} เวลา {{$json.start.dateTime}}\", \"context\": {\"source\": \"n8n\"}}"
      }
    }
  ]
}
```

---

## API Endpoints

### POST /test

Use this endpoint for N8N integrations:

```bash
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{
    "message": "ข้อความจาก N8N",
    "context": {
      "source": "n8n",
      "userId": "U123456",
      "patientId": "P789"
    },
    "metadata": {
      "workflow": "medication-reminder",
      "timestamp": "2024-01-01T09:00:00Z"
    }
  }'
```

**Request Body:**

```typescript
{
  message: string;           // ข้อความที่ต้องการให้ Agent ประมวลผล
  context: {
    source: "n8n";          // ระบุว่ามาจาก N8N
    userId?: string;         // LINE User ID (optional)
    patientId?: string;      // Patient ID from Supabase
    sessionId?: string;      // Session tracking (optional)
  };
  metadata?: {               // ข้อมูลเพิ่มเติม (optional)
    workflow?: string;       // N8N workflow name
    [key: string]: any;      // Custom fields
  };
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [...],
    "combined": {
      "response": "คำตอบจาก Agent",
      "intent": "medication"
    }
  },
  "agentName": "orchestrator",
  "processingTime": 3000,
  "metadata": {
    "intent": "medication",
    "confidence": 0.95,
    "agentsInvolved": ["intent", "health"]
  }
}
```

---

### POST /webhook (for LINE)

N8N can also trigger LINE webhook processing:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "type": "message",
      "message": {
        "id": "12345",
        "text": "กินยาแล้ว"
      },
      "source": {
        "userId": "U123456"
      }
    }]
  }'
```

---

## Best Practices

### 1. ✅ Error Handling

Always add error handling in N8N workflows:

```javascript
// N8N Function Node
try {
  const response = await $http.post('http://localhost:3000/test', {
    message: items[0].json.message,
    context: { source: 'n8n' }
  });
  return [{ json: response }];
} catch (error) {
  // Log error
  console.error('Duulair API Error:', error);

  // Send alert
  await $http.post('https://your-alert-webhook.com', {
    error: error.message,
    workflow: 'medication-reminder'
  });

  return [{ json: { error: error.message } }];
}
```

### 2. 🔄 Rate Limiting

Avoid overwhelming the API:

```javascript
// N8N Function Node - Add delay between requests
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const patient of items) {
  await processPatient(patient);
  await delay(1000); // 1 second delay
}
```

### 3. 📊 Logging

Track N8N executions in metadata:

```json
{
  "message": "...",
  "metadata": {
    "source": "n8n",
    "workflow_id": "{{$workflow.id}}",
    "execution_id": "{{$execution.id}}",
    "timestamp": "{{$now}}"
  }
}
```

### 4. 🔐 Security

Use environment variables for sensitive data:

```javascript
// N8N Credentials
const DUULAIR_API_URL = $env.DUULAIR_API_URL;
const API_KEY = $env.DUULAIR_API_KEY; // If needed

$http.post(DUULAIR_API_URL + '/test', {
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  },
  ...
});
```

### 5. ✅ Validation

Validate data before sending:

```javascript
// N8N Function Node
const validateMessage = (data) => {
  if (!data.message) {
    throw new Error('Message is required');
  }
  if (!data.context?.source) {
    data.context = { ...data.context, source: 'n8n' };
  }
  return data;
};

return items.map(item => ({
  json: validateMessage(item.json)
}));
```

---

## Advanced Examples

### Example: Multi-Agent Coordination via N8N

```javascript
// N8N Code Node
const orchestrate = async (patientId) => {
  // Step 1: Get health data
  const healthData = await $http.post('http://localhost:3000/test', {
    message: 'วัดความดันได้ 140/90',
    context: { source: 'n8n', patientId }
  });

  // Step 2: If abnormal, generate report
  if (healthData.metadata.alert) {
    const report = await $http.post('http://localhost:3000/test', {
      message: 'ขอรายงานสุขภาพด่วน',
      context: { source: 'n8n', patientId },
      metadata: { trigger: 'abnormal_vitals' }
    });

    // Step 3: Send to caregivers
    await sendLineMessage(report.data.combined.response);
  }

  return healthData;
};
```

---

## Monitoring

### N8N Execution Logs

Track N8N workflow execution in Supabase:

```sql
-- Add to database-schema.sql
CREATE TABLE n8n_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id VARCHAR(255),
  execution_id VARCHAR(255),
  status VARCHAR(50),
  input JSONB,
  output JSONB,
  error TEXT,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Webhook for Monitoring

```javascript
// N8N Function Node - Log execution
await $http.post('http://localhost:3000/n8n/log', {
  workflow_id: $workflow.id,
  execution_id: $execution.id,
  status: 'success',
  duration: $execution.duration
});
```

---

## Troubleshooting

### Issue: N8N can't connect to Duulair

**Solution:**
1. Check Duulair is running: `npm run dev`
2. Verify URL is correct (use http://localhost:3000 for local)
3. Check firewall/network settings
4. Use ngrok for local testing: `ngrok http 3000`

### Issue: Webhook not triggering

**Solution:**
1. Verify webhook URL is accessible
2. Check N8N webhook path matches
3. Test with curl first
4. Check N8N execution logs

### Issue: Data transformation errors

**Solution:**
1. Use N8N's "Execute Node" to test transformations
2. Add console.log() in Function nodes
3. Check JSON structure matches Duulair API

---

## Resources

- **N8N Documentation**: https://docs.n8n.io/
- **N8N Community**: https://community.n8n.io/
- **Duulair API**: See [docs/SETUP.md](SETUP.md)
- **Workflow Templates**: https://n8n.io/workflows/

---

**Ready to automate! 🚀**
