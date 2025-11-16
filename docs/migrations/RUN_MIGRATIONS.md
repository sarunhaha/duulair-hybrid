# วิธีรัน Migration สำหรับ Database ที่มี users table อยู่แล้ว

## 🎯 สถานการณ์: Database ปัจจุบันของคุณ

Database มี:
- ✅ `users` table (มีอยู่แล้ว)
- ✅ `medications` table (มีอยู่แล้ว)
- ✅ `caregivers` table (แบบเก่า)
- ❌ **ไม่มี** `patient_profiles`
- ❌ **ไม่มี** `caregiver_profiles`
- ❌ **ไม่มี** `groups`

---

## 🚀 ลำดับการรัน Migration (3 ไฟล์)

```
1. รัน: 001_create_missing_tables.sql           (สร้าง patient_profiles, caregiver_profiles)
2. รัน: 002-add-groups-production.sql           (สร้าง groups, group_members)
3. รัน: COMBINED_MIGRATION_003_004_005.sql      (Oonjai feedback ทั้งหมด)
```

---

## 📝 Step-by-Step Instructions

### Step 1: รัน Migration 001

**ไฟล์:** `docs/migrations/001_create_missing_tables.sql`

1. เข้า **Supabase Dashboard → SQL Editor**
2. Copy-paste ไฟล์ `001_create_missing_tables.sql` ทั้งหมด
3. กด **Run**

**จะสร้าง:**
- ✅ `patient_profiles` table
- ✅ `caregiver_profiles` table
- ✅ `patient_caregivers` table (M:N relationship)
- ✅ `link_codes` table
- ✅ `patient_medications` table (ถ้ายังไม่มี)
- ✅ `health_goals` table
- ✅ `notification_settings` table
- ✅ `activity_logs` table (ถ้ายังไม่มี)

**ตรวจสอบ:**
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('patient_profiles', 'caregiver_profiles')
ORDER BY tablename;
-- ควรเห็น 2 tables
```

---

### Step 2: รัน Migration 002

**ไฟล์:** `docs/migrations/002-add-groups-production.sql`

1. เข้า **Supabase Dashboard → SQL Editor**
2. Copy-paste ไฟล์ `002-add-groups-production.sql` ทั้งหมด
3. กด **Run**

**จะสร้าง:**
- ✅ `groups` table
- ✅ `group_members` table
- ✅ เพิ่ม columns ใน `activity_logs` (group_id, actor_line_user_id, etc.)
- ✅ เพิ่ม column `primary_group_id` ใน `users`

**ตรวจสอบ:**
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('groups', 'group_members')
ORDER BY tablename;
-- ควรเห็น 2 tables
```

---

### Step 3: รัน Migration 003-005 (Oonjai Feedback)

**ไฟล์:** `docs/migrations/COMBINED_MIGRATION_003_004_005.sql`

1. เข้า **Supabase Dashboard → SQL Editor**
2. Copy-paste ไฟล์ `COMBINED_MIGRATION_003_004_005.sql` ทั้งหมด
3. กด **Run**

**จะสร้าง:**

**Phase 1 (003):**
- ✅ `reminders` table (เวลาเตือนอิสระ)
- ✅ `medications` table (รองรับ ½ เม็ด, ยาน้ำ)
- ✅ `water_intake_logs` table (ติดตามน้ำแยก)
- ✅ `water_intake_goals` table
- ✅ อัพเดท `patient_medications` (เพิ่ม dosage_amount, days_of_week)

**Phase 2 (004):**
- ✅ อัพเดท `patient_profiles` (โรงพยาบาล, แพทย์)
- ✅ `allergies` table (แพ้ยา/อาหาร/อื่นๆ)
- ✅ `emergency_contacts` table
- ✅ `medical_history` table
- ✅ `medication_history` table

**Phase 3 (005):**
- ✅ `subscription_packages` table (Free/Plus)
- ✅ `user_subscriptions` table
- ✅ `report_settings` table
- ✅ `report_downloads` table
- ✅ `analytics_settings` table

**ตรวจสอบ:**
```sql
SELECT version, description FROM schema_migrations
WHERE version IN ('003', '004', '005')
ORDER BY version;
-- ควรเห็น 3 rows
```

---

## ✅ ตรวจสอบว่ารันสำเร็จทั้งหมด

### 1. ตรวจสอบ Migration Log

```sql
SELECT * FROM schema_migrations
ORDER BY version;
-- ควรเห็น versions: 001, 003, 004, 005
```

---

### 2. ตรวจสอบ Tables ทั้งหมด

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    -- From 001
    'patient_profiles', 'caregiver_profiles', 'patient_caregivers',
    'link_codes', 'health_goals', 'notification_settings',

    -- From 002
    'groups', 'group_members',

    -- From 003
    'reminders', 'medications', 'water_intake_logs', 'water_intake_goals',

    -- From 004
    'allergies', 'emergency_contacts', 'medical_history', 'medication_history',

    -- From 005
    'subscription_packages', 'user_subscriptions', 'report_settings',
    'report_downloads', 'analytics_settings'
  )
ORDER BY tablename;
```

**ควรเห็น 20 tables**

---

### 3. ตรวจสอบ Packages

```sql
SELECT package_name, display_name, price_monthly, data_retention_days
FROM subscription_packages;
```

**ควรเห็น:**
- `free` - ฟรี - 0 บาท - 45 days
- `plus` - Plus - 299 บาท - unlimited (-1)

---

### 4. ตรวจสอบ Columns ใหม่ใน patient_profiles

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'patient_profiles'
  AND column_name IN (
    'medical_condition', 'hospital_name', 'hospital_address',
    'hospital_phone', 'doctor_name', 'doctor_phone', 'medical_notes'
  )
ORDER BY column_name;
```

**ควรเห็น 7 columns**

---

## 🧪 ทดสอบ Functions

### Test 1: ตรวจสอบ Feature Access

```sql
-- สมมติมี group_id = 'xxx' (เปลี่ยนเป็นของจริง)
SELECT has_feature_access('your-group-uuid', 'export_pdf');
-- Free: false, Plus: true

SELECT has_feature_access('your-group-uuid', 'daily_report');
-- ทุกแพคเกจ: true
```

---

### Test 2: คำนวณน้ำที่ดื่ม

```sql
-- เพิ่มข้อมูลทดสอบ
INSERT INTO water_intake_logs (patient_id, amount_ml, logged_at)
VALUES ('your-patient-uuid', 250, NOW());

-- คำนวณ
SELECT get_daily_water_intake('your-patient-uuid', CURRENT_DATE);
-- Result: 250
```

---

### Test 3: ตรวจสอบแพ้ยา

```sql
-- เพิ่มข้อมูล
INSERT INTO allergies (patient_id, allergy_type, allergen_name, severity)
VALUES ('your-patient-uuid', 'medication', 'Penicillin', 'severe');

-- ตรวจสอบ
SELECT check_medication_allergy('your-patient-uuid', 'Penicillin');
-- Result: true
```

---

## ❗ Troubleshooting

### ปัญหา 1: "relation already exists"

**สาเหตุ:** Table มีอยู่แล้ว

**แก้ไข:** Migration ใช้ `IF NOT EXISTS` แล้ว ควรข้ามไปได้โดยอัตโนมัติ

---

### ปัญหา 2: "foreign key constraint violation"

**สาเหตุ:** Migration ก่อนหน้ายังไม่รันเสร็จ

**แก้ไข:** ตรวจสอบว่ารัน migration ตามลำดับ (001 → 002 → 003-005)

```sql
SELECT * FROM schema_migrations ORDER BY version;
```

---

### ปัญหา 3: "column already exists"

**สาเหตุ:** Column มีอยู่แล้ว

**แก้ไข:** Migration ใช้ `DO $$ BEGIN IF NOT EXISTS` blocks แล้ว ควรข้ามไปได้

---

## 🔄 Rollback (ถ้าต้องการย้อนกลับ)

**⚠️ คำเตือน: จะลบข้อมูลทั้งหมด!**

```sql
-- Rollback 005
DROP TABLE IF EXISTS analytics_settings CASCADE;
DROP TABLE IF EXISTS report_downloads CASCADE;
DROP TABLE IF EXISTS report_settings CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_packages CASCADE;
DELETE FROM schema_migrations WHERE version = '005';

-- Rollback 004
DROP TABLE IF EXISTS medication_history CASCADE;
DROP TABLE IF EXISTS medical_history CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;
DROP TABLE IF EXISTS allergies CASCADE;
DELETE FROM schema_migrations WHERE version = '004';

-- Rollback 003
DROP TABLE IF EXISTS water_intake_goals CASCADE;
DROP TABLE IF EXISTS water_intake_logs CASCADE;
DROP TABLE IF EXISTS medications CASCADE;
DELETE FROM schema_migrations WHERE version = '003';

-- Rollback 002
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;

-- Rollback 001
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS health_goals CASCADE;
DROP TABLE IF EXISTS patient_medications CASCADE;
DROP TABLE IF EXISTS link_codes CASCADE;
DROP TABLE IF EXISTS patient_caregivers CASCADE;
DROP TABLE IF EXISTS caregiver_profiles CASCADE;
DROP TABLE IF EXISTS patient_profiles CASCADE;
DELETE FROM schema_migrations WHERE version = '001';
```

---

## 📊 คำสั่งที่มีประโยชน์

### ดูขนาด Tables

```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

---

### ดู Functions ทั้งหมด

```sql
SELECT
  p.proname as function_name,
  pg_get_function_result(p.oid) as result_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%water%' OR
    p.proname LIKE '%medication%' OR
    p.proname LIKE '%feature%' OR
    p.proname LIKE '%allergy%'
  )
ORDER BY p.proname;
```

---

### ดู Indexes

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('patient_profiles', 'groups', 'reminders', 'water_intake_logs')
ORDER BY tablename, indexname;
```

---

## 📝 Checklist

- [ ] **Step 1:** รัน `001_create_missing_tables.sql` - สร้าง patient_profiles, caregiver_profiles
- [ ] **Step 2:** รัน `002-add-groups-production.sql` - สร้าง groups, group_members
- [ ] **Step 3:** รัน `COMBINED_MIGRATION_003_004_005.sql` - Oonjai feedback ทั้งหมด
- [ ] ตรวจสอบ schema_migrations มี 001, 003, 004, 005
- [ ] ตรวจสอบ tables ใหม่ทั้งหมด (20 tables)
- [ ] ตรวจสอบ packages (free, plus)
- [ ] ทดสอบ functions (has_feature_access, get_daily_water_intake, check_medication_allergy)
- [ ] อัพเดท backend code ให้ใช้ tables ใหม่
- [ ] Deploy LIFF pages ที่อัพเดทแล้ว
- [ ] ทดสอบใน LINE app จริง

---

## 🎉 เสร็จแล้ว!

Database พร้อมรองรับทุก feature จาก Oonjai feedback:

✅ เวลาเตือนแบบอิสระ
✅ ติดตามน้ำแยกจากยา
✅ ยา ½ เม็ด และยาน้ำ ml
✅ เลือกวันทานยา
✅ ข้อมูลโรงพยาบาลและแพทย์
✅ แพ้ยา/อาหาร/อื่นๆ แยกประเภท
✅ ระบบแพคเกจ Free/Plus
✅ ดาวน์โหลดรายงาน PDF/CSV

---

*Last updated: 2025-11-13*
*Compatible with: Existing production schema (users table exists)*
