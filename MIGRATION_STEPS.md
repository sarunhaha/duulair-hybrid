# 🗄️ Database Migration Steps

## ⚠️ ปัญหาที่พบ:

```
column users.role does not exist
```

**สาเหตุ:** Database schema ใน Supabase project ใหม่ (`mqxklnzxfrupwwkwlwwc`) ยังไม่ได้รัน migrations!

---

## 📋 ขั้นตอนการ Migrate Database:

### 1. เข้า Supabase Project ที่ถูกต้อง

เปิด:
```
https://supabase.com/dashboard/project/mqxklnzxfrupwwkwlwwc
```

---

### 2. ไปที่ SQL Editor

Dashboard → SQL Editor (ซ้ายมือ)

---

### 3. รัน Migration ตามลำดับ

#### Migration 1: สร้าง Schema หลัก

**ไฟล์:** `database/migrations/001_user_registration.sql`

**ทำ:**
1. เปิดไฟล์ `001_user_registration.sql` ในโปรเจค
2. Copy SQL ทั้งหมด
3. Paste ใน SQL Editor
4. กด **Run** (Ctrl+Enter)

**ผลที่ต้องได้:**
- สร้างตาราง: `users`, `patient_profiles`, `caregiver_profiles`, `patient_caregivers`, `link_codes`, เป็นต้น
- ✅ Success

---

#### Migration 2: แก้ patient_profiles.user_id เป็น NULLABLE

**ไฟล์:** `database/migrations/002_fix_patient_profiles_user_id.sql`

**ทำ:**
1. เปิดไฟล์ `002_fix_patient_profiles_user_id.sql`
2. Copy SQL ทั้งหมด
3. Paste ใน SQL Editor (New Query)
4. กด **Run**

**ผลที่ต้องได้:**
- ✅ Success, No rows returned (หรือ notice message)

---

#### Migration 3: แก้ RLS Policies

**ไฟล์:** `database/migrations/003_fix_rls_policies_for_nullable_user_id.sql`

**ทำ:**
1. เปิดไฟล์ `003_fix_rls_policies_for_nullable_user_id.sql`
2. Copy SQL ทั้งหมด
3. Paste ใน SQL Editor (New Query)
4. กด **Run**

**ผลที่ต้องได้:**
- ✅ Success, No rows returned (หรือ notice message)

---

### 4. ตรวจสอบว่า Migrations สำเร็จ

รัน query นี้เพื่อตรวจสอบ:

```sql
-- ตรวจสอบว่าตารางถูกสร้างแล้ว
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**ควรเห็นตาราง:**
- activity_logs
- agent_specs
- agent_states
- caregiver_profiles
- link_codes
- medication_logs
- patient_caregivers
- patient_medications
- patient_profiles
- patient_reminders
- patient_vitals
- users
- water_intake_logs

---

```sql
-- ตรวจสอบว่า users table มี columns ที่ถูกต้อง
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

**ควรเห็น columns:**
- id (uuid)
- line_user_id (text)
- display_name (text)
- picture_url (text)
- status_message (text)
- created_at (timestamp)
- updated_at (timestamp)

**หมายเหตุ:** ตาราง `users` **ไม่มี column `role`** เพราะ role ถูกกำหนดโดยการมี profile ใน `patient_profiles` หรือ `caregiver_profiles`

---

### 5. ทดสอบลงทะเบียนอีกครั้ง

หลังจากรัน migrations เสร็จแล้ว:

1. เปิด:
```
https://duulair.vercel.app/liff/group-registration
```

2. กรอกข้อมูลและลงทะเบียน

3. **ควรสำเร็จ!** ✅

---

## 🐛 ถ้ายังมี Error:

### Error: "relation [table_name] does not exist"
→ Migration 001 ยังไม่ถูกรัน หรือรันไม่สำเร็จ

### Error: "column [column_name] does not exist"
→ Migration ที่เกี่ยวข้องยังไม่ถูกรัน

### Error: "duplicate key value violates unique constraint"
→ ข้อมูลซ้ำ ให้ลบข้อมูลเก่าออกก่อน

---

## 📊 Checklist:

- [ ] เข้า Supabase project ที่ถูกต้อง (mqxklnzxfrupwwkwlwwc)
- [ ] รัน Migration 001 ✅
- [ ] รัน Migration 002 ✅
- [ ] รัน Migration 003 ✅
- [ ] ตรวจสอบตารางถูกสร้างครบ ✅
- [ ] ทดสอบลงทะเบียนสำเร็จ ✅

---

**หลังรัน migrations เสร็จแล้ว ระบบควรทำงานได้ปกติ!**
