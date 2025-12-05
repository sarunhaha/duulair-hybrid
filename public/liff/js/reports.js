// ========================================
// OONJAI Reports Dashboard
// ========================================

// API Base URL for Edge Functions
const REPORTS_API_URL = 'https://mqxklnzxfrupwwkwlwwc.supabase.co/functions/v1/reports-api';

// Supabase Anon Key (required for Edge Function authorization)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xeGtsbnp4ZnJ1cHd3a3dsd3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNjcxMjYsImV4cCI6MjA3MjY0MzEyNn0.vPBkIGHdvrfotD3QMnFGrNRMTP3fFzn715XGwqKG-6Y';

// State
let currentPatientId = null;
let patients = [];
let dateFrom = null;
let dateTo = null;
let reportData = null;
let liffAccessToken = null;

// Charts
let bpChart = null;
let medChart = null;
let waterChart = null;

// Date pickers
let dateFromPicker = null;
let dateToPicker = null;

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoading('กำลังเริ่มต้นระบบ...');

    // Initialize LIFF
    const profile = await initLiff();
    if (!profile) return;

    // Get LIFF access token
    liffAccessToken = liff.getAccessToken();
    console.log('🔑 LIFF Access Token:', liffAccessToken ? `${liffAccessToken.substring(0, 20)}...` : 'NULL');
    console.log('🔑 Token length:', liffAccessToken?.length);
    if (!liffAccessToken) {
      throw new Error('ไม่สามารถดึง access token ได้');
    }

    showLoading('กำลังโหลดข้อมูล...');

    // Initialize date pickers
    initDatePickers();

    // Set default date range (7 days)
    setDateRange(7);

    // Setup event listeners
    setupEventListeners();

    // Load patients
    await loadPatients();

    hideLoading();

  } catch (error) {
    console.error('Initialization error:', error);
    hideLoading();
    showError('เกิดข้อผิดพลาด: ' + error.message);
  }
});

// ========================================
// Date Picker Initialization
// ========================================

function initDatePickers() {
  const maxDate = new Date();
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 90); // 90 days back

  const config = {
    locale: 'th',
    dateFormat: 'd/m/Y',
    maxDate: maxDate,
    minDate: minDate,
    disableMobile: true
  };

  dateFromPicker = flatpickr('#date-from', {
    ...config,
    onChange: (selectedDates) => {
      if (selectedDates[0]) {
        dateToPicker.set('minDate', selectedDates[0]);
      }
    }
  });

  dateToPicker = flatpickr('#date-to', {
    ...config,
    onChange: (selectedDates) => {
      if (selectedDates[0]) {
        dateFromPicker.set('maxDate', selectedDates[0]);
      }
    }
  });
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // Date preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const days = this.dataset.days;

      // Update active state
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      if (days === 'custom') {
        document.getElementById('custom-date-range').classList.remove('hidden');
      } else {
        document.getElementById('custom-date-range').classList.add('hidden');
        setDateRange(parseInt(days));
        loadReport();
      }
    });
  });

  // Patient selector
  document.getElementById('patient-select').addEventListener('change', function() {
    currentPatientId = this.value;
    if (currentPatientId) {
      loadReport();
    }
  });
}

// ========================================
// Date Range Functions
// ========================================

function setDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);

  dateFrom = formatDateForAPI(start);
  dateTo = formatDateForAPI(end);

  // Update date pickers
  if (dateFromPicker) dateFromPicker.setDate(start);
  if (dateToPicker) dateToPicker.setDate(end);

  updateDateDisplay();
}

function applyCustomDateRange() {
  const fromDate = dateFromPicker.selectedDates[0];
  const toDate = dateToPicker.selectedDates[0];

  if (!fromDate || !toDate) {
    showError('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด');
    return;
  }

  dateFrom = formatDateForAPI(fromDate);
  dateTo = formatDateForAPI(toDate);

  updateDateDisplay();
  loadReport();
}

function updateDateDisplay() {
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);

  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const fromStr = fromDate.toLocaleDateString('th-TH', options);
  const toStr = toDate.toLocaleDateString('th-TH', options);

  document.getElementById('date-range-display').textContent = `${fromStr} - ${toStr}`;
}

function formatDateForAPI(date) {
  return date.toISOString().split('T')[0];
}

// ========================================
// API Functions
// ========================================

async function loadPatients() {
  try {
    console.log('📡 Calling /patients API...');
    console.log('📡 Token being sent:', liffAccessToken ? `${liffAccessToken.substring(0, 20)}...` : 'NULL');

    const response = await fetch(`${REPORTS_API_URL}/patients`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-liff-access-token': liffAccessToken
      }
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('📡 Error response:', error);
      throw new Error(error.error || 'Failed to load patients');
    }

    const data = await response.json();
    patients = data.patients || [];

    if (patients.length === 0) {
      showError('ไม่พบผู้ป่วยในกลุ่มของคุณ');
      return;
    }

    // If only one patient, auto-select
    if (patients.length === 1) {
      currentPatientId = patients[0].id;
      document.getElementById('patient-selector').classList.add('hidden');
      loadReport();
    } else {
      // Show patient selector
      const select = document.getElementById('patient-select');
      patients.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
      });
      document.getElementById('patient-selector').classList.remove('hidden');
    }

  } catch (error) {
    console.error('Error loading patients:', error);
    showError('ไม่สามารถโหลดข้อมูลผู้ป่วยได้: ' + error.message);
  }
}

async function loadReport() {
  if (!currentPatientId) return;

  try {
    showLoading('กำลังโหลดรายงาน...');

    const url = `${REPORTS_API_URL}/summary?patientId=${currentPatientId}&from=${dateFrom}&to=${dateTo}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-liff-access-token': liffAccessToken
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load report');
    }

    reportData = await response.json();
    console.log('Report data:', reportData);

    updateUI();
    hideLoading();

  } catch (error) {
    console.error('Error loading report:', error);
    hideLoading();
    showError('ไม่สามารถโหลดรายงานได้: ' + error.message);
  }
}

// ========================================
// UI Update Functions
// ========================================

function updateUI() {
  if (!reportData) return;

  updateSummaryCards();
  updateCharts();
  updateActivities();
}

function updateSummaryCards() {
  const { summary, period } = reportData;

  // Blood Pressure
  if (summary.bloodPressure.avgSystolic) {
    document.getElementById('bp-value').textContent =
      `${summary.bloodPressure.avgSystolic}/${summary.bloodPressure.avgDiastolic}`;

    const bpStatus = document.getElementById('bp-status');
    const status = summary.bloodPressure.status || 'unknown';
    bpStatus.textContent = getBPStatusText(status);
    bpStatus.className = 'card-status ' + status;
  } else {
    document.getElementById('bp-value').textContent = 'ไม่มีข้อมูล';
    document.getElementById('bp-status').textContent = '';
  }

  // Medications
  if (summary.medications.compliancePercent !== null) {
    document.getElementById('med-value').textContent =
      `${summary.medications.compliancePercent}%`;
    document.getElementById('med-status').textContent =
      `${summary.medications.totalTaken}/${summary.medications.totalScheduled} ครั้ง`;
  } else {
    document.getElementById('med-value').textContent = 'ไม่มีข้อมูล';
    document.getElementById('med-status').textContent = '';
  }

  // Water
  if (summary.water.avgDailyMl > 0) {
    document.getElementById('water-value').textContent =
      `${formatNumber(summary.water.avgDailyMl)} มล.`;
    document.getElementById('water-status').textContent =
      `${summary.water.compliancePercent || 0}% ของเป้าหมาย`;
  } else {
    document.getElementById('water-value').textContent = 'ไม่มีข้อมูล';
    document.getElementById('water-status').textContent = '';
  }

  // Activities
  document.getElementById('activity-value').textContent =
    `${summary.activities.totalCount} รายการ`;
  document.getElementById('activity-status').textContent =
    `ออกกำลังกาย ${summary.activities.exerciseMinutes} นาที`;
}

function updateCharts() {
  const { dailyData } = reportData;

  // Prepare labels (dates)
  const labels = dailyData.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  });

  // Blood Pressure Chart
  updateBPChart(labels, dailyData);

  // Medication Chart
  updateMedChart(labels, dailyData);

  // Water Chart
  updateWaterChart(labels, dailyData);
}

function updateBPChart(labels, dailyData) {
  const ctx = document.getElementById('bp-chart').getContext('2d');

  const systolicData = dailyData.map(d => d.bp?.systolic || null);
  const diastolicData = dailyData.map(d => d.bp?.diastolic || null);

  if (bpChart) bpChart.destroy();

  bpChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Systolic',
          data: systolicData,
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          fill: false,
          spanGaps: true
        },
        {
          label: 'Diastolic',
          data: diastolicData,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: false,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          min: 40,
          max: 200,
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45 }
        }
      }
    }
  });
}

function updateMedChart(labels, dailyData) {
  const ctx = document.getElementById('med-chart').getContext('2d');

  const takenData = dailyData.map(d => d.medications.taken);
  const scheduledData = dailyData.map(d => d.medications.scheduled);

  if (medChart) medChart.destroy();

  medChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'กินแล้ว',
          data: takenData,
          backgroundColor: '#7EE081',
          borderRadius: 4
        },
        {
          label: 'เป้าหมาย',
          data: scheduledData,
          backgroundColor: 'rgba(126, 224, 129, 0.3)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45 }
        }
      }
    }
  });
}

function updateWaterChart(labels, dailyData) {
  const ctx = document.getElementById('water-chart').getContext('2d');

  const waterData = dailyData.map(d => d.water.ml);
  const goalData = dailyData.map(d => d.water.goal);

  if (waterChart) waterChart.destroy();

  waterChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'ดื่มแล้ว',
          data: waterData,
          backgroundColor: '#3B82F6',
          borderRadius: 4
        },
        {
          type: 'line',
          label: 'เป้าหมาย',
          data: goalData,
          borderColor: '#F59E0B',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: (value) => value >= 1000 ? (value / 1000) + 'L' : value + 'ml'
          }
        },
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45 }
        }
      }
    }
  });
}

// ========================================
// Activity Details Functions
// ========================================

function updateActivities() {
  const { recentActivities } = reportData;
  const container = document.getElementById('activities-list');

  if (!recentActivities || recentActivities.length === 0) {
    container.innerHTML = `
      <div class="no-data">
        <div class="no-data-icon">📋</div>
        <div class="no-data-text">ไม่มีกิจกรรมในช่วงเวลานี้</div>
      </div>
    `;
    return;
  }

  // Group by date
  const groupedByDate = {};
  recentActivities.forEach(activity => {
    const date = activity.time.split('T')[0];
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(activity);
  });

  let html = '';
  Object.keys(groupedByDate).sort().reverse().forEach(date => {
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('th-TH', {
      weekday: 'short', day: 'numeric', month: 'short'
    });

    html += `<div class="activity-date-header">📅 ${dateStr}</div>`;

    groupedByDate[date].forEach(activity => {
      const icon = getActivityIcon(activity.type);
      const typeName = getActivityTypeName(activity.type);
      const timeStr = new Date(activity.time).toLocaleTimeString('th-TH', {
        hour: '2-digit', minute: '2-digit'
      });

      html += `
        <div class="activity-item">
          <div class="activity-icon">${icon}</div>
          <div class="activity-content">
            <div class="activity-type">${typeName}</div>
            ${activity.value ? `<div class="activity-value">${activity.value}</div>` : ''}
          </div>
          <div class="activity-time">${timeStr}</div>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

function getActivityIcon(type) {
  const icons = {
    'medication': '💊',
    'blood_pressure': '🩺',
    'water': '💧',
    'walk': '🚶',
    'exercise': '🏃',
    'food': '🍽️',
    'mood': '😊',
    'patient_conditions': '📝',
    'sleep': '😴'
  };
  return icons[type] || '📋';
}

function getActivityTypeName(type) {
  const names = {
    'medication': 'กินยา',
    'blood_pressure': 'วัดความดัน',
    'water': 'ดื่มน้ำ',
    'walk': 'เดิน',
    'exercise': 'ออกกำลังกาย',
    'food': 'อาหาร',
    'mood': 'อารมณ์',
    'patient_conditions': 'บันทึกอาการ',
    'sleep': 'นอนหลับ'
  };
  return names[type] || type;
}

// ========================================
// Export Functions
// ========================================

async function exportCSV() {
  if (!currentPatientId) {
    showError('กรุณาเลือกผู้ป่วยก่อน');
    return;
  }

  try {
    showLoading('กำลังสร้างไฟล์ CSV...');

    const url = `${REPORTS_API_URL}/export/csv?patientId=${currentPatientId}&from=${dateFrom}&to=${dateTo}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-liff-access-token': liffAccessToken
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to export CSV');
    }

    // Get CSV content and download
    const csvContent = await response.text();
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const filename = `health-report-${dateFrom}-to-${dateTo}.csv`;

    downloadBlob(blob, filename);
    hideLoading();
    showSuccess('ดาวน์โหลด CSV สำเร็จ');

  } catch (error) {
    console.error('Error exporting CSV:', error);
    hideLoading();
    showError('ไม่สามารถสร้างไฟล์ CSV ได้: ' + error.message);
  }
}

async function exportPDF() {
  if (!currentPatientId || !reportData) {
    showError('กรุณาเลือกผู้ป่วยและโหลดรายงานก่อน');
    return;
  }

  try {
    showLoading('กำลังสร้างไฟล์ PDF...');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Thai font support would need to be added for production
    // For now, use basic Latin characters

    const { patient, period, summary } = reportData;

    // Title
    pdf.setFontSize(20);
    pdf.text('Health Report', 20, 20);

    pdf.setFontSize(12);
    pdf.text(`Patient: ${patient.name}`, 20, 35);
    pdf.text(`Period: ${period.from} to ${period.to}`, 20, 42);
    pdf.text(`Generated: ${new Date().toISOString().split('T')[0]}`, 20, 49);

    // Summary
    pdf.setFontSize(14);
    pdf.text('Summary', 20, 65);

    pdf.setFontSize(11);
    let y = 75;

    if (summary.bloodPressure.avgSystolic) {
      pdf.text(`Blood Pressure (avg): ${summary.bloodPressure.avgSystolic}/${summary.bloodPressure.avgDiastolic} mmHg`, 20, y);
      y += 7;
    }

    if (summary.medications.compliancePercent !== null) {
      pdf.text(`Medication Compliance: ${summary.medications.compliancePercent}% (${summary.medications.totalTaken}/${summary.medications.totalScheduled})`, 20, y);
      y += 7;
    }

    if (summary.water.avgDailyMl > 0) {
      pdf.text(`Water Intake (avg): ${summary.water.avgDailyMl} ml/day`, 20, y);
      y += 7;
    }

    pdf.text(`Activities: ${summary.activities.totalCount} total, ${summary.activities.exerciseMinutes} min exercise`, 20, y);
    y += 15;

    // Capture charts as images
    const chartsSection = document.getElementById('charts-section');
    if (chartsSection) {
      const canvas = await html2canvas(chartsSection, {
        scale: 2,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 170;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
    }

    // Disclaimer
    pdf.setFontSize(9);
    pdf.text('This report is for informational purposes only.', 20, 280);
    pdf.text('Please consult a healthcare professional for diagnosis and treatment.', 20, 285);

    // Save
    const filename = `health-report-${patient.name}-${dateFrom}-to-${dateTo}.pdf`;
    pdf.save(filename);

    hideLoading();
    showSuccess('ดาวน์โหลด PDF สำเร็จ');

  } catch (error) {
    console.error('Error exporting PDF:', error);
    hideLoading();
    showError('ไม่สามารถสร้างไฟล์ PDF ได้: ' + error.message);
  }
}

// ========================================
// Utility Functions
// ========================================

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatNumber(num) {
  return num.toLocaleString('th-TH');
}

function getBPStatusText(status) {
  const statusMap = {
    normal: 'ปกติ',
    elevated: 'สูงเล็กน้อย',
    high: 'ความดันสูง',
    crisis: 'วิกฤต'
  };
  return statusMap[status] || status;
}

function showLoading(text = 'กำลังโหลด...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
  // Create error element if not exists
  let errorEl = document.querySelector('.error-message');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    document.querySelector('.container').insertBefore(errorEl, document.querySelector('.header').nextSibling);
  }
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');

  // Auto hide after 5 seconds
  setTimeout(() => {
    errorEl.classList.add('hidden');
  }, 5000);
}

function showSuccess(message) {
  // Simple alert for now
  alert(message);
}

function closeLiff() {
  if (typeof liff !== 'undefined' && liff.isInClient()) {
    liff.closeWindow();
  } else {
    window.history.back();
  }
}
