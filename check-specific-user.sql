-- ============================================================
-- Check Specific User Data
-- LINE User ID: Uf65220907317686ebc96aaf94021b2e6
-- ============================================================

-- 1. เช็ค users table
SELECT
  'USERS TABLE' as table_name,
  u.id as user_id,
  u.line_user_id,
  u.role,
  u.display_name,
  u.created_at
FROM users u
WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6';

-- 2. เช็ค patient_profiles table (JOIN กับ users)
SELECT
  'PATIENT_PROFILES TABLE' as table_name,
  pp.id as profile_id,
  pp.user_id,
  pp.first_name,
  pp.last_name,
  pp.birth_date,
  pp.gender,
  pp.created_at
FROM patient_profiles pp
JOIN users u ON u.id = pp.user_id
WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6';

-- 3. เช็ค link_codes (ถ้ามี)
SELECT
  'LINK_CODES TABLE' as table_name,
  lc.id as link_code_id,
  lc.code,
  lc.patient_id,
  lc.expires_at,
  lc.used,
  lc.created_at,
  CASE
    WHEN lc.expires_at > NOW() THEN 'VALID'
    ELSE 'EXPIRED'
  END as status
FROM link_codes lc
JOIN patient_profiles pp ON pp.id = lc.patient_id
JOIN users u ON u.id = pp.user_id
WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6'
ORDER BY lc.created_at DESC;

-- 4. ทดสอบ query ที่ backend ใช้จริงๆ
SELECT
  'BACKEND QUERY RESULT' as query_type,
  u.id,
  u.line_user_id,
  u.role,
  json_agg(pp.*) FILTER (WHERE pp.id IS NOT NULL) as patient_profiles
FROM users u
LEFT JOIN patient_profiles pp ON pp.user_id = u.id
WHERE u.line_user_id = 'Uf65220907317686ebc96aaf94021b2e6'
GROUP BY u.id, u.line_user_id, u.role;
