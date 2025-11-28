-- ============================================================
-- Fix Group Data: Add Popp + Goy to Group
-- ============================================================

-- 1. เพิ่ม Popp เข้า group_members
INSERT INTO group_members (
  group_id,
  line_user_id,
  display_name,
  picture_url,
  role,
  is_active
) VALUES (
  '7c65a434-4249-437d-b343-35b1e5a0755b',  -- Group ID
  'U64ea659fcd7fff1cb60069cb5ae21f24',     -- Popp LINE User ID
  'Popp',
  'https://profile.line-scdn.net/0hG70ka9oJGBgdEgatl0hmJm1CG3I-Y0EKZiZWKiERTy0kcF9NOXNSeHwRQyp3dwgaYXVReXtBEXw_ZBoYTi81LVBKFkpoQAYzXw5eeG1yNW5TSzgnWBY2HSlyLWpYWSJOSHAVPHZbEH5jdwwzNAQjHHBwKHJoUDRGMkV0ThggdptyEG9NMHVefS4bQSGi',
  'caregiver',
  true
)
ON CONFLICT (group_id, line_user_id) DO NOTHING;

-- 2. เพิ่ม ก้อย เข้า group_patients
INSERT INTO group_patients (
  group_id,
  patient_id,
  added_by_caregiver_id,
  is_active
) VALUES (
  '7c65a434-4249-437d-b343-35b1e5a0755b',  -- Group ID
  '4ccbe823-b649-4cdf-8ae6-5503c9fc88db',  -- ก้อย Patient ID
  '5273ee3e-46fb-4e4c-8cf2-f4fcc47e8970',  -- Popp Caregiver ID
  true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verification Query
-- ============================================================

-- Check group members
SELECT
  'Group Members' as section,
  gm.display_name,
  gm.role,
  gm.is_active
FROM group_members gm
WHERE gm.group_id = '7c65a434-4249-437d-b343-35b1e5a0755b'
ORDER BY gm.joined_at;

-- Check group patients
SELECT
  'Group Patients' as section,
  pp.first_name || ' ' || pp.last_name as patient_name,
  pp.nickname,
  gp.is_active
FROM group_patients gp
JOIN patient_profiles pp ON gp.patient_id = pp.id
WHERE gp.group_id = '7c65a434-4249-437d-b343-35b1e5a0755b'
ORDER BY pp.first_name;
