# 🧑‍💻👔 Developer & Project Manager Agents

> AI agents ที่ช่วยเขียนโค้ดและบริหารโปรเจค

---

## 🎯 Overview

เพิ่ม 2 agents ใหม่เข้ามา:

### 1. 🧑‍💻 **Developer Agent**
AI นักพัฒนาที่**เขียนโค้ดจริงๆ** ให้คุณ

**ทำอะไรได้บ้าง:**
- ✍️ เขียน feature ใหม่
- 📝 สร้างไฟล์ใหม่
- 🔧 แก้ไขโค้ดเดิม
- 🐛 แก้ bug พร้อม code
- ♻️ Refactor code

### 2. 👔 **Project Manager Agent**
AI Project Manager ที่ช่วยวางแผนและบริหารโปรเจค

**ทำอะไรได้บ้าง:**
- 📋 วางแผน features
- 🏃 สร้าง sprint plan
- 📊 ติดตาม progress
- 🗺️ สร้าง roadmap
- ⏱️ ประมาณเวลางาน
- 🎯 จัดลำดับความสำคัญ

---

## 🚀 Quick Start

### Developer Agent

```bash
# เขียน feature ให้
npm run dev:implement "Add blood sugar tracking to HealthAgent"

# เขียนใส่ไฟล์เฉพาะ
npm run dev:implement "Add OCR for BP images" -- --file src/agents/specialized/HealthAgent.ts

# สร้างไฟล์ใหม่
npm run dev:implement "Create NotificationService for emails" -- --create

# แก้ bug
npm run dev:implement "Fix undefined vitals array" -- --file src/agents/specialized/HealthAgent.ts --fix

# Refactor
npm run dev:implement "Improve error handling" -- --file src/services/supabase.service.ts --refactor
```

### Project Manager Agent

```bash
# วางแผน feature
npm run pm plan -- --feature "Add medication tracking"

# สร้าง sprint
npm run pm sprint -- --duration "2 weeks"

# เช็ค progress
npm run pm progress

# สร้าง roadmap
npm run pm roadmap -- --output ROADMAP_NEW.md

# ประมาณเวลา
npm run pm estimate -- --feature "Build notification system"
```

---

## 📖 Developer Agent - ใช้งานแบบละเอียด

### 1. Implement Feature in Existing File

```bash
npm run dev:implement "Add blood pressure trend analysis" -- \
  --file src/agents/specialized/HealthAgent.ts
```

**ผลลัพธ์:**
- ✅ เพิ่ม method/function ใหม่
- ✅ แก้ไขโค้ดเดิม
- ✅ เพิ่ม JSDoc comments
- ✅ Backup ไฟล์เดิม
- 💾 `src/agents/specialized/HealthAgent.ts.backup`

### 2. Create New File

```bash
npm run dev:implement "Create email notification service" -- --create
```

**ผลลัพธ์:**
- ✅ สร้างไฟล์ `src/services/EmailService.ts`
- ✅ เขียน implementation ครบ
- ✅ เพิ่ม imports
- ✅ เพิ่ม type definitions
- ✅ เพิ่ม JSDoc

**Generated File Example:**
```typescript
// src/services/EmailService.ts

import nodemailer from 'nodemailer';

/**
 * EmailService - Send email notifications
 *
 * @example
 * const emailService = new EmailService();
 * await emailService.sendEmail('test@example.com', 'Subject', 'Body');
 */
export class EmailService {
  private transporter: any;

  constructor() {
    this.transporter = nodemailer.createTransport({
      // Configuration
    });
  }

  /**
   * Send email
   */
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html: body
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}
```

### 3. Fix Bug

```bash
npm run dev:implement "Fix: vitals array is undefined" -- \
  --file src/agents/specialized/HealthAgent.ts \
  --fix
```

**Agent จะ:**
1. อ่านโค้ดเดิม
2. วิเคราะห์ bug
3. เขียนการแก้ไข
4. Backup ไฟล์เดิม
5. เขียนโค้ดใหม่

**Before:**
```typescript
const systolicValues = vitals.map(v => v.systolic);
```

**After:**
```typescript
/**
 * Get systolic values with null safety
 * Fixed: Handle undefined vitals array
 */
const systolicValues = (vitals || []).map(v => v.systolic);
```

### 4. Refactor Code

```bash
npm run dev:implement "Refactor for better readability" -- \
  --file src/agents/core/OrchestratorAgent.ts \
  --refactor
```

**Refactor Types:**
- `improve` - ทั่วไป (default)
- `performance` - เน้น performance
- `readability` - เน้น ความอ่านง่าย
- `modular` - แยก modules

---

## 📖 Project Manager Agent - ใช้งานแบบละเอียด

### 1. Plan Feature

```bash
npm run pm plan -- --feature "Add medication reminder system"
```

**ผลลัพธ์:**
```markdown
# Feature Plan: Medication Reminder System

**Priority:** high
**Estimated Time:** 12 hours

## Implementation Phases

### 1. Database Schema
- T1: Add medications table (30min)
- T2: Add schedules table (30min)
- T3: Create relationships (20min)

### 2. Backend Services
- T4: Create MedicationService (2h)
- T5: Add scheduler logic (3h)
- T6: Create reminder API (1.5h)

### 3. Agent Integration
- T7: Extend HealthAgent (2h)
- T8: Add reminder processing (1h)

### 4. Testing
- T9: Unit tests (2h)
- T10: Integration tests (1.5h)

## Risks
- ⚠️ Timezone handling complexity
- ⚠️ User notification preferences

## Files Affected
- src/services/medication.service.ts (new)
- src/agents/specialized/HealthAgent.ts
- docs/database-schema.sql
```

**บันทึกที่:** `.duulair/tasks.json`

### 2. Create Sprint Plan

```bash
npm run pm sprint -- --duration "2 weeks"
```

**ผลลัพธ์:**
```markdown
# Sprint 1 Plan

**Goal:** Implement medication tracking MVP
**Duration:** 2024-01-16 to 2024-01-30

## Tasks (8)

- **Day 1:** Database schema setup (4h)
- **Day 2-3:** MedicationService implementation (6h)
- **Day 4:** HealthAgent integration (4h)
- **Day 5-6:** Testing and bug fixes (6h)
- **Day 7-8:** LINE integration (4h)
- **Day 9-10:** Documentation and polish (4h)

## Success Criteria
- ✅ Users can log medications
- ✅ Automated reminders working
- ✅ 80%+ test coverage
```

**บันทึกที่:** `.duulair/sprints.json`

### 3. Track Progress

```bash
npm run pm progress
```

**ผลลัพธ์:**
```markdown
# Project Progress Report

**Generated:** 2024-01-16T15:30:00Z

## Metrics
- Total Tasks: 25
- ✅ Completed: 18
- 🔄 In Progress: 4
- ⏳ Pending: 3
- 📈 Completion Rate: 72%

## Current Sprint
- Sprint 1: Day 6/14
- On track ✅

## Upcoming
- Complete HealthAgent tests
- Deploy to staging
- User acceptance testing
```

### 4. Generate Roadmap

```bash
npm run pm roadmap -- --output ROADMAP_Q1_2024.md
```

**สร้าง roadmap ที่มี:**
- Milestones
- Timeline
- Dependencies
- Success metrics

### 5. Estimate Task

```bash
npm run pm estimate -- --feature "Build push notification system"
```

**ผลลัพธ์:**
```json
{
  "task": "Build push notification system",
  "complexity": "high",
  "estimatedHours": 16,
  "breakdown": {
    "development": 10,
    "testing": 3,
    "documentation": 2,
    "review": 1
  },
  "risks": [
    "Third-party API reliability",
    "iOS/Android differences"
  ],
  "confidence": "medium"
}
```

---

## 🎯 Workflow ตัวอย่าง

### Workflow 1: Feature Development (ใช้ทั้ง 2 agents)

```bash
# 1. PM: วางแผน feature
npm run pm plan -- --feature "Add blood sugar tracking"

# 2. Review plan
cat .duulair/tasks.json

# 3. Developer: เริ่ม implement task แรก
npm run dev:implement "Add blood_sugar field to database" -- --create

# 4. Developer: แก้ไข HealthAgent
npm run dev:implement "Add blood sugar logging method" -- \
  --file src/agents/specialized/HealthAgent.ts

# 5. Generate tests
npm run test:gen src/agents/specialized/HealthAgent.ts

# 6. Run tests
npm test

# 7. PM: Update progress
npm run pm progress

# 8. Repeat สำหรับ tasks ถัดไป
```

### Workflow 2: Bug Fixing

```bash
# 1. PM: Estimate bug fix
npm run pm estimate -- --feature "Fix authentication timeout"

# 2. Developer: Fix the bug
npm run dev:implement "Fix: Add retry logic for auth timeout" -- \
  --file src/services/auth.service.ts \
  --fix

# 3. Review changes
git diff

# 4. Test
npm test

# 5. PM: Mark as complete
npm run pm progress
```

### Workflow 3: Sprint Planning

```bash
# 1. PM: วางแผน features ทั้งหมด
npm run pm plan -- --feature "Feature 1"
npm run pm plan -- --feature "Feature 2"
npm run pm plan -- --feature "Feature 3"

# 2. PM: สร้าง sprint
npm run pm sprint -- --duration "2 weeks"

# 3. Review sprint plan
cat .duulair/sprints.json

# 4. Developer: เริ่มทำ tasks ตาม plan
npm run dev:implement "..." -- --file ...

# 5. Daily: เช็ค progress
npm run pm progress
```

---

## 💡 Pro Tips

### Tip 1: ใช้ Interactive Mode

```bash
npm run dev-agent:interactive

dev-agent> @pm plan --feature "Add email notifications"
dev-agent> @dev "Implement EmailService" --create
dev-agent> @review src/services/EmailService.ts
dev-agent> @test src/services/EmailService.ts
```

### Tip 2: Combine Agents

```bash
# วางแผนก่อน
npm run pm plan -- --feature "Your feature"

# แล้วค่อย implement
npm run dev:implement "..." -- --file ...

# Review
npm run review ...

# Test
npm run test:gen ...
```

### Tip 3: สร้าง Custom Workflow Scripts

เพิ่มใน `package.json`:
```json
{
  "scripts": {
    "new-feature": "npm run pm plan && npm run dev:implement",
    "full-cycle": "npm run dev:implement && npm run test:gen && npm run review"
  }
}
```

---

## ⚙️ Configuration

### Developer Agent Options

```bash
--file <path>        # ระบุไฟล์ที่จะแก้
--create             # สร้างไฟล์ใหม่
--modify             # แก้ไขโค้ดเดิม
--fix                # แก้ bug
--refactor           # Refactor code
```

### PM Agent Actions

```bash
plan                 # วางแผน feature
sprint               # สร้าง sprint plan
progress             # เช็ค progress
roadmap              # สร้าง roadmap
estimate             # ประมาณเวลา
breakdown            # แบ่งงาน
prioritize           # จัดลำดับความสำคัญ
```

---

## 📊 Output Files

Agents จะบันทึกข้อมูลที่:

```
.duulair/
├── tasks.json           # Feature plans
├── sprints.json         # Sprint plans
└── progress.json        # Progress tracking

src/
├── agents/
│   └── specialized/
│       └── *.ts.backup  # Backup files
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module..."
```bash
# Install dependencies
npm install
```

### Issue: Generated code has errors
```bash
# นี่เป็นเรื่องปกติ! AI ช่วยเขียน แต่ต้อง review เสมอ
# Review และแก้ไขด้วยตัวเอง
```

### Issue: Backup file created
```bash
# ถ้าโค้ดใหม่ OK แล้ว ลบ backup ได้
rm src/agents/specialized/HealthAgent.ts.backup
```

---

## 🎓 Best Practices

1. **เช็ค Plan ก่อนเสมอ**
   ```bash
   npm run pm plan -- --feature "..."
   cat .duulair/tasks.json
   ```

2. **Review Generated Code**
   ```bash
   npm run dev:implement "..."
   git diff
   npm run review <generated-file>
   ```

3. **Test ทันที**
   ```bash
   npm run test:gen <file>
   npm test
   ```

4. **Track Progress**
   ```bash
   npm run pm progress
   ```

---

## 📚 Related Docs

- [Development Agents Guide](DEVELOPMENT_AGENTS.md)
- [Usage Examples](../examples/dev-agents/usage-examples.md)
- [Roadmap](../ROADMAP.md)

---

**Version:** 1.0.0
**Last Updated:** 2024-01-16

**Happy Coding! 🚀**
