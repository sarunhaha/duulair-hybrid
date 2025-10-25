# TASK-008: Caregiver Dashboard (LIFF)

**Priority:** 🟢 Medium
**Status:** 📋 Ready to Start
**Owner:** Frontend Developer / LIFF Specialist
**Estimated Time:** 8-10 hours
**Dependencies:** TASK-001 (Registration), TASK-003 (Health Logging), TASK-004 (Reports), TASK-005 (Alerts)

---

## 📝 Overview

สร้าง LIFF Dashboard สำหรับผู้ดูแล เพื่อ:
- 👥 **ดูรายชื่อผู้ป่วยที่ดูแล**
- 📊 **ดูรายงานสุขภาพของผู้ป่วย**
- 🚨 **ดู Alerts ที่รอดำเนินการ**
- ⚙️ **ตั้งค่าการแจ้งเตือน**
- 📈 **ดู Trends และ Insights**

---

## 🎯 User Stories

### Story 1: Patient List
**As a** ผู้ดูแล
**I want** ดูรายชื่อผู้ป่วยที่ผมดูแลอยู่
**So that** เลือกดูข้อมูลของแต่ละคน

**Acceptance Criteria:**
- ✅ แสดงรายชื่อ + รูปโปรไฟล์
- ✅ แสดงสถานะล่าสุด (Active today, Last seen X hours ago)
- ✅ Badge แสดงจำนวน alerts ที่รอดำเนินการ
- ✅ กดเข้าไปดูรายละเอียด

### Story 2: Patient Dashboard
**As a** ผู้ดูแล
**I want** ดูข้อมูลสุขภาพของผู้ป่วยคนนั้น
**So that** ทราบสถานะปัจจุบัน

**Acceptance Criteria:**
- ✅ แสดง Quick Stats (ยา, น้ำ, ออกกำลังกาย, อาหาร วันนี้)
- ✅ แสดงความดันล่าสุด
- ✅ แสดง Alerts ที่ยังไม่ได้จัดการ
- ✅ ดูรายงาน Daily/Weekly
- ✅ ดูประวัติ Timeline

### Story 3: Alerts Management
**As a** ผู้ดูแล
**I want** ดูและจัดการ alerts ทั้งหมด
**So that** ไม่พลาดประเด็นสำคัญ

**Acceptance Criteria:**
- ✅ แสดง alerts แยกตาม severity (critical, urgent, warning)
- ✅ Filter by patient, status, date
- ✅ Acknowledge/Resolve alerts
- ✅ เห็นประวัติ alerts

### Story 4: Notification Settings
**As a** ผู้ดูแล
**I want** ตั้งค่าว่าจะได้รับการแจ้งเตือนแบบไหน
**So that** ไม่ถูกรบกวนมากเกินไป

**Acceptance Criteria:**
- ✅ เปิด/ปิดการแจ้งเตือนแต่ละประเภท
- ✅ ตั้ง minimum severity (info, warning, urgent, critical)
- ✅ เลือกว่าจะได้รับ daily report หรือไม่
- ✅ Quiet hours (ไม่แจ้งเตือนช่วงเวลาที่กำหนด)

### Story 5: Health Trends
**As a** ผู้ดูแล
**I want** ดู trend ของข้อมูลสุขภาพ
**So that** เห็นพัฒนาการ

**Acceptance Criteria:**
- ✅ กราฟความดัน 7 วัน/30 วัน
- ✅ กราฟการกินยา (completion rate)
- ✅ กราฟน้ำ, ออกกำลังกาย
- ✅ แสดง Average, Min, Max

---

## 🛠 Technical Implementation

### 1. File Structure

```
liff/
  ├── index.html                      # Entry - redirect to patient or caregiver
  ├── caregiver/
  │   ├── dashboard.html              # Main dashboard (patient list)
  │   ├── patient-detail.html         # Patient detail view
  │   ├── alerts.html                 # Alerts list & management
  │   ├── settings.html               # Notification settings
  │   ├── trends.html                 # Health trends & charts
  │   └── css/
  │       └── caregiver.css          # Caregiver-specific styles
  │   └── js/
  │       ├── dashboard.js
  │       ├── patient-detail.js
  │       ├── alerts.js
  │       ├── settings.js
  │       └── trends.js
  └── shared/
      ├── css/
      │   └── common.css             # Shared styles
      └── js/
          ├── liff-init.js           # LIFF SDK initialization
          ├── api.js                 # API wrapper
          └── utils.js               # Utilities
```

### 2. API Endpoints Needed

All endpoints already exist or easy to add:

```typescript
// Patient management
GET /api/registration/caregiver/:caregiver_id/patients
GET /api/registration/patient/:patient_id

// Health data
GET /api/health/logs/:patient_id
GET /api/reports/daily/:patient_id
GET /api/reports/weekly/:patient_id

// Alerts
GET /api/alerts/patient/:patient_id
POST /api/alerts/:alert_id/acknowledge
POST /api/alerts/:alert_id/resolve

// Settings
GET /api/registration/caregiver/:caregiver_id
PUT /api/registration/caregiver/:caregiver_id
```

### 3. Dashboard HTML

**File:** `liff/caregiver/dashboard.html`

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Duulair - ผู้ดูแล</title>
  <link rel="stylesheet" href="../shared/css/common.css">
  <link rel="stylesheet" href="css/caregiver.css">
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <h1>👥 ผู้ป่วยที่ดูแล</h1>
      <button id="settingsBtn" class="icon-btn">⚙️</button>
    </header>

    <!-- Alerts Summary -->
    <div class="alerts-summary" id="alertsSummary">
      <div class="alert-card critical">
        <span class="count" id="criticalCount">0</span>
        <span class="label">🆘 ฉุกเฉิน</span>
      </div>
      <div class="alert-card urgent">
        <span class="count" id="urgentCount">0</span>
        <span class="label">⚠️ เร่งด่วน</span>
      </div>
      <div class="alert-card warning">
        <span class="count" id="warningCount">0</span>
        <span class="label">⚠️ เตือน</span>
      </div>
    </div>

    <!-- Patient List -->
    <div class="patient-list" id="patientList">
      <!-- Populated by JS -->
    </div>

    <!-- Loading -->
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>กำลังโหลด...</p>
    </div>
  </div>

  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script src="../shared/js/liff-init.js"></script>
  <script src="../shared/js/api.js"></script>
  <script src="js/dashboard.js"></script>
</body>
</html>
```

### 4. Dashboard JavaScript

**File:** `liff/caregiver/js/dashboard.js`

```javascript
// Initialize
let caregiverId = null;

async function init() {
  try {
    // LIFF init (from liff-init.js)
    await initLiff();

    // Get caregiver profile
    const profile = await liff.getProfile();
    const caregiver = await api.get(`/api/registration/check`, {
      line_user_id: profile.userId
    });

    if (!caregiver.data.registered || caregiver.data.role !== 'caregiver') {
      alert('กรุณาลงทะเบียนเป็นผู้ดูแลก่อน');
      liff.closeWindow();
      return;
    }

    caregiverId = caregiver.data.profile_id;

    // Load data
    await Promise.all([
      loadPatients(),
      loadAlertsSummary()
    ]);

  } catch (error) {
    console.error('Initialization error:', error);
    showError('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

async function loadPatients() {
  const loading = document.getElementById('loading');
  const patientList = document.getElementById('patientList');

  try {
    loading.style.display = 'flex';

    // Get linked patients
    const response = await api.get(`/api/registration/caregiver/${caregiverId}/patients`);
    const patients = response.data;

    if (patients.length === 0) {
      patientList.innerHTML = `
        <div class="empty-state">
          <p>ยังไม่มีผู้ป่วยที่ดูแล</p>
          <p>กรุณาขอรหัสเชื่อมต่อจากผู้ป่วย</p>
        </div>
      `;
      return;
    }

    // Render patient cards
    patientList.innerHTML = patients.map(patient => `
      <div class="patient-card" onclick="viewPatient('${patient.patient_id}')">
        <div class="patient-avatar">
          ${patient.first_name.charAt(0)}
        </div>
        <div class="patient-info">
          <h3>${patient.first_name} ${patient.last_name}</h3>
          <p class="status ${patient.active_today ? 'active' : 'inactive'}">
            ${patient.active_today ? '✅ มีกิจกรรมวันนี้' : `⏰ ไม่มีกิจกรรม ${patient.hours_since_activity} ชม.`}
          </p>
        </div>
        <div class="patient-badges">
          ${patient.pending_alerts > 0 ? `<span class="badge alert">${patient.pending_alerts}</span>` : ''}
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading patients:', error);
    showError('ไม่สามารถโหลดข้อมูลผู้ป่วยได้');
  } finally {
    loading.style.display = 'none';
  }
}

async function loadAlertsSummary() {
  try {
    const response = await api.get(`/api/alerts/caregiver/${caregiverId}/summary`);
    const summary = response.data;

    document.getElementById('criticalCount').textContent = summary.critical || 0;
    document.getElementById('urgentCount').textContent = summary.urgent || 0;
    document.getElementById('warningCount').textContent = summary.warning || 0;

  } catch (error) {
    console.error('Error loading alerts summary:', error);
  }
}

function viewPatient(patientId) {
  window.location.href = `patient-detail.html?patient_id=${patientId}`;
}

// Event listeners
document.getElementById('settingsBtn').addEventListener('click', () => {
  window.location.href = 'settings.html';
});

// Initialize on load
init();
```

### 5. Patient Detail Page

**File:** `liff/caregiver/patient-detail.html`

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>รายละเอียดผู้ป่วย - Duulair</title>
  <link rel="stylesheet" href="../shared/css/common.css">
  <link rel="stylesheet" href="css/caregiver.css">
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <button onclick="history.back()" class="back-btn">← กลับ</button>
      <h1 id="patientName">...</h1>
    </header>

    <!-- Quick Stats -->
    <div class="quick-stats" id="quickStats">
      <!-- Populated by JS -->
    </div>

    <!-- Latest Vitals -->
    <div class="section">
      <h2>🩺 ความดันล่าสุด</h2>
      <div class="vitals-card" id="latestVitals">
        <!-- Populated by JS -->
      </div>
    </div>

    <!-- Active Alerts -->
    <div class="section">
      <h2>🚨 การแจ้งเตือน</h2>
      <div class="alerts-list" id="activeAlerts">
        <!-- Populated by JS -->
      </div>
    </div>

    <!-- Reports -->
    <div class="section">
      <h2>📊 รายงาน</h2>
      <div class="reports-buttons">
        <button onclick="viewDailyReport()">รายงานวันนี้</button>
        <button onclick="viewWeeklyReport()">รายงาน 7 วัน</button>
        <button onclick="viewTrends()">ดู Trends</button>
      </div>
    </div>

    <!-- Timeline -->
    <div class="section">
      <h2>📝 กิจกรรมล่าสุด</h2>
      <div class="timeline" id="timeline">
        <!-- Populated by JS -->
      </div>
    </div>
  </div>

  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script src="../shared/js/liff-init.js"></script>
  <script src="../shared/js/api.js"></script>
  <script src="js/patient-detail.js"></script>
</body>
</html>
```

### 6. Trends & Charts

**File:** `liff/caregiver/trends.html`

Use Chart.js for visualization:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<canvas id="bpChart"></canvas>
<canvas id="activityChart"></canvas>

<script>
// Blood Pressure Chart
const bpCtx = document.getElementById('bpChart').getContext('2d');
const bpChart = new Chart(bpCtx, {
  type: 'line',
  data: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Systolic',
        data: [120, 125, 118, 130, 122, 119, 121],
        borderColor: '#F44336',
        backgroundColor: 'rgba(244, 67, 54, 0.1)'
      },
      {
        label: 'Diastolic',
        data: [80, 82, 78, 85, 81, 79, 80],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)'
      }
    ]
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'ความดันโลหิต 7 วันที่ผ่านมา'
      }
    }
  }
});
</script>
```

### 7. CSS Styling

**File:** `liff/caregiver/css/caregiver.css`

```css
:root {
  --primary: #4CAF50;
  --danger: #F44336;
  --warning: #FF9800;
  --info: #2196F3;
}

/* Patient Cards */
.patient-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.patient-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.patient-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  margin-right: 16px;
}

.patient-info {
  flex: 1;
}

.patient-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
}

.status {
  font-size: 14px;
  color: #666;
}

.status.active {
  color: var(--primary);
}

.status.inactive {
  color: var(--warning);
}

.badge {
  background: var(--danger);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: bold;
}

/* Alerts Summary */
.alerts-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.alert-card {
  background: white;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.alert-card.critical {
  border-left: 4px solid var(--danger);
}

.alert-card.urgent {
  border-left: 4px solid var(--warning);
}

.alert-card .count {
  display: block;
  font-size: 32px;
  font-weight: bold;
  color: #333;
}

.alert-card .label {
  font-size: 12px;
  color: #666;
}

/* Quick Stats */
.quick-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-card .value {
  font-size: 24px;
  font-weight: bold;
  color: var(--primary);
}

.stat-card .label {
  font-size: 14px;
  color: #666;
}
```

---

## 📂 Files to Create

1. `liff/caregiver/dashboard.html` - Main dashboard
2. `liff/caregiver/patient-detail.html` - Patient detail view
3. `liff/caregiver/alerts.html` - Alerts management
4. `liff/caregiver/settings.html` - Settings page
5. `liff/caregiver/trends.html` - Health trends & charts
6. `liff/caregiver/css/caregiver.css` - Styles
7. `liff/caregiver/js/dashboard.js` - Dashboard logic
8. `liff/caregiver/js/patient-detail.js` - Patient detail logic
9. `liff/caregiver/js/alerts.js` - Alerts logic
10. `liff/caregiver/js/settings.js` - Settings logic
11. `liff/caregiver/js/trends.js` - Charts logic

---

## ✅ Testing Checklist

### Functional Tests
- [ ] Dashboard โหลดข้อมูลผู้ป่วยถูกต้อง
- [ ] Alerts summary แสดงจำนวนถูกต้อง
- [ ] Patient detail แสดงข้อมูลครบถ้วน
- [ ] Acknowledge alert ทำงาน
- [ ] Settings บันทึกได้
- [ ] Charts แสดงผลถูกต้อง

### UI/UX Tests
- [ ] Responsive ทุกขนาดหน้าจอ
- [ ] Loading states ทำงาน
- [ ] Error handling ทำงาน
- [ ] Navigation ราบรื่น

---

## 🚀 Deployment

```bash
# No build step for vanilla JS
# Just deploy to Vercel static hosting

# Update vercel.json
{
  "routes": [
    { "src": "/liff/(.*)", "dest": "/liff/$1" }
  ]
}

# Deploy
git add liff/caregiver/
git commit -m "Add caregiver dashboard (LIFF)"
git push origin master
```

---

## 📊 Success Metrics

- ✅ Page load time < 2 วินาที
- ✅ Dashboard usage > 70% ของผู้ดูแล
- ✅ Alert response time ลดลง 50%
- ✅ User satisfaction > 85%

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
