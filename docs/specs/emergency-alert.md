# Emergency Alert System

> Critical emergency response and escalation system

---

## Feature Name
Emergency Alert & Response System

## Overview
ระบบแจ้งเหตุฉุกเฉินที่ตรวจจับ keywords และส่งการแจ้งเตือนไปยังญาติ/ผู้ดูแลทันที
รวมถึงระบบ escalation หากไม่มีการตอบกลับ

## User Story
**As a** ผู้สูงอายุที่อยู่คนเดียว
**I want** ระบบช่วยเหลือฉุกเฉินที่รวดเร็ว
**So that** ได้รับความช่วยเหลือทันทีเมื่อมีปัญหา

## Requirements

### Functional Requirements
- [ ] FR-1: ตรวจจับ emergency keywords (ฉุกเฉิน, ช่วยด้วย, เจ็บหน้าอก, หายใจไม่ออก)
- [ ] FR-2: ส่ง alert ไป LINE ญาติทุกคนทันที (within 5 seconds)
- [ ] FR-3: โทรอัตโนมัติหากเป็น critical keywords
- [ ] FR-4: ปุ่ม SOS สำหรับกดขอความช่วยเหลือ
- [ ] FR-5: ส่งตำแหน่งที่อยู่พร้อม alert
- [ ] FR-6: Escalation: ถ้าญาติไม่ตอบ 2 นาที → โทร / SMS
- [ ] FR-7: บันทึก emergency event ทั้งหมด
- [ ] FR-8: ตรวจจับ no-response timeout (ไม่ตอบข้อความ 8 ชม → alert)
- [ ] FR-9: Auto-call 1669 สำหรับ critical cases
- [ ] FR-10: False alarm handling (ยกเลิกได้ภายใน 30 วินาที)

### Technical Requirements
- [ ] TR-1: Real-time notification (<5 seconds)
- [ ] TR-2: Multiple notification channels (LINE, SMS, Phone call)
- [ ] TR-3: Geolocation tracking
- [ ] TR-4: 99.9% uptime requirement
- [ ] TR-5: Redundancy (backup notification methods)

## Data Model

### Database Schema
```sql
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  alert_type VARCHAR(50) NOT NULL, -- 'medical', 'fall', 'panic', 'no_response', 'manual'
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  location JSONB, -- {address, lat, lng}
  trigger_keywords TEXT[],
  status VARCHAR(20) CHECK (status IN ('active', 'acknowledged', 'resolved', 'false_alarm')),
  triggered_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  contact_user_id UUID REFERENCES users(id) NOT NULL,
  relationship VARCHAR(50), -- 'spouse', 'child', 'sibling', 'caregiver'
  priority INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary
  phone_number VARCHAR(20),
  line_user_id VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE emergency_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES emergency_alerts(id) NOT NULL,
  contact_id UUID REFERENCES emergency_contacts(id) NOT NULL,
  notification_channel VARCHAR(20), -- 'line', 'sms', 'call'
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  responded_at TIMESTAMP,
  response_action VARCHAR(50), -- 'acknowledged', 'on_the_way', 'false_alarm'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_patient_status ON emergency_alerts(patient_id, status, triggered_at DESC);
CREATE INDEX idx_contacts_patient_priority ON emergency_contacts(patient_id, priority);
```

### TypeScript Types
```typescript
interface EmergencyAlert {
  id: string;
  patientId: string;
  alertType: 'medical' | 'fall' | 'panic' | 'no_response' | 'manual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  location?: {
    address: string;
    lat: number;
    lng: number;
  };
  triggerKeywords?: string[];
  status: 'active' | 'acknowledged' | 'resolved' | 'false_alarm';
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

interface EmergencyContact {
  id: string;
  patientId: string;
  contactUserId: string;
  relationship: string;
  priority: number;
  phoneNumber?: string;
  lineUserId?: string;
  isActive: boolean;
}

// Emergency keywords by severity
const EMERGENCY_KEYWORDS = {
  critical: ['เจ็บหน้าอก', 'หายใจไม่ออก', 'ช็อก', 'เป็นลม', 'ไม่รู้สึกตัว'],
  high: ['ฉุกเฉิน', 'ช่วยด้วย', 'หกล้ม', 'เจ็บมาก'],
  medium: ['ไม่สบาย', 'ปวดหัว', 'วิงเวียน', 'คลื่นไส้'],
  low: ['เหนื่อย', 'อ่อนเพลีย']
};
```

## API Design

```typescript
class EmergencyAgent extends BaseAgent {
  /**
   * Trigger emergency alert
   */
  async triggerAlert(params: {
    patientId: string;
    message: string;
    alertType: string;
    severity?: string;
    location?: Location;
  }): Promise<EmergencyAlert>

  /**
   * Detect emergency from message
   */
  async detectEmergency(message: string): Promise<{
    isEmergency: boolean;
    severity: string;
    keywords: string[];
    confidence: number;
  }>

  /**
   * Notify all emergency contacts
   */
  async notifyContacts(alertId: string): Promise<{
    sent: number;
    failed: number;
  }>

  /**
   * Escalate alert if no response
   */
  async escalateAlert(alertId: string): Promise<void>

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(params: {
    alertId: string;
    userId: string;
    action: string;
  }): Promise<EmergencyAlert>

  /**
   * Cancel false alarm
   */
  async cancelAlert(params: {
    alertId: string;
    reason: string;
  }): Promise<EmergencyAlert>

  /**
   * Check for no-response timeout
   */
  async checkNoResponse(patientId: string): Promise<boolean>
}
```

## Escalation Matrix

```typescript
const ESCALATION_STEPS = [
  {
    delay: 0, // immediate
    channels: ['line'],
    targets: 'all_contacts'
  },
  {
    delay: 120, // 2 minutes
    channels: ['sms', 'call'],
    targets: 'primary_contacts'
  },
  {
    delay: 300, // 5 minutes
    channels: ['call'],
    targets: 'all_contacts'
  },
  {
    delay: 600, // 10 minutes (critical only)
    channels: ['emergency_services'],
    targets: '1669'
  }
];
```

## Testing Strategy

### Test Scenarios
1. **Critical**: "เจ็บหน้าอก" → Immediate alert to all + call primary
2. **High**: "ฉุกเฉิน ช่วยด้วย" → Alert to all contacts
3. **SOS Button**: กดปุ่ม SOS → Alert with location
4. **No Response**: ไม่ตอบข้อความ 8 ชม → Alert to caregivers
5. **False Alarm**: ผู้ใช้กดยกเลิกภายใน 30 วินาที
6. **Escalation**: ญาติไม่ตอบ 2 นาที → SMS + Call
7. **Acknowledged**: ญาติกด "รับทราบ" → หยุด escalation

## Timeline

**Estimated**: 16 hours (2 days)
- Core alert system: 8 hours
- Escalation logic: 4 hours
- Testing & safety checks: 4 hours

## Examples

### Input
```
"ฉุกเฉิน ช่วยด้วย เจ็บหน้าอก"
[SOS Button Pressed]
[No message for 8 hours]
```

### Output - Alert to Caregivers
```json
{
  "type": "flex",
  "altText": "🚨 EMERGENCY ALERT",
  "contents": {
    "type": "bubble",
    "header": {
      "type": "box",
      "backgroundColor": "#FF0000",
      "contents": [{
        "type": "text",
        "text": "🚨 สถานการณ์ฉุกเฉิน",
        "color": "#FFFFFF",
        "size": "xl",
        "weight": "bold"
      }]
    },
    "body": {
      "type": "box",
      "contents": [
        { "type": "text", "text": "👤 คุณสมชาย (คุณปู่)", "weight": "bold" },
        { "type": "text", "text": "💬 'เจ็บหน้าอก ช่วยด้วย'", "color": "#FF0000" },
        { "type": "text", "text": "⏰ 14:32 น.", "color": "#999999" },
        { "type": "text", "text": "📍 123 ถ.สุขุมวิท กรุงเทพฯ" }
      ]
    },
    "footer": {
      "type": "box",
      "contents": [
        {
          "type": "button",
          "action": { "type": "uri", "label": "📞 โทรทันที", "uri": "tel:0812345678" },
          "style": "primary",
          "color": "#FF0000"
        },
        {
          "type": "button",
          "action": { "type": "message", "label": "✅ รับทราบ กำลังไป", "text": "acknowledged" },
          "style": "secondary"
        },
        {
          "type": "button",
          "action": { "type": "uri", "label": "🗺️ เปิดแผนที่", "uri": "https://maps.google.com/?q=..." }
        }
      ]
    }
  }
}
```

## Safety Considerations

### Critical Requirements
- **Zero Tolerance for Failure**: Emergency system must work 24/7
- **Redundancy**: Multiple notification channels
- **Fast Response**: <5 seconds for critical alerts
- **Clear Escalation**: Well-defined steps
- **False Alarm Protection**: Easy cancellation within 30 seconds
- **Privacy**: Location data encrypted
- **Testing**: Regular drills and tests

### Fail-safes
- Backup notification server
- Fallback to SMS if LINE fails
- Auto-retry on failed sends
- Manual override for caregivers
- Logging all alert events

---

**Created**: 2024-01-16
**Priority**: CRITICAL (Life-saving feature)
**Status**: Ready for implementation
**Note**: Requires thorough testing and monitoring
