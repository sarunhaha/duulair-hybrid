-- ============================================
-- DEBUG QUERIES สำหรับ User: Uf65220907317686ebc96aaf94021b2e6
-- Patient ID ที่มีปัญหา: 80d39533-e193-42dc-bbb8-4a467e209565
-- ============================================

-- Query 1: ตรวจสอบว่า Patient ID ที่มีปัญหามีในฐานข้อมูลหรือไม่
-- คาดว่าจะได้: 0 rows (ไม่มี) เพราะ API ตอบ 404 Patient not found
SELECT * FROM patient_profiles
WHERE id = '80d39533-e193-42dc-bbb8-4a467e209565';

-- ============================================

-- Query 2: ตรวจสอบว่า LINE User ID มีในตาราง users หรือไม่
-- ถ้าได้ 1 row = user มีในระบบแล้ว (เลยได้ error "User already registered")
-- ถ้าได้ 0 rows = user ไม่เคยลงทะเบียน
SELECT * FROM users
WHERE line_user_id = 'Uf65220907317686ebc96aaf94021b2e6';

-- ============================================

-- Query 3: ตรวจสอบ Caregiver Profile
-- แทนค่า USER_ID จาก Query 2
-- ถ้ามี user แต่ไม่มี caregiver_profile = registration ล้มเหลวตอน create caregiver
SELECT cp.*, u.line_user_id, u.created_at as user_created_at
FROM caregiver_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6';

-- ============================================

-- Query 4: ตรวจสอบ Patient ที่ link กับ Caregiver นี้
-- ถ้ามี caregiver แต่ไม่มี link = registration ล้มเหลวตอน link caregiver-patient
-- ถ้ามี link แต่ patient_id ไม่ตรง = localStorage บันทึก patient_id ผิด
SELECT pc.*, pp.first_name as patient_first_name, pp.last_name as patient_last_name
FROM patient_caregivers pc
LEFT JOIN patient_profiles pp ON pp.id = pc.patient_id
WHERE pc.caregiver_id IN (
  SELECT cp.id FROM caregiver_profiles cp
  JOIN users u ON u.id = cp.user_id
  WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6'
);

-- ============================================

-- Query 5: ดู Patient ทั้งหมดที่ถูกสร้างล่าสุด (10 รายการ)
-- ดูว่ามี patient ที่คุณสร้างหรือไม่
SELECT id, first_name, last_name, birth_date, user_id, created_at
FROM patient_profiles
ORDER BY created_at DESC
LIMIT 10;

-- ============================================

-- Query 6: ดู Caregiver ทั้งหมดที่ถูกสร้างล่าสุด (10 รายการ)
SELECT cp.id, cp.first_name, cp.last_name, u.line_user_id, cp.created_at
FROM caregiver_profiles cp
JOIN users u ON u.id = cp.user_id
ORDER BY cp.created_at DESC
LIMIT 10;

-- ============================================
-- SUMMARY: สรุปข้อมูลทั้งหมดสำหรับ user นี้
-- ============================================

SELECT
  'User Info' as section,
  u.id as user_id,
  u.line_user_id,
  u.display_name,
  u.created_at
FROM users u
WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6'

UNION ALL

SELECT
  'Caregiver Info' as section,
  cp.id as caregiver_id,
  cp.first_name || ' ' || cp.last_name as caregiver_name,
  cp.phone_number,
  cp.created_at
FROM caregiver_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6'

UNION ALL

SELECT
  'Patient Link Info' as section,
  pc.patient_id,
  pc.relationship,
  pc.status,
  pc.created_at
FROM patient_caregivers pc
WHERE pc.caregiver_id IN (
  SELECT cp.id FROM caregiver_profiles cp
  JOIN users u ON u.id = cp.user_id
  WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6'
)

UNION ALL

SELECT
  'Patient Info' as section,
  pp.id as patient_id,
  pp.first_name || ' ' || pp.last_name as patient_name,
  pp.birth_date::text,
  pp.created_at
FROM patient_profiles pp
WHERE pp.id IN (
  SELECT pc.patient_id FROM patient_caregivers pc
  WHERE pc.caregiver_id IN (
    SELECT cp.id FROM caregiver_profiles cp
    JOIN users u ON u.id = cp.user_id
    WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6'
  )
);
