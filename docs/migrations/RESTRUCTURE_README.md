# OONJ.AI Schema Restructure Guide

## Overview

การปรับโครงสร้าง database เพื่อรองรับ **AI Extraction Pipeline** - ระบบบันทึกสุขภาพผ่านบทสนทนาธรรมชาติ

## Migration Files

| File | Description | Safe to Run |
|------|-------------|-------------|
| `001_restructure_phase1_new_tables.sql` | สร้าง tables ใหม่ | ✅ Yes |
| `002_restructure_phase2_alter_tables.sql` | ปรับ tables ที่มีอยู่ | ✅ Yes |
| `003_restructure_phase3_migrate_data.sql` | Migrate ข้อมูล | ⚠️ Review first |
| `004_restructure_phase4_cleanup.sql` | ลบ tables เก่า | ⚠️ Backup first |

---

## How to Run

### Step 1: Create New Tables (Safe)
```bash
# Via Supabase Dashboard → SQL Editor
# Copy and run: 001_restructure_phase1_new_tables.sql
```

### Step 2: Alter Existing Tables (Safe)
```bash
# Copy and run: 002_restructure_phase2_alter_tables.sql
```

### Step 3: Migrate Data (Review First)
```bash
# Review the migration script
# Some migrations may need manual adjustment
# Copy and run: 003_restructure_phase3_migrate_data.sql
```

### Step 4: Cleanup (After Verification)
```bash
# ⚠️ BACKUP DATABASE FIRST!
# Verify data migration is complete
# Copy and run: 004_restructure_phase4_cleanup.sql
```

---

## Schema Changes Summary

### New Tables (4)
| Table | Purpose |
|-------|---------|
| `symptoms` | เก็บอาการที่ extract จากบทสนทนา |
| `sleep_logs` | เก็บข้อมูลการนอน |
| `exercise_logs` | เก็บข้อมูลการออกกำลังกาย |
| `health_events` | Linking table เชื่อม conversation → health data |

### Altered Tables (5)
| Table | Changes |
|-------|---------|
| `conversation_logs` | +patient_id, +group_id, +media_url, +ai_extracted_data, +ai_confidence |
| `vitals_logs` | +patient_id, +conversation_log_id, +source, +ai_confidence |
| `mood_logs` | +patient_id, +stress_level, +energy_level, +ai_confidence |
| `activity_logs` | +conversation_log_id, +ai_confidence |
| `health_goals` | +target_sleep_hours, +target_water_glasses, +target_steps |

### Removed Tables (11)
| Table | Reason |
|-------|--------|
| `subscription_packages` | ไม่ใช้ใน MVP |
| `user_subscriptions` | ไม่ใช้ใน MVP |
| `analytics_settings` | ไม่ใช้ใน MVP |
| `caregiver_patient_preferences` | ใช้ group_patients แทน |
| `schedules` | ใช้ reminders แทน |
| `caregivers` | ใช้ caregiver_profiles + patient_caregivers |
| `medication_history` | รวมกับ medical_history |
| `missed_activity_alerts` | รวมกับ alert_logs |
| `water_intake_logs` | ย้ายไป activity_logs |
| `water_intake_goals` | รวมกับ health_goals |
| `patient_medications` | รวมกับ medications |

---

## Final Schema (28 Tables)

### Core (7)
- `users`
- `patient_profiles`
- `caregiver_profiles`
- `patient_caregivers`
- `groups`
- `group_members`
- `group_patients`

### Health Data (8)
- `vitals_logs` ✏️
- `mood_logs` ✏️
- `activity_logs` ✏️
- `conversation_logs` ✏️
- `symptoms` 🆕
- `sleep_logs` 🆕
- `exercise_logs` 🆕
- `health_events` 🆕

### Reminders (5)
- `reminders`
- `reminder_logs`
- `medications`
- `medication_logs`
- `medication_notification_logs`

### Reports (5)
- `daily_reports`
- `daily_patient_summaries`
- `report_settings`
- `report_downloads`
- `report_access_logs`

### Settings & Safety (6)
- `health_goals` ✏️
- `notification_settings`
- `emergency_contacts`
- `allergies`
- `alert_logs`
- `link_codes`
- `medical_history`

### System (2)
- `app_config`
- `schema_migrations`

---

## Data Flow (New)

```
LINE Message
    ↓
conversation_logs (raw + ai_extracted_data)
    ↓
health_events (linking table)
    ↓
┌─────────────────────────────────────┐
│ symptoms | vitals_logs | mood_logs  │
│ sleep_logs | exercise_logs          │
└─────────────────────────────────────┘
    ↓
daily_patient_summaries → daily_reports
```

---

## Rollback

หาก migration มีปัญหา:

1. **Backup tables** ถูกสร้างใน Phase 4 (prefix `_backup_`)
2. ใช้ backup tables เพื่อ restore ข้อมูล
3. สร้าง tables ใหม่จาก backup

```sql
-- Example: Restore patient_medications
CREATE TABLE public.patient_medications AS
SELECT * FROM public._backup_patient_medications;
```

---

## Notes

- ✅ Phase 1-2 (001-002) safe to run multiple times (IF NOT EXISTS)
- ⚠️ Phase 3 (003) should be reviewed before running
- ⚠️ Phase 4 (004) creates backups but still destructive
- 📝 All migrations are recorded in `schema_migrations` table
