# Debug Queries สำหรับตรวจสอบปัญหา Registration

## ปัญหา:
User ลงทะเบียนแล้วได้ error "User already registered" แต่ไม่สามารถ load ข้อมูล patient ได้

## Patient ID ที่มีปัญหา:
```
80d39533-e193-42dc-bbb8-4a467e209565
```

---

## 1. ตรวจสอบว่า Patient ID นี้มีในฐานข้อมูลหรือไม่

```sql
SELECT * FROM patient_profiles
WHERE id = '80d39533-e193-42dc-bbb8-4a467e209565';
```

**คาดว่าจะได้**: ถ้า patient ถูกสร้างจริง ควรมี 1 row
**ถ้าได้ 0 rows**: แสดงว่า patient ไม่เคยถูกสร้างเลย

---

## 2. หา LINE User ID ของผู้ใช้

ต้องการ LINE User ID เพื่อเช็คต่อ กรุณาเปิด debug-v3.html แล้วดูที่ Step 3

หรือรันคำสั่งนี้ใน JavaScript Console ของ group-registration.html:
```javascript
liff.getProfile().then(p => console.log('LINE User ID:', p.userId))
```

---

## 3. ตรวจสอบว่า LINE User ID มีในตาราง users หรือไม่

แทน `YOUR_LINE_USER_ID` ด้วย LINE User ID จริง:

```sql
SELECT * FROM users
WHERE line_user_id = 'YOUR_LINE_USER_ID';
```

**ถ้าได้ 1 row**: แสดงว่า user มีในระบบแล้ว (เลยได้ error "User already registered")
**ถ้าได้ 0 rows**: แสดงว่า user ไม่เคยลงทะเบียน

---

## 4. ตรวจสอบ Caregiver Profile

ใช้ `user.id` จาก query ข้างบน:

```sql
SELECT * FROM caregiver_profiles
WHERE user_id = 'USER_ID_FROM_STEP_3';
```

**ควรได้ 1 row** ถ้า caregiver ถูกสร้างแล้ว

---

## 5. ตรวจสอบการ Link ระหว่าง Caregiver กับ Patient

ใช้ `caregiver_profiles.id` จาก query ข้างบน:

```sql
SELECT * FROM patient_caregivers
WHERE caregiver_id = 'CAREGIVER_ID_FROM_STEP_4';
```

**ควรได้ 1 row** ที่มี:
- `patient_id`: Patient ID ที่ถูก link
- `status`: 'active'
- `relationship`: ความสัมพันธ์ที่เลือก

---

## 6. ตรวจสอบว่า Patient จาก Link มีจริงหรือไม่

ใช้ `patient_id` จาก query ข้างบน:

```sql
SELECT * FROM patient_profiles
WHERE id = 'PATIENT_ID_FROM_STEP_5';
```

**ควรได้ 1 row** ถ้า patient ถูกสร้างจริง

---

## 7. ตรวจสอบ Patient ทั้งหมดที่ถูกสร้างล่าสุด (10 รายการ)

```sql
SELECT id, first_name, last_name, birth_date, created_at
FROM patient_profiles
ORDER BY created_at DESC
LIMIT 10;
```

ดูว่ามี patient ที่คุณสร้างหรือไม่

---

## 8. ตรวจสอบ Caregiver ทั้งหมดที่ถูกสร้างล่าสุด (10 รายการ)

```sql
SELECT cp.id, cp.first_name, cp.last_name, u.line_user_id, cp.created_at
FROM caregiver_profiles cp
JOIN users u ON u.id = cp.user_id
ORDER BY cp.created_at DESC
LIMIT 10;
```

ดูว่ามี caregiver ของคุณหรือไม่

---

## สรุปสิ่งที่ต้องทำ:

1. รัน Query 1 ก่อน → ดูว่า Patient ID ที่มีปัญหามีในฐานข้อมูลหรือไม่
2. หา LINE User ID จาก debug-v3.html
3. รัน Query 3-6 → ติดตามว่าข้อมูล user มีครบหรือไม่
4. รัน Query 7-8 → ดูข้อมูลล่าสุดที่ถูกสร้าง
5. **บอกผลมาให้ผม** จะได้รู้ว่าปัญหาอยู่ที่ไหนแน่ๆ

---

## คำถามสำคัญที่จะตอบได้หลังรัน queries:

- ✅ User มีในระบบหรือไม่? (Query 3)
- ✅ Caregiver ถูกสร้างหรือไม่? (Query 4)
- ✅ Patient ถูกสร้างหรือไม่? (Query 1, 6)
- ✅ Caregiver กับ Patient ถูก link กันหรือไม่? (Query 5)
- ✅ ถ้าไม่มี patient → registration ล้มเหลวตรงไหน?

**กรุณารัน queries และส่งผลมาให้ผมครับ จะได้รู้ว่าปัญหาเกิดจากอะไรแน่ๆ**
