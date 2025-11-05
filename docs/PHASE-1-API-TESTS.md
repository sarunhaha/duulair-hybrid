# Phase 1 API Tests - Group-Based Flow (TASK-002)

## Test Environment Setup

```bash
# Ensure server is running
npm run dev

# Base URL
BASE_URL="http://localhost:3000"
```

## Test Data

```bash
# Test LINE Group ID
LINE_GROUP_ID="Ctest-group-12345"

# Test Caregiver
CAREGIVER_LINE_ID="U-caregiver-001"
CAREGIVER_DISPLAY="ทดสอบ ดูแล"
CAREGIVER_FIRST="ทดสอบ"
CAREGIVER_LAST="ดูแล"
CAREGIVER_PHONE="0812345678"

# Test Patient
PATIENT_FIRST="คุณยาย"
PATIENT_LAST="ทดสอบ"
PATIENT_BIRTHDATE="1950-01-15"
PATIENT_GENDER="female"
```

## Test Cases

### 1. Check Group (Not Registered Yet)

**Endpoint:** `POST /api/groups/check`

**Expected:** `exists: false`

```bash
curl -X POST http://localhost:3000/api/groups/check \
  -H "Content-Type: application/json" \
  -d '{
    "line_group_id": "Ctest-group-12345"
  }'
```

**Expected Response:**
```json
{
  "exists": false
}
```

---

### 2. Register New Group

**Endpoint:** `POST /api/groups/register`

**Expected:** Success with group details

```bash
curl -X POST http://localhost:3000/api/groups/register \
  -H "Content-Type: application/json" \
  -d '{
    "lineGroupId": "Ctest-group-12345",
    "groupName": "ครอบครัวคุณยาย",
    "caregiver": {
      "lineUserId": "U-caregiver-001",
      "displayName": "ทดสอบ ดูแล",
      "firstName": "ทดสอบ",
      "lastName": "ดูแล",
      "phoneNumber": "0812345678"
    },
    "patient": {
      "firstName": "คุณยาย",
      "lastName": "ทดสอบ",
      "nickname": "ยาย",
      "birthDate": "1950-01-15",
      "gender": "female",
      "weightKg": 55,
      "heightCm": 155,
      "bloodType": "O+",
      "chronicDiseases": ["hypertension", "diabetes"],
      "drugAllergies": ["penicillin"],
      "foodAllergies": [],
      "address": "123 หมู่ 1 ต.ทดสอบ อ.ทดสอบ จ.กรุงเทพ 10100",
      "phoneNumber": "0823456789",
      "emergencyContactName": "ลูกสาว",
      "emergencyContactPhone": "0834567890",
      "emergencyContactRelation": "child"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "group": {
    "id": "<uuid>",
    "lineGroupId": "Ctest-group-12345",
    "groupName": "ครอบครัวคุณยาย",
    "patientId": "<uuid>",
    "primaryCaregiverId": "<uuid>",
    "isActive": true,
    "createdAt": "<timestamp>",
    "updatedAt": "<timestamp>"
  },
  "message": "ลงทะเบียนกลุ่มสำเร็จ!"
}
```

**Save for next tests:**
```bash
# Extract IDs from response
GROUP_ID="<copy from response>"
PATIENT_ID="<copy from response>"
CAREGIVER_ID="<copy from response>"
```

---

### 3. Check Group (Already Registered)

**Endpoint:** `POST /api/groups/check`

**Expected:** `exists: true` with group details

```bash
curl -X POST http://localhost:3000/api/groups/check \
  -H "Content-Type: application/json" \
  -d '{
    "line_group_id": "Ctest-group-12345"
  }'
```

**Expected Response:**
```json
{
  "exists": true,
  "group": {
    "id": "<uuid>",
    "lineGroupId": "Ctest-group-12345",
    "groupName": "ครอบครัวคุณยาย",
    ...
  },
  "patient": {
    "id": "<uuid>",
    "firstName": "คุณยาย",
    "lastName": "ทดสอบ",
    ...
  },
  "primaryCaregiver": {
    "id": "<uuid>",
    "firstName": "ทดสอบ",
    "lastName": "ดูแล",
    ...
  }
}
```

---

### 4. Get Group by ID

**Endpoint:** `GET /api/groups/:id`

**Expected:** Full group details

```bash
# Replace <GROUP_ID> with actual ID from step 2
curl -X GET http://localhost:3000/api/groups/<GROUP_ID>
```

**Expected Response:**
```json
{
  "success": true,
  "group": { ... },
  "patient": { ... },
  "primaryCaregiver": { ... },
  "members": [
    {
      "id": "<uuid>",
      "groupId": "<GROUP_ID>",
      "lineUserId": "U-caregiver-001",
      "displayName": "ทดสอบ ดูแล",
      "role": "caregiver",
      "isActive": true,
      "joinedAt": "<timestamp>"
    }
  ]
}
```

---

### 5. Get Group by LINE Group ID

**Endpoint:** `GET /api/groups/by-line-id/:lineGroupId`

**Expected:** Same as step 4

```bash
curl -X GET http://localhost:3000/api/groups/by-line-id/Ctest-group-12345
```

**Expected Response:** Same structure as step 4

---

### 6. Add Family Member to Group

**Endpoint:** `POST /api/groups/:id/members`

**Expected:** New member added

```bash
# Replace <GROUP_ID> with actual ID
curl -X POST http://localhost:3000/api/groups/<GROUP_ID>/members \
  -H "Content-Type: application/json" \
  -d '{
    "lineUserId": "U-family-001",
    "displayName": "ลูกสาว ทดสอบ",
    "role": "family"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "member": {
    "id": "<uuid>",
    "groupId": "<GROUP_ID>",
    "lineUserId": "U-family-001",
    "displayName": "ลูกสาว ทดสอบ",
    "role": "family",
    "isActive": true,
    "joinedAt": "<timestamp>"
  }
}
```

---

### 7. Get All Group Members

**Endpoint:** `GET /api/groups/:id/members`

**Expected:** List of all members

```bash
# Replace <GROUP_ID> with actual ID
curl -X GET http://localhost:3000/api/groups/<GROUP_ID>/members
```

**Expected Response:**
```json
{
  "success": true,
  "members": [
    {
      "id": "<uuid>",
      "lineUserId": "U-caregiver-001",
      "displayName": "ทดสอบ ดูแล",
      "role": "caregiver",
      "isActive": true,
      "joinedAt": "<timestamp>"
    },
    {
      "id": "<uuid>",
      "lineUserId": "U-family-001",
      "displayName": "ลูกสาว ทดสอบ",
      "role": "family",
      "isActive": true,
      "joinedAt": "<timestamp>"
    }
  ]
}
```

---

### 8. Register Patient WITH LINE Account

**Endpoint:** `POST /api/groups/register`

**Test:** Patient who has LINE account

```bash
curl -X POST http://localhost:3000/api/groups/register \
  -H "Content-Type: application/json" \
  -d '{
    "lineGroupId": "Ctest-group-67890",
    "groupName": "ครอบครัวคุณปู่",
    "caregiver": {
      "lineUserId": "U-caregiver-002",
      "displayName": "ผู้ดูแล สอง",
      "firstName": "ผู้ดูแล",
      "lastName": "สอง",
      "phoneNumber": "0898765432"
    },
    "patient": {
      "firstName": "คุณปู่",
      "lastName": "มีไลน์",
      "birthDate": "1945-06-20",
      "gender": "male",
      "chronicDiseases": ["hypertension"],
      "lineUserId": "U-patient-001",
      "displayName": "คุณปู่ มีไลน์"
    }
  }'
```

**Verify:** Patient should be added to `users` table and as a group member

---

## Error Test Cases

### E1. Register Group with Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/groups/register \
  -H "Content-Type: application/json" \
  -d '{
    "lineGroupId": "Ctest-error-001"
  }'
```

**Expected:**
```json
{
  "success": false,
  "error": "ข้อมูล caregiver ไม่ครบถ้วน"
}
```

---

### E2. Register Duplicate Group

```bash
# Try to register same LINE Group ID again
curl -X POST http://localhost:3000/api/groups/register \
  -H "Content-Type: application/json" \
  -d '{
    "lineGroupId": "Ctest-group-12345",
    ...
  }'
```

**Expected:** Database constraint error (should be caught and returned as proper error)

---

### E3. Get Non-existent Group

```bash
curl -X GET http://localhost:3000/api/groups/00000000-0000-0000-0000-000000000000
```

**Expected:**
```json
{
  "success": false,
  "error": "ไม่พบข้อมูลกลุ่ม"
}
```

---

### E4. Add Member with Missing Fields

```bash
curl -X POST http://localhost:3000/api/groups/<GROUP_ID>/members \
  -H "Content-Type: application/json" \
  -d '{
    "lineUserId": "U-incomplete"
  }'
```

**Expected:**
```json
{
  "success": false,
  "error": "ข้อมูลสมาชิกไม่ครบถ้วน"
}
```

---

## Database Verification Queries

After running the tests, verify data in Supabase:

### Check Groups Table
```sql
SELECT
  g.id,
  g.line_group_id,
  g.group_name,
  g.is_active,
  p.first_name || ' ' || p.last_name as patient_name,
  c.first_name || ' ' || c.last_name as caregiver_name
FROM groups g
LEFT JOIN patient_profiles p ON g.patient_id = p.id
LEFT JOIN caregiver_profiles c ON g.primary_caregiver_id = c.id
WHERE g.line_group_id LIKE 'Ctest-%';
```

### Check Group Members
```sql
SELECT
  gm.line_user_id,
  gm.display_name,
  gm.role,
  gm.is_active,
  g.group_name
FROM group_members gm
JOIN groups g ON gm.group_id = g.id
WHERE g.line_group_id LIKE 'Ctest-%'
ORDER BY gm.joined_at;
```

### Check Patient Profiles
```sql
SELECT
  pp.id,
  pp.user_id,
  pp.first_name,
  pp.last_name,
  pp.birth_date,
  pp.gender,
  ARRAY_LENGTH(pp.chronic_diseases, 1) as disease_count
FROM patient_profiles pp
WHERE pp.first_name LIKE '%ทดสอบ%' OR pp.first_name LIKE '%ปู่%' OR pp.first_name LIKE '%ยาย%';
```

### Check Users Table
```sql
SELECT
  u.id,
  u.line_user_id,
  u.display_name,
  u.role,
  u.primary_group_id
FROM users u
WHERE u.line_user_id LIKE 'U-caregiver-%' OR u.line_user_id LIKE 'U-patient-%';
```

---

## Test Summary Checklist

- [ ] Test 1: Check non-existent group
- [ ] Test 2: Register new group (patient without LINE)
- [ ] Test 3: Check existing group
- [ ] Test 4: Get group by ID
- [ ] Test 5: Get group by LINE Group ID
- [ ] Test 6: Add family member to group
- [ ] Test 7: Get all group members
- [ ] Test 8: Register group (patient WITH LINE)
- [ ] Error E1: Missing required fields
- [ ] Error E2: Duplicate group registration
- [ ] Error E3: Get non-existent group
- [ ] Error E4: Add member with missing fields
- [ ] DB Check: Verify groups table
- [ ] DB Check: Verify group_members table
- [ ] DB Check: Verify patient_profiles (user_id can be NULL)
- [ ] DB Check: Verify users table

---

## Cleanup

After testing, clean up test data:

```sql
-- Delete test groups
DELETE FROM groups WHERE line_group_id LIKE 'Ctest-%';

-- Delete test users
DELETE FROM users WHERE line_user_id LIKE 'U-caregiver-%' OR line_user_id LIKE 'U-patient-%' OR line_user_id LIKE 'U-family-%';
```

Note: CASCADE deletes should handle related records automatically.
