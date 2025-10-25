# Duulair - Task Specifications

เอกสารนี้รวบรวม Task Specifications ทั้งหมดสำหรับการพัฒนา Duulair Platform

---

## 📋 Task Overview

| Task ID | Feature | Priority | Time | Dependencies | Owner |
|---------|---------|----------|------|--------------|-------|
| [TASK-001](TASK-001-liff-registration-app.md) | LIFF Registration App | 🔴 CRITICAL | 4-6h | None | Frontend/LIFF |
| [TASK-002](TASK-002-rich-menu-responses.md) | Rich Menu Responses | 🟡 High | 1-2h | None | Backend/IntentAgent |
| [TASK-003](TASK-003-health-logging-features.md) | Health Logging Features | 🔴 CRITICAL | 6-8h | TASK-001 | Backend/HealthAgent |
| [TASK-004](TASK-004-daily-weekly-reports.md) | Daily/Weekly Reports | 🟡 High | 4-5h | TASK-003 | Backend/ReportAgent |
| [TASK-005](TASK-005-alert-system.md) | Alert System | 🔴 CRITICAL | 5-6h | TASK-001, TASK-003 | Backend/AlertAgent |
| [TASK-006](TASK-006-scheduler-reminders.md) | Scheduler & Reminders | 🟡 High | 6-8h | TASK-001, TASK-003 | Backend/Scheduler |
| [TASK-007](TASK-007-image-processing-ocr.md) | Image Processing & OCR | 🟢 Medium | 6-8h | TASK-003 | Backend/AI |
| [TASK-008](TASK-008-caregiver-dashboard.md) | Caregiver Dashboard | 🟢 Medium | 8-10h | TASK-001, TASK-003, TASK-004, TASK-005 | Frontend/LIFF |

**Total Estimated Time:** 40-49 hours

---

## 🎯 Recommended Development Order

### Phase 1: Core Registration & Logging (Priority 🔴)
**Goal:** ให้ผู้ใช้ลงทะเบียนและบันทึกข้อมูลสุขภาพได้

1. **TASK-001: LIFF Registration App** (4-6h)
   - สร้างหน้าลงทะเบียนผู้ป่วยและผู้ดูแล
   - ระบบ Link Code เชื่อมต่อ
   - **Deliverable:** User สามารถลงทะเบียนผ่าน LIFF ได้

2. **TASK-002: Rich Menu Responses** (1-2h)
   - เพิ่ม Quick Reply สำหรับ Rich Menu buttons
   - Flex Messages สำหรับ Package/Help
   - **Deliverable:** Rich Menu ทุกปุ่มทำงานได้

3. **TASK-003: Health Logging Features** (6-8h)
   - บันทึกยา, ความดัน, น้ำ, ออกกำลังกาย, อาหาร
   - Validation และ AI extraction
   - **Deliverable:** User บันทึกข้อมูลสุขภาพได้ครบทุกประเภท

**Phase 1 Total:** 11-16 hours
**Checkpoint:** ✅ MVP - User สามารถลงทะเบียนและบันทึกข้อมูลได้

---

### Phase 2: Monitoring & Alerts (Priority 🔴)
**Goal:** ติดตามและแจ้งเตือนผู้ดูแลเมื่อมีปัญหา

4. **TASK-005: Alert System** (5-6h)
   - Emergency detection
   - Abnormal vitals alerts
   - Inactivity monitoring
   - **Deliverable:** ผู้ดูแลได้รับแจ้งเตือนเมื่อเกิดเหตุฉุกเฉิน

5. **TASK-004: Daily/Weekly Reports** (4-5h)
   - รายงานประจำวัน/สัปดาห์
   - AI Insights
   - **Deliverable:** User และผู้ดูแลเห็นสรุปสุขภาพ

**Phase 2 Total:** 9-11 hours
**Checkpoint:** ✅ ระบบแจ้งเตือนและรายงานทำงาน

---

### Phase 3: Automation & Enhancement (Priority 🟡)
**Goal:** ทำให้ระบบอัตโนมัติและใช้งานสะดวกขึ้น

6. **TASK-006: Scheduler & Reminders** (6-8h)
   - Medication reminders
   - Water/exercise reminders
   - Auto daily report
   - **Deliverable:** ระบบเตือนอัตโนมัติทำงาน

7. **TASK-007: Image Processing & OCR** (6-8h)
   - OCR ความดันโลหิต
   - OCR ฉลากยา
   - **Deliverable:** User ส่งรูปแทนพิมพ์ได้

**Phase 3 Total:** 12-16 hours
**Checkpoint:** ✅ ระบบอัตโนมัติและ AI ทำงาน

---

### Phase 4: Caregiver Tools (Priority 🟢)
**Goal:** Dashboard สำหรับผู้ดูแล

8. **TASK-008: Caregiver Dashboard** (8-10h)
   - Patient list & detail
   - Alerts management
   - Health trends & charts
   - **Deliverable:** ผู้ดูแลมี Dashboard ครบถ้วน

**Phase 4 Total:** 8-10 hours
**Checkpoint:** ✅ ระบบครบถ้วนทุก Feature

---

## 📊 Feature Completion Matrix

| Feature | TASK-001 | TASK-002 | TASK-003 | TASK-004 | TASK-005 | TASK-006 | TASK-007 | TASK-008 |
|---------|:--------:|:--------:|:--------:|:--------:|:--------:|:--------:|:--------:|:--------:|
| User Registration | ✅ | | | | | | | |
| Rich Menu UI | | ✅ | | | | | | |
| Health Logging | ✅ | | ✅ | | | | | |
| Reports | | | | ✅ | | | | |
| Alerts | | | | | ✅ | | | |
| Reminders | | | | | | ✅ | | |
| OCR/Vision | | | | | | | ✅ | |
| Caregiver Dashboard | ✅ | | | ✅ | ✅ | | | ✅ |

---

## 🛠 Technical Stack Summary

### Frontend
- **LIFF SDK** - LINE Front-end Framework
- **Vanilla JavaScript** - Simple and fast
- **Chart.js** - สำหรับกราฟ (TASK-008)
- **HTML5/CSS3** - Responsive design

### Backend
- **Node.js + Express** - API Server
- **TypeScript** - Type safety
- **Claude AI (Anthropic)** - Intent, Dialog, OCR, Insights
- **Supabase** - Database + Storage + Auth
- **LINE Bot SDK** - Messaging API
- **node-cron** - Task scheduling

### Multi-Agent System
- **OrchestratorAgent** - Main coordinator
- **IntentAgent** - Message classification
- **HealthAgent** - Health data processing
- **ReportAgent** - Report generation
- **AlertAgent** - Emergency & monitoring
- **DialogAgent** - General conversation

---

## 📂 Project Structure After Completion

```
duulair-hybrid/
├── liff/                           # LIFF Apps
│   ├── index.html                  # Entry point
│   ├── patient/                    # Patient registration (TASK-001)
│   ├── caregiver/                  # Caregiver dashboard (TASK-008)
│   └── shared/                     # Shared assets
│
├── src/
│   ├── agents/
│   │   ├── core/
│   │   │   ├── BaseAgent.ts
│   │   │   └── OrchestratorAgent.ts
│   │   └── specialized/
│   │       ├── IntentAgent.ts      # TASK-002, TASK-003
│   │       ├── HealthAgent.ts      # TASK-003
│   │       ├── ReportAgent.ts      # TASK-004
│   │       ├── AlertAgent.ts       # TASK-005
│   │       └── DialogAgent.ts
│   │
│   ├── routes/
│   │   ├── registration.routes.ts  # TASK-001
│   │   ├── health.routes.ts        # TASK-003
│   │   ├── report.routes.ts        # TASK-004
│   │   ├── alert.routes.ts         # TASK-005
│   │   ├── reminder.routes.ts      # TASK-006
│   │   └── image.routes.ts         # TASK-007
│   │
│   ├── services/
│   │   ├── supabase.service.ts
│   │   ├── scheduler.service.ts    # TASK-006
│   │   └── image-processing.service.ts  # TASK-007
│   │
│   ├── jobs/
│   │   └── inactivity-monitor.ts   # TASK-005
│   │
│   └── index.ts                    # Main entry point
│
├── database/
│   └── migrations/
│       ├── 001_user_registration.sql    # TASK-001
│       ├── 003_health_logs.sql          # TASK-003
│       ├── 004_report_views.sql         # TASK-004
│       ├── 005_alerts.sql               # TASK-005
│       ├── 006_reminders.sql            # TASK-006
│       └── 007_image_uploads.sql        # TASK-007
│
├── specs/
│   └── tasks/                      # 📍 You are here
│       ├── README.md
│       ├── TASK-001-liff-registration-app.md
│       ├── TASK-002-rich-menu-responses.md
│       ├── TASK-003-health-logging-features.md
│       ├── TASK-004-daily-weekly-reports.md
│       ├── TASK-005-alert-system.md
│       ├── TASK-006-scheduler-reminders.md
│       ├── TASK-007-image-processing-ocr.md
│       └── TASK-008-caregiver-dashboard.md
│
└── vercel.json
```

---

## 🚀 Quick Start Guide

### For Task TASK-001 (Start Here)
```bash
# Read the spec
cat specs/tasks/TASK-001-liff-registration-app.md

# Create directory
mkdir -p liff

# Start coding!
# Follow the spec's file structure and implementation guide
```

### For Backend Tasks (TASK-003, TASK-004, TASK-005, TASK-006, TASK-007)
```bash
# Read the spec
cat specs/tasks/TASK-00X-*.md

# Create migration
cat > database/migrations/00X_*.sql << 'EOF'
# (SQL from spec)
EOF

# Run migration
psql $SUPABASE_DB_URL -f database/migrations/00X_*.sql

# Create routes file
touch src/routes/*.routes.ts

# Implement following the spec

# Test
npm run dev
curl -X POST http://localhost:3000/api/...

# Commit
git add .
git commit -m "..."
git push
```

---

## ✅ Success Criteria

### MVP (Phase 1 Complete)
- [ ] ผู้ใช้ลงทะเบียนผ่าน LIFF ได้
- [ ] Rich Menu ทุกปุ่มทำงาน
- [ ] บันทึกข้อมูลสุขภาพได้ครบ 5 ประเภท
- [ ] ข้อมูลบันทึกลง Supabase ถูกต้อง

### Full Launch (All Phases Complete)
- [ ] ระบบแจ้งเตือนฉุกเฉินทำงาน
- [ ] รายงานประจำวันส่งอัตโนมัติ
- [ ] Medication reminders ทำงาน
- [ ] OCR ความดันอ่านได้ถูกต้อง 90%+
- [ ] Caregiver Dashboard ใช้งานได้เต็มรูปแบบ

---

## 📞 Support

หากมีคำถามหรือต้องการความช่วยเหลือ:
1. อ่าน Task Spec ที่เกี่ยวข้องก่อน
2. ตรวจสอบ Database Schema และ API Endpoints
3. ดูตัวอย่าง Code ใน Spec
4. Test กับ API ก่อนเชื่อม LINE Bot

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0

---

## 🎉 Good Luck!

ทุก Task ได้รับการออกแบบให้ทำงานอิสระและมี Spec ครบถ้วน เริ่มจาก TASK-001 และทำตามลำดับ Phase จะได้ Product ที่ใช้งานได้จริง!
