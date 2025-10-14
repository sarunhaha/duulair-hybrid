# 📋 Duulair Business Requirements & Tasks

> Business requirements and action items for non-technical team members

**Document Owner:** Business Team
**Last Updated:** 2024-01-15
**Status:** 🟢 Active

---

## 📊 Executive Summary

Duulair เป็นระบบ AI-powered healthcare monitoring สำหรับดูแลผู้สูงอายุผ่าน LINE Bot โดยมี features หลัก:

✅ **ทำงานแล้ว (MVP):**
- ระบบ Multi-Agent AI (5 agents)
- รองรับการสนทนาภาษาไทย
- บันทึกข้อมูลสุขภาพอัตโนมัติ
- รองรับ N8N workflow automation

🚧 **ต้องทำต่อ:**
- ตั้งค่า Database
- เชื่อมต่อ LINE Bot
- ทดสอบกับผู้ใช้จริง
- เตรียม Launch

---

## 🎯 Immediate Action Items (สัปดาห์นี้)

### Priority 1: ข้อมูลและบัญชี 🔴 URGENT

#### 1.1 Supabase Account Setup
**ผู้รับผิดชอบ:** Business/Product Owner
**เวลา:** 30 นาที
**สถานะ:** ⏳ Pending

**ขั้นตอน:**
1. ไปที่ https://supabase.com/
2. Sign up ด้วย email บริษัท
3. สร้าง Organization: "Duulair"
4. สร้าง Project ชื่อ "duulair-production"
5. บันทึก:
   - Project URL
   - Service Role Key (เก็บเป็นความลับ!)
6. ส่งข้อมูลให้ทีม Dev

**Deliverable:** Supabase credentials

---

#### 1.2 Anthropic Claude API Account
**ผู้รับผิดชอบ:** Business/Finance
**เวลา:** 30 นาที
**สถานะ:** ⏳ Pending

**ขั้นตอน:**
1. ไปที่ https://console.anthropic.com/
2. Sign up ด้วย email บริษัท
3. เพิ่ม Payment method (Credit card)
4. Top-up credits ($100 เพื่อเริ่มต้น)
5. สร้าง API Key
6. บันทึก API Key (เริ่มต้นด้วย sk-ant-...)
7. ส่งให้ทีม Dev

**Budget:**
- ราคา: ~$0.25 per 1M tokens (Haiku)
- ประมาณการ: $50-100/เดือน สำหรับ 100 users
- Top-up แนะนำ: $100-200 เพื่อเริ่มต้น

**Deliverable:** Anthropic API Key

---

#### 1.3 LINE Developer Account
**ผู้รับผิดชอบ:** Business/Product
**เวลา:** 1 ชั่วโมง
**สถานะ:** ⏳ Pending

**ขั้นตอน:**
1. ไปที่ https://developers.line.biz/console/
2. Login ด้วย LINE account บริษัท
3. สร้าง Provider ชื่อ "Duulair Healthcare"
4. สร้าง Messaging API Channel:
   - Channel name: "Duulair Care Bot"
   - Channel description: "ผู้ช่วยดูแลสุขภาพผู้สูงอายุ"
   - Category: Medical/Healthcare
5. บันทึก:
   - Channel ID
   - Channel Secret
   - Channel Access Token
6. ส่งให้ทีม Dev

**Note:** ฟรี! ไม่มีค่าใช้จ่าย

**Deliverable:** LINE Channel credentials

---

### Priority 2: Content & การสื่อสาร 🟡 HIGH

#### 2.1 Welcome Message
**ผู้รับผิดชอบ:** Content/Marketing
**เวลา:** 2 ชั่วโมง
**สถานะ:** ⏳ Pending

**เนื้อหาที่ต้องเตรียม:**

1. **Welcome Message** (เมื่อ Add Friend)
   ```
   สวัสดีค่ะ! ยินดีต้อนรับสู่ Duulair 🤖

   ฉันเป็นผู้ช่วยดูแลสุขภาพของคุณ พร้อมช่วยเหลือคุณเรื่อง:

   💊 การกินยา
   📊 การวัดความดัน/น้ำตาล
   💧 การดื่มน้ำ
   🚶 การออกกำลังกาย
   🍚 การทานอาหาร
   🚨 การแจ้งเตือนฉุกเฉิน

   ลองพิมพ์ "กินยาแล้ว" หรือ "วัดความดัน 120/80" ดูนะคะ 😊
   ```

2. **Auto-Reply Messages**
   - ข้อความเมื่อไม่เข้าใจ
   - ข้อความขอโทษเมื่อมี error
   - FAQ responses

3. **Rich Menu Design**
   - ออกแบบ menu ด้านล่าง LINE chat
   - กำหนด actions (log medication, check report, etc.)

**Deliverable:** Document with all messages

---

#### 2.2 User Onboarding Flow
**ผู้รับผิดชอบ:** Product/UX
**เวลา:** 4 ชั่วโมง
**สถานะ:** ⏳ Pending

**ออกแบบ Flow:**

1. **User Registration**
   - เก็บข้อมูลอะไรบ้าง?
     - ชื่อ-นามสกุล
     - อายุ
     - โรคประจำตัว
     - ยาที่ทาน
     - ข้อมูล Caregiver

2. **Initial Setup**
   - กำหนดเวลากินยา
   - ตั้งค่าการแจ้งเตือน
   - เชื่อม Google Calendar?

3. **Tutorial**
   - สอนใช้งานพื้นฐาน
   - ตัวอย่างคำสั่ง
   - Quick wins

**Deliverable:** User flow diagram + wireframes

---

### Priority 3: ข้อมูลผู้ใช้ทดสอบ 🟢 MEDIUM

#### 3.1 Test Data Preparation
**ผู้รับผิดชอบ:** Product/QA
**เวลา:** 3 ชั่วโมง
**สถานะ:** ⏳ Pending

**เตรียมข้อมูล:**

1. **Test Patients** (5-10 คน)
   ```
   Patient 1:
   - Name: คุณยาย มะลิ
   - Age: 75
   - Conditions: เบาหวาน, ความดันโลหิตสูง
   - Medications: Metformin 500mg (เช้า-เย็น), Amlodipine 5mg (เช้า)
   - Caregiver: ลูกสาว (LINE: U123456789)

   Patient 2: ...
   ```

2. **Test Scenarios**
   - สถานการณ์ปกติ (กินยาตรงเวลา)
   - สถานการณ์ลืมยา
   - สถานการณ์ความดันผิดปกติ
   - สถานการณ์ฉุกเฉิน

3. **Sample Messages**
   - ข้อความที่คาดว่าจะได้รับ
   - คำตอบที่ถูกต้อง

**Deliverable:** Excel/Google Sheets with test data

---

#### 3.2 Caregiver Requirements
**ผู้รับผิดชอบ:** Product
**เวลา:** 2 ชั่วโมง
**สถานะ:** ⏳ Pending

**ความต้องการของ Caregiver:**

1. **การรับแจ้งเตือน**
   - Alert levels (Info, Warning, Urgent, Critical)
   - ช่องทางการแจ้งเตือน (LINE, Email, SMS)
   - เวลาที่เหมาะสม

2. **Dashboard/Reports**
   - ดูข้อมูลสุขภาพแบบ realtime
   - รายงานรายวัน/รายสัปดาห์
   - Export data (PDF, CSV)

3. **Communication**
   - คุยกับผู้สูงอายุผ่าน Bot?
   - ส่งข้อความเตือนเอง?

**Deliverable:** Requirements document

---

## 📅 Timeline & Milestones

### Week 1: Setup & Configuration
**Owner:** Business + Dev
**Goal:** ระบบพร้อมทดสอบ

- [ ] Day 1-2: ตั้งค่าบัญชีทั้งหมด (Supabase, Claude, LINE)
- [ ] Day 3-4: Dev deploy database + LINE bot
- [ ] Day 5: ทดสอบ internal

**Deliverable:** Working bot in test environment

---

### Week 2: Content & Testing
**Owner:** Product + QA
**Goal:** เตรียมพร้อม launch

- [ ] Day 1-2: เขียน content ทั้งหมด
- [ ] Day 3-4: ทดสอบกับ test users (internal)
- [ ] Day 5: รวบรวม feedback และปรับปรุง

**Deliverable:** Tested content + feedback report

---

### Week 3: Pilot Launch
**Owner:** Business
**Goal:** Launch กับผู้ใช้จริง (limited)

- [ ] Day 1: เชิญ 10 test users
- [ ] Day 2-7: Monitor usage
- [ ] ประชุมทุกวันเพื่อ review issues

**Deliverable:** 10 active users, usage report

---

### Week 4: Feedback & Iteration
**Owner:** Product
**Goal:** ปรับปรุงตาม feedback

- [ ] Analyze user behavior
- [ ] ปรับ messages/prompts
- [ ] Fix bugs
- [ ] Prepare for full launch

**Deliverable:** Improved version ready for scale

---

## 💰 Budget Requirements

### Initial Setup Costs

| Item | Cost | Frequency | Notes |
|------|------|-----------|-------|
| **Supabase** | $0-25 | /month | ฟรี until 500MB database |
| **Anthropic Claude API** | $50-100 | /month | ~100 users, $0.25/1M tokens |
| **LINE Bot** | $0 | Free | ไม่มีค่าใช้จ่าย |
| **N8N** | $0-20 | /month | Self-hosted free, Cloud $20 |
| **Hosting (Railway/Render)** | $5-10 | /month | Starter plan |
| **Domain** | $10-15 | /year | Optional |

**Total (Month 1):** ~$100-200 setup + $70-150/month

---

### Scaling Costs (100-1000 users)

| Users | Claude API | Supabase | Hosting | Total/mo |
|-------|-----------|----------|---------|----------|
| 100 | $50-100 | $25 | $10 | $85-135 |
| 500 | $200-300 | $25 | $20 | $245-345 |
| 1000 | $400-600 | $100 | $50 | $550-750 |

**Note:** ราคาประมาณการ อาจเปลี่ยนแปลงตามการใช้งานจริง

---

## 📊 Success Metrics (KPIs)

### User Engagement
- **Target:** 50% daily active users
- **Measure:** จำนวน users ที่ส่งข้อความต่อวัน
- **How to track:** Supabase analytics

### Health Data Logging
- **Target:** 80% medication adherence
- **Measure:** % ของยาที่ log ครบตามกำหนด
- **How to track:** Daily reports

### Response Time
- **Target:** <5 seconds
- **Measure:** เวลาตั้งแต่ส่งข้อความจนได้รับคำตอบ
- **How to track:** Bot response logs

### User Satisfaction
- **Target:** >4.5/5 stars
- **Measure:** Survey หลังใช้งาน 1 สัปดาห์
- **How to track:** Google Forms

### Caregiver Alerts
- **Target:** <1 minute delivery
- **Measure:** เวลาจาก event จนส่ง notification
- **How to track:** Alert logs

---

## 🤝 Stakeholder Responsibilities

### Business Team
- [ ] Setup accounts (Supabase, Claude, LINE)
- [ ] Write content & messages
- [ ] Recruit test users
- [ ] Manage budget
- [ ] Track KPIs

### Product Team
- [ ] Define user flows
- [ ] Design onboarding
- [ ] Prioritize features
- [ ] Conduct user testing
- [ ] Analyze feedback

### Marketing Team
- [ ] Create promotional materials
- [ ] Social media strategy
- [ ] User acquisition
- [ ] Brand guidelines
- [ ] Launch campaign

### Support Team
- [ ] Create FAQ
- [ ] Prepare support scripts
- [ ] Monitor user issues
- [ ] Escalation procedures
- [ ] User training

---

## 📝 Decision Log

### Decisions Needed This Week

#### 1. Pricing Model
**Question:** ฟรีหรือคิดเงิน? ราคาเท่าไร?

**Options:**
- Option A: ฟรีสำหรับ early adopters (3 months)
- Option B: Freemium (basic free, premium 99฿/month)
- Option C: ชาร์จเลย 199฿/month

**Decision:** _________ (Date: _______)

---

#### 2. Target User Group
**Question:** กลุ่มเป้าหมายแรก?

**Options:**
- Option A: ผู้สูงอายุที่อยู่คนเดียว
- Option B: ผู้ป่วยเบาหวาน/ความดัน
- Option C: ผู้สูงอายุใน nursing home
- Option D: ทั่วไป (broad)

**Decision:** _________ (Date: _______)

---

#### 3. Caregiver Access
**Question:** Caregiver เข้าถึงข้อมูลได้อย่างไร?

**Options:**
- Option A: ผ่าน LINE bot เหมือนกัน
- Option B: Web dashboard แยก
- Option C: รายงานส่ง email อย่างเดียว

**Decision:** _________ (Date: _______)

---

#### 4. Data Retention
**Question:** เก็บข้อมูลนานแค่ไหน?

**Options:**
- Option A: 3 months (ประหยัด storage)
- Option B: 1 year (standard)
- Option C: Forever (complete history)

**Decision:** _________ (Date: _______)

---

## 🚨 Risks & Mitigation

### Risk 1: User Adoption ต่ำ
**Probability:** Medium
**Impact:** High

**Mitigation:**
- เริ่มด้วย pilot group เล็กๆ
- ทำ onboarding ที่ดี
- มี incentives (ของแจก, discount)
- Support team พร้อมช่วยเหลือ

---

### Risk 2: API Costs สูงเกินคาด
**Probability:** Medium
**Impact:** High

**Mitigation:**
- ติดตาม usage รายวัน
- ตั้ง budget alerts
- Optimize prompts ให้สั้น
- Cache frequent queries

---

### Risk 3: Data Privacy Issues
**Probability:** Low
**Impact:** Critical

**Mitigation:**
- Comply with PDPA
- Encrypt sensitive data
- รับ consent ก่อนใช้
- มี privacy policy ชัดเจน

---

### Risk 4: LINE Bot Rejected/Blocked
**Probability:** Low
**Impact:** Critical

**Mitigation:**
- ทำตาม LINE guidelines ทุกข้อ
- ไม่ spam users
- Respect message limits
- มี backup plan (web app)

---

## 📞 Support & Escalation

### Who to Contact

**Technical Issues:**
- Dev Team Lead: [Name]
- Email: dev@duulair.com
- LINE: @duulair-dev

**Business Questions:**
- Product Manager: [Name]
- Email: product@duulair.com

**Urgent/Critical:**
- Emergency Hotline: [Phone]
- Slack: #duulair-emergency

---

## ✅ Next Actions (This Week)

### Must Do (By Friday)
- [ ] **Create Supabase account** → Business Team
- [ ] **Get Claude API key** → Finance Team
- [ ] **Setup LINE channel** → Product Team
- [ ] **Write welcome message** → Content Team
- [ ] **Prepare test data** → QA Team

### Nice to Have
- [ ] Design rich menu
- [ ] Create user flow diagram
- [ ] Write FAQ draft
- [ ] Plan launch campaign

---

## 📅 Meeting Schedule

**Weekly Sprint Planning:** Every Monday 10:00 AM
**Daily Standup:** Every day 9:30 AM (15 min)
**Demo/Review:** Every Friday 4:00 PM
**Retro:** Every Friday 4:30 PM

---

## 📚 Resources

**For Business Team:**
- Supabase: https://supabase.com/docs
- Anthropic Pricing: https://www.anthropic.com/pricing
- LINE Business Guide: https://developers.line.biz/

**Internal Docs:**
- Setup Guide: `/docs/SETUP.md`
- User Manual: (TBD)
- FAQ: (TBD)

---

**Last Updated:** 2024-01-15
**Next Review:** Next Monday Sprint Planning
**Document Owner:** Product Manager

---

**Questions? Contact Product Team!** 🚀
