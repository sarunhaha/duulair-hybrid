// docs/Claude.md
# 🤖 OONJAI Multi-Agent System - Claude Integration Guide

## Overview
This document defines the behavior, capabilities, and constraints for Claude agents in the OONJAI system.

## Current Status (2025-11-23)
- **Brand**: OONJAI (formerly Duulair)
- **Model**: Group-Based Care - Caregivers manage patient care via LINE groups
- **Features**: Activity logging, Image OCR, Patient info queries, Reports
- **Latest Fix**: Report menu Flex Message now properly displays with interactive buttons

## System Architecture
```mermaid
graph TB
    subgraph "User Layer"
        U1[LINE Users]
        U2[Caregivers]
        U3[Patients]
    end
    
    subgraph "Agent Layer"
        O[Orchestrator]
        I[Intent Agent]
        H[Health Agent]
        R[Report Agent]
        A[Alert Agent]
        D[Dialog Agent]
    end
    
    subgraph "Data Layer"
        S[(Supabase)]
        C[Claude API]
    end
    
    U1 --> O
    O --> I
    O --> H
    O --> R
    O --> A
    O --> D
    
    I --> C
    H --> S
    R --> S
    A --> S
    D --> C


Agent Specifications


1. Intent Classification Agent
Role: Classify user messages into predefined intents
Model: claude-3-haiku-20240307
Temperature: 0.1 (high precision)
System Prompt:
You are an intent classifier for a Thai elderly care system.
Classify messages into these categories:
- medication (ยา, การกินยา)
- vitals (ความดัน, วัดผลเลือด)
- water (น้ำ, การดื่มน้ำ)
- walk (เดิน, ออกกำลังกาย)
- food (อาหาร, มื้ออาหาร)
- emergency (ฉุกเฉิน, ต้องการความช่วยเหลือ)
- report (รายงาน, สรุป)
- other (อื่นๆ)

Output format: {"intent": "...", "confidence": 0.0-1.0, "entities": {...}}



2. Health Logging Agent
Role: Process and validate health-related data
Capabilities:

- OCR for blood pressure readings (via Claude Vision)
- Image message support - extract BP values from photos
- Food image classification
- Medication verification
- Context-aware responses (1:1 vs group chat)

**Image OCR Flow** (added 2024-11-19):
```typescript
// In src/index.ts - handleImageMessage()
// 1. Get image from LINE using getMessageContent()
// 2. Convert to base64
// 3. Send to Claude Vision (claude-3-haiku-20240307)
// 4. Extract systolic, diastolic, pulse
// 5. Save to database with source: 'image_ocr'
// 6. Return response with alerts if BP abnormal
```

Validation Rules:
const healthValidation = {
  bloodPressure: {
    systolic: { min: 70, max: 200 },
    diastolic: { min: 40, max: 130 }
  },
  heartRate: { min: 40, max: 200 },
  bloodSugar: { min: 50, max: 400 },
  water: { min: 0, max: 5000 } // ml per day
};



3. Report Generation Agent
Role: Create daily and weekly summaries
Model: claude-3-sonnet-20240229
Temperature: 0.7 (balanced creativity)
Report Template:
Daily Report for {patientName}
Date: {date}

Summary:
- Completion Rate: {percentage}%
- Medications Taken: {med_count}/{med_total}
- Activities Completed: {activities}

Insights:
{ai_generated_insights}

Alerts:
{critical_alerts}



4. Alert Agent
Role: Monitor and escalate critical situations
Triggers:

Emergency keywords detected
No response > threshold hours
Abnormal vital signs
Missed medications > 2 times

Escalation Matrix:
**Level 1 - Info**
- Condition: Missed activity
- Action: Log
- Notification: None

**Level 2 - Warning**
- Condition: No response 4h
- Action: Remind
- Notification: Patient

**Level 3 - Urgent**
- Condition: No response 8h
- Action: Alert
- Notification: Primary caregiver

**Level 4 - Critical**
- Condition: Emergency
- Action: Urgent
- Notification: All caregivers


5. Dialog Agent
Role: Handle general conversations
Model: claude-3-haiku-20240307
Temperature: 0.8 (more natural)
Conversation Rules:
1. Keep responses brief (< 50 words)
2. Always be respectful and use appropriate Thai pronouns
3. Don't provide medical advice
4. Redirect to appropriate agents when needed
5. Use supportive but not overly emotional language

Safety Guidelines
Medical Safety

❌ Never diagnose conditions
❌ Never recommend medication changes
✅ Encourage consulting healthcare providers
✅ Log all health data accurately

Privacy & Security

All patient data encrypted at rest
No PII in logs
Audit trail for all actions
PDPA compliant

Error Handling
def safe_process(message):
    try:
        # Process message
        result = process(message)
        
        # Validate output
        if not is_safe(result):
            return fallback_response()
            
        return result
        
    except Exception as e:
        log_error(e)
        return {
            "response": "ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่",
            "error": str(e)
        }

        Performance Metrics
Target SLAs

Intent Classification: < 500ms
Health Data Processing: < 1s
Report Generation: < 3s
Alert Detection: < 100ms


Monitoring
-- Query for agent performance
SELECT 
    agent_name,
    AVG(processing_time) as avg_time,
    COUNT(*) as total_processed,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count
FROM agent_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_name;



Integration Points
LINE Messaging API
// Quick Reply Template
{
  "type": "text",
  "text": "เลือกกิจกรรมที่ทำแล้ว",
  "quickReply": {
    "items": [
      {
        "type": "action",
        "action": {
          "type": "message",
          "label": "💊 กินยา",
          "text": "กินยาแล้ว"
        }
      },
      {
        "type": "action",
        "action": {
          "type": "message",
          "label": "💧 ดื่มน้ำ",
          "text": "ดื่มน้ำแล้ว"
        }
      }
    ]
  }
}


Supabase Realtime
// Subscribe to emergency alerts
supabase
  .channel('emergency-alerts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'alerts',
    filter: 'level=eq.emergency'
  }, (payload) => {
    handleEmergencyAlert(payload.new);
  })
  .subscribe();



Testing Guidelines

Unit Test Example

describe('IntentAgent', () => {
  it('should classify medication intent correctly', async () => {
    const agent = new IntentAgent();
    const result = await agent.process({
      content: 'กินยาแล้วค่ะ',
      context: { source: 'line' }
    });
    
    expect(result.data.intent).toBe('medication');
    expect(result.data.confidence).toBeGreaterThan(0.8);
  });
});


Integration Test

# Test full flow
curl -X POST http://localhost:3000/test/full-flow \
  -H "Content-Type: application/json" \
  -d '{
    "message": "วัดความดันได้ 120/80",
    "userId": "test-user",
    "patientId": "test-patient"
  }'



Deployment

Environment Variables

# Production settings
NODE_ENV=production
ANTHROPIC_API_KEY=${SECRET_ANTHROPIC_KEY}
SUPABASE_URL=${PROD_SUPABASE_URL}
LOG_LEVEL=info
MAX_WORKERS=4


Docker Deployment

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

Troubleshooting
Common Issues

High Latency: Check Claude API rate limits
Intent Misclassification: Review and update training prompts
Memory Leaks: Monitor agent state size
Database Timeouts: Check Supabase connection pool


Debug Mode
// Enable debug logging
process.env.DEBUG = 'agent:*';
process.env.LOG_LEVEL = 'debug';

## Group-Based Care Model (TASK-002)

### Context Handling
The system differentiates between 1:1 chat and group chat contexts:

```typescript
// Message context includes:
{
  source: '1:1' | 'group',
  groupId: string | null,
  actorLineUserId: string,  // Person who sent message
  actorDisplayName: string,
  patientId: string         // Linked patient for the group
}
```

### Response Priority
In OrchestratorAgent.aggregateResponses():
- HealthAgent responses take priority over DialogAgent
- Prevents group users from being told to click Rich Menu buttons

### Patient Info Queries (for group chat)
Intents: patient_info, patient_name, patient_age, patient_conditions, patient_medications, patient_allergies, group_help

Example: "@oonjai ชื่อผู้ป่วยอะไร" → Returns patient name from database

---

Future Enhancements

- [ ] Multi-language support (Thai, English, Chinese)
- [ ] Voice message processing
- [ ] Predictive health alerts
- [ ] Integration with wearable devices
- [ ] Advanced NLP with context memory
- [x] Image OCR for blood pressure (2024-11-19)
- [x] Group-based care model (TASK-002)
- [x] Report menu Flex Message with interactive buttons (2025-11-23)


Last Updated: 2025-11-23
Version: 1.2.0

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>