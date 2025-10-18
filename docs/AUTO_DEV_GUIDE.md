# 🤖 Auto Development Workflow Guide

> Automated feature implementation using multi-agent collaboration

---

## 🎯 Overview

ระบบ Auto-Dev ช่วยให้คุณ**เขียน spec แล้วให้ AI agents ทำงานอัตโนมัติ**ตั้งแต่วางแผน ไปจนถึง implement, test, review, และ document

### ขั้นตอนการทำงาน

```
1. คุณเขียน Spec File
         ↓
2. รัน /auto-dev command
         ↓
3. AI Agents ทำงานอัตโนมัติ:
   📋 PM Agent → สร้างแผน
   🧑‍💻 Dev Agent → เขียนโค้ด
   🧪 Test Agent → สร้าง tests
   🔍 Review Agent → review โค้ด
   📚 Doc Agent → เพิ่ม documentation
         ↓
4. ได้ feature พร้อมใช้งาน + tests + docs
```

---

## 📝 Step 1: เขียน Spec File

### ใช้ Template

Copy template มาเริ่มต้น:

```bash
cp docs/specs/TEMPLATE.md docs/specs/your-feature.md
```

### ตัวอย่าง Spec

```markdown
# Blood Sugar Tracking Feature

## Overview
ให้ผู้ใช้บันทึกค่าน้ำตาลในเลือดผ่าน LINE

## Requirements
- [ ] FR-1: รับข้อมูลค่าน้ำตาลจาก LINE
- [ ] FR-2: บันทึกลง database
- [ ] FR-3: วิเคราะห์แนวโน้ม

## Implementation Details
### Files to Create
- src/agents/specialized/BloodSugarAgent.ts

### Files to Modify
- src/agents/specialized/HealthAgent.ts
- docs/database-schema.sql

## Data Model
[Schema, types, etc.]

## Testing Strategy
[Unit tests, integration tests]
```

ดูตัวอย่างเต็มได้ที่: [docs/specs/blood-sugar-tracking.md](specs/blood-sugar-tracking.md)

---

## 🚀 Step 2: รัน Auto-Dev

### วิธีที่ 1: ผ่าน Claude Code (แนะนำ)

เปิด Claude Code แล้วพิมพ์:

```
/auto-dev docs/specs/blood-sugar-tracking.md
```

### วิธีที่ 2: ผ่าน npm script (optional)

```bash
npm run vibe "ตาม spec ใน docs/specs/blood-sugar-tracking.md"
```

---

## 🤖 Step 3: AI Agents ทำงานอัตโนมัติ

ระบบจะทำงานทั้งหมดโดยอัตโนมัติ:

### 📋 Phase 1: PM Agent วางแผน

```
✓ อ่าน spec file
✓ วิเคราะห์ requirements
✓ สร้าง implementation plan
✓ บันทึกที่ docs/plans/YYYY-MM-DD-feature-name.md
```

Output: `docs/plans/2024-01-16-blood-sugar-tracking.md`

### 🧑‍💻 Phase 2: Developer Agent เขียนโค้ด

```
✓ สร้างไฟล์ใหม่ตาม spec
✓ แก้ไขไฟล์เดิม
✓ เพิ่ม methods, types, validation
✓ เพิ่ม error handling
✓ Backup ไฟล์เดิมก่อนแก้
```

Output:
- `src/agents/specialized/BloodSugarAgent.ts` (new)
- `src/agents/specialized/HealthAgent.ts` (modified)
- `src/types/health.types.ts` (modified)

### 🧪 Phase 3: Test Agent สร้าง Tests

```
✓ สร้าง unit tests
✓ Mock dependencies
✓ Test edge cases
✓ Test error scenarios
✓ Coverage > 80%
```

Output:
- `src/agents/specialized/BloodSugarAgent.test.ts`
- `src/agents/specialized/HealthAgent.test.ts`

### 🔍 Phase 4: Review Agent Review โค้ด

```
✓ Security review
✓ Performance check
✓ Code quality analysis
✓ Best practices verification
✓ สร้าง review report
```

Output: Code review score (0-100) + recommendations

### 📚 Phase 5: Doc Agent เพิ่ม Documentation

```
✓ เพิ่ม JSDoc comments
✓ อัพเดท README
✓ เพิ่ม usage examples
✓ อัพเดท API docs
```

---

## ✅ Step 4: ได้ผลลัพธ์

### Summary Report

```markdown
# 🎉 Auto-Implementation Complete

## Feature: Blood Sugar Tracking

### ✅ Completed Tasks
- [x] Spec analyzed
- [x] Implementation plan created
- [x] Code implemented
- [x] Tests generated (Coverage: 85%)
- [x] Code reviewed (Score: 92/100)
- [x] Documentation updated

### 📁 Files Created (3)
- src/agents/specialized/BloodSugarAgent.ts
- src/agents/specialized/BloodSugarAgent.test.ts
- docs/plans/2024-01-16-blood-sugar-tracking.md

### 📝 Files Modified (2)
- src/agents/specialized/HealthAgent.ts
- src/types/health.types.ts

### 📊 Metrics
- Lines of Code: ~250
- Test Coverage: 85%
- Code Review Score: 92/100
- Estimated Time: 8 hours
- Actual Time: 2 minutes

### 🎯 Next Steps
1. Review generated code
2. Run tests: npm test
3. Test manually with LINE
4. Deploy to staging
5. User acceptance testing
```

---

## 📂 File Structure

หลังจากรัน auto-dev จะได้ files ตามนี้:

```
duulair-hybrid/
├── docs/
│   ├── specs/
│   │   ├── TEMPLATE.md                    # ← Template สำหรับเขียน spec
│   │   └── blood-sugar-tracking.md        # ← Spec ที่คุณเขียน
│   └── plans/
│       └── 2024-01-16-blood-sugar-tracking.md  # ← Plan ที่ PM สร้าง
│
├── src/
│   ├── agents/specialized/
│   │   ├── BloodSugarAgent.ts             # ← Agent ใหม่
│   │   ├── BloodSugarAgent.test.ts        # ← Tests
│   │   └── HealthAgent.ts                 # ← Modified
│   └── types/
│       └── health.types.ts                # ← Modified types
│
└── .claude/
    └── commands/
        └── auto-dev.md                     # ← Slash command
```

---

## 💡 Examples

### Example 1: Simple Feature

**Spec**: `docs/specs/medication-reminder.md`

```bash
# ใน Claude Code
/auto-dev docs/specs/medication-reminder.md
```

**Result**:
- MedicationAgent created
- Tests generated
- Docs updated
- Ready to use in ~2 minutes

### Example 2: Complex Feature

**Spec**: `docs/specs/ai-health-analysis.md`

```bash
/auto-dev docs/specs/ai-health-analysis.md
```

**Result**:
- Multiple agents modified
- Complex data models created
- Integration tests added
- Complete in ~5 minutes

### Example 3: Bug Fix

**Spec**: `docs/specs/fix-vitals-undefined.md`

```bash
/auto-dev docs/specs/fix-vitals-undefined.md
```

**Result**:
- Bug identified and fixed
- Regression tests added
- Code reviewed
- Fixed in ~1 minute

---

## 🎨 Spec Writing Tips

### 1. Be Specific

❌ Bad:
```markdown
- Add blood sugar feature
```

✅ Good:
```markdown
- FR-1: Parse blood sugar value from LINE messages like "น้ำตาล 120"
- FR-2: Validate range (70-400 mg/dL)
- FR-3: Store in blood_sugar table with timestamp
- FR-4: Return analysis with status (normal/pre-diabetic/diabetic)
```

### 2. Include Examples

Always include:
- Input examples
- Output examples
- Edge cases
- Error scenarios

### 3. Define Data Models

Specify:
- Database schema
- TypeScript types
- Validation rules
- Reference ranges

### 4. List Files

Clearly state:
- Which files to create
- Which files to modify
- Dependencies needed

---

## 🔧 Advanced Usage

### Custom Workflows

**Skip certain steps**:
```bash
npm run vibe "ตาม spec" -- --skip test,doc
```

**Quick mode (skip docs)**:
```bash
npm run vibe "ตาม spec" -- --quick
```

### Modify Existing Features

**Spec**: `docs/specs/enhance-health-agent.md`

```markdown
## Files to Modify
- src/agents/specialized/HealthAgent.ts

## Changes
- Add blood pressure trend analysis
- Add weekly summary method
```

### Database Migrations

**Include in spec**:
```markdown
## Database Changes
- Add blood_sugar table
- Add indexes for performance
- Migration script in docs/migrations/
```

---

## 🐛 Troubleshooting

### Issue: Spec too vague

**Solution**: เพิ่มรายละเอียด requirements, examples, และ data models

### Issue: Generated code has errors

**Solution**:
1. Review code manually
2. Run tests: `npm test`
3. Fix errors
4. Re-run review: `npm run review src/path/to/file.ts`

### Issue: Tests failing

**Solution**:
1. Check test output
2. Fix implementation
3. Re-generate tests if needed

### Issue: Want to redo implementation

**Solution**:
1. Restore from backup: `*.ts.backup`
2. Modify spec
3. Re-run `/auto-dev`

---

## 📊 Best Practices

### 1. Start Small

เริ่มจาก feature เล็กๆ ก่อน เช่น:
- Add single method to existing agent
- Simple CRUD operation
- Basic data validation

### 2. Iterate

```
1. Write basic spec → /auto-dev
2. Review output
3. Enhance spec with more details
4. /auto-dev again
```

### 3. Review Generated Code

**Always review**:
- [ ] Logic correctness
- [ ] Security issues
- [ ] Performance implications
- [ ] Test coverage

### 4. Test Manually

After auto-dev:
```bash
# Run tests
npm test

# Test with real LINE messages
# Test edge cases
# Test error scenarios
```

### 5. Keep Specs Updated

Update spec file when requirements change, then re-run:
```bash
/auto-dev docs/specs/updated-feature.md
```

---

## 🚦 Workflow Comparison

### Traditional Workflow

```
1. Plan feature              (1-2 hours)
2. Write code                (4-8 hours)
3. Write tests               (2-3 hours)
4. Review code               (1 hour)
5. Write documentation       (1-2 hours)
------------------------------------------
Total: 9-16 hours
```

### Auto-Dev Workflow

```
1. Write spec file           (30 mins - 1 hour)
2. Run /auto-dev            (2-5 minutes)
3. Review & test            (30 mins - 1 hour)
------------------------------------------
Total: 1-2 hours
```

**Time Saved: 80-90%** ⚡

---

## 📚 Related Docs

- [Spec Template](specs/TEMPLATE.md)
- [Example Spec](specs/blood-sugar-tracking.md)
- [Development Agents Guide](NEW_AGENTS_GUIDE.md)
- [VibeAgent Documentation](../src/agents/development/VibeAgent.ts)

---

## 🎓 Quick Start Checklist

- [ ] 1. Copy spec template: `cp docs/specs/TEMPLATE.md docs/specs/my-feature.md`
- [ ] 2. Fill in requirements, data models, examples
- [ ] 3. Run: `/auto-dev docs/specs/my-feature.md`
- [ ] 4. Review generated code
- [ ] 5. Run tests: `npm test`
- [ ] 6. Test manually
- [ ] 7. Deploy when ready

---

**Happy Auto-Coding! 🚀**

**Version**: 1.0.0
**Last Updated**: 2024-01-16
