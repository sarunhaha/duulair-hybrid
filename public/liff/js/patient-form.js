// ========================================
// Patient Registration Form Logic
// ========================================

let liffProfile = null;
let currentStep = 1;
const totalSteps = 4;

// Form data
const formData = {
  // Step 1: ข้อมูลพื้นฐาน
  firstName: '',
  lastName: '',
  nickname: '',
  birthDate: '',
  gender: '',

  // Step 2: ข้อมูลสุขภาพ
  weightKg: null,
  heightCm: null,
  bloodType: '',
  chronicDiseases: [],
  drugAllergies: [],
  foodAllergies: [],

  // Step 3: ยาที่กินประจำ
  medications: [],

  // Step 4: ข้อมูลติดต่อฉุกเฉิน
  address: '',
  phoneNumber: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: ''
};

// ========================================
// Initialization
// ========================================

async function init() {
  try {
    // Initialize LIFF
    liffProfile = await initLiff();
    if (!liffProfile) return;

    // Load draft if exists
    const draft = loadDraft('patient');
    if (draft) {
      Object.assign(formData, draft);
      populateFormFromDraft();
      showSuccess('โหลดข้อมูลที่กรอกไว้แล้ว');
    }

    // Setup event listeners
    setupEventListeners();

    // Update step UI
    updateStepUI();

  } catch (error) {
    console.error('❌ Initialization error:', error);
    showError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}

// ========================================
// Step Navigation
// ========================================

function nextStep() {
  // Validate current step
  if (!validateStep(currentStep)) {
    return;
  }

  // Save draft
  saveFormData();
  saveDraft('patient', formData);

  // Go to next step
  if (currentStep < totalSteps) {
    currentStep++;
    updateStepUI();
    window.scrollTo(0, 0);
  }
}

function prevStep() {
  if (currentStep > 1) {
    // Save draft
    saveFormData();
    saveDraft('patient', formData);

    currentStep--;
    updateStepUI();
    window.scrollTo(0, 0);
  }
}

function updateStepUI() {
  // Hide all steps
  for (let i = 1; i <= totalSteps; i++) {
    const stepEl = document.getElementById(`step${i}`);
    if (stepEl) {
      stepEl.classList.add('hidden');
    }
  }

  // Show current step
  const currentStepEl = document.getElementById(`step${currentStep}`);
  if (currentStepEl) {
    currentStepEl.classList.remove('hidden');
  }

  // Update progress
  updateProgressBar();

  // Update buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');

  if (prevBtn) {
    prevBtn.classList.toggle('hidden', currentStep === 1);
  }

  if (nextBtn) {
    nextBtn.classList.toggle('hidden', currentStep === totalSteps);
  }

  if (submitBtn) {
    submitBtn.classList.toggle('hidden', currentStep !== totalSteps);
  }
}

function updateProgressBar() {
  for (let i = 1; i <= totalSteps; i++) {
    const stepEl = document.getElementById(`progress-step-${i}`);
    if (stepEl) {
      stepEl.classList.toggle('active', i === currentStep);
      stepEl.classList.toggle('completed', i < currentStep);
    }
  }
}

// ========================================
// Validation
// ========================================

function validateStep(step) {
  clearAllErrors();

  switch (step) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return validateStep4();
    default:
      return true;
  }
}

function validateStep1() {
  let isValid = true;

  // First Name
  const firstName = document.getElementById('firstName');
  if (!validateRequired(firstName.value)) {
    showFieldError(firstName, 'กรุณากรอกชื่อ');
    isValid = false;
  } else if (!validateName(firstName.value)) {
    showFieldError(firstName, 'ชื่อไม่ถูกต้อง (ใช้ได้เฉพาะภาษาไทยหรืออังกฤษ)');
    isValid = false;
  }

  // Last Name
  const lastName = document.getElementById('lastName');
  if (!validateRequired(lastName.value)) {
    showFieldError(lastName, 'กรุณากรอกนามสกุล');
    isValid = false;
  } else if (!validateName(lastName.value)) {
    showFieldError(lastName, 'นามสกุลไม่ถูกต้อง (ใช้ได้เฉพาะภาษาไทยหรืออังกฤษ)');
    isValid = false;
  }

  // Birth Date
  const birthDate = document.getElementById('birthDate');
  if (!validateRequired(birthDate.value)) {
    showFieldError(birthDate, 'กรุณาเลือกวันเกิด');
    isValid = false;
  } else if (!validateBirthDate(birthDate.value)) {
    showFieldError(birthDate, 'วันเกิดไม่ถูกต้อง (อายุ 18-120 ปี)');
    isValid = false;
  }

  // Gender
  const gender = document.querySelector('input[name="gender"]:checked');
  if (!gender) {
    showError('กรุณาเลือกเพศ');
    isValid = false;
  }

  return isValid;
}

function validateStep2() {
  let isValid = true;

  // Weight (optional but if filled, must be valid)
  const weight = document.getElementById('weightKg');
  if (weight.value && !validateWeight(parseFloat(weight.value))) {
    showFieldError(weight, 'น้ำหนักไม่ถูกต้อง (20-300 กก.)');
    isValid = false;
  }

  // Height (optional but if filled, must be valid)
  const height = document.getElementById('heightCm');
  if (height.value && !validateHeight(parseFloat(height.value))) {
    showFieldError(height, 'ส่วนสูงไม่ถูกต้อง (50-250 ซม.)');
    isValid = false;
  }

  return isValid;
}

function validateStep3() {
  // Medications are optional
  return true;
}

function validateStep4() {
  let isValid = true;

  // Phone Number (optional)
  const phone = document.getElementById('phoneNumber');
  if (phone.value && !validatePhone(phone.value)) {
    showFieldError(phone, 'เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็น 0XXXXXXXXX)');
    isValid = false;
  }

  // Emergency Contact Name
  const emergencyName = document.getElementById('emergencyContactName');
  if (!validateRequired(emergencyName.value)) {
    showFieldError(emergencyName, 'กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน');
    isValid = false;
  }

  // Emergency Contact Phone
  const emergencyPhone = document.getElementById('emergencyContactPhone');
  if (!validateRequired(emergencyPhone.value)) {
    showFieldError(emergencyPhone, 'กรุณากรอกเบอร์โทรผู้ติดต่อฉุกเฉิน');
    isValid = false;
  } else if (!validatePhone(emergencyPhone.value)) {
    showFieldError(emergencyPhone, 'เบอร์โทรศัพท์ไม่ถูกต้อง');
    isValid = false;
  }

  // Emergency Contact Relation
  const emergencyRelation = document.getElementById('emergencyContactRelation');
  if (!validateRequired(emergencyRelation.value)) {
    showFieldError(emergencyRelation, 'กรุณาระบุความสัมพันธ์');
    isValid = false;
  }

  return isValid;
}

// ========================================
// Form Data Management
// ========================================

function saveFormData() {
  // Step 1
  formData.firstName = document.getElementById('firstName')?.value || '';
  formData.lastName = document.getElementById('lastName')?.value || '';
  formData.nickname = document.getElementById('nickname')?.value || '';
  formData.birthDate = document.getElementById('birthDate')?.value || '';
  const gender = document.querySelector('input[name="gender"]:checked');
  formData.gender = gender?.value || '';

  // Step 2
  formData.weightKg = document.getElementById('weightKg')?.value ? parseFloat(document.getElementById('weightKg').value) : null;
  formData.heightCm = document.getElementById('heightCm')?.value ? parseFloat(document.getElementById('heightCm').value) : null;
  formData.bloodType = document.getElementById('bloodType')?.value || '';

  // Chronic Diseases (checkboxes)
  const chronicDiseases = [];
  document.querySelectorAll('input[name="chronicDiseases"]:checked').forEach(cb => {
    chronicDiseases.push(cb.value);
  });
  formData.chronicDiseases = chronicDiseases;

  formData.drugAllergies = document.getElementById('drugAllergies')?.value.split(',').map(s => s.trim()).filter(Boolean) || [];
  formData.foodAllergies = document.getElementById('foodAllergies')?.value.split(',').map(s => s.trim()).filter(Boolean) || [];

  // Step 3 - medications already managed by add/remove functions

  // Step 4
  formData.address = document.getElementById('address')?.value || '';
  formData.phoneNumber = document.getElementById('phoneNumber')?.value || '';
  formData.emergencyContactName = document.getElementById('emergencyContactName')?.value || '';
  formData.emergencyContactPhone = document.getElementById('emergencyContactPhone')?.value || '';
  formData.emergencyContactRelation = document.getElementById('emergencyContactRelation')?.value || '';
}

function populateFormFromDraft() {
  // Step 1
  if (formData.firstName) document.getElementById('firstName').value = formData.firstName;
  if (formData.lastName) document.getElementById('lastName').value = formData.lastName;
  if (formData.nickname) document.getElementById('nickname').value = formData.nickname;
  if (formData.birthDate) document.getElementById('birthDate').value = formData.birthDate;
  if (formData.gender) {
    const genderRadio = document.querySelector(`input[name="gender"][value="${formData.gender}"]`);
    if (genderRadio) genderRadio.checked = true;
  }

  // Step 2
  if (formData.weightKg) document.getElementById('weightKg').value = formData.weightKg;
  if (formData.heightCm) document.getElementById('heightCm').value = formData.heightCm;
  if (formData.bloodType) document.getElementById('bloodType').value = formData.bloodType;

  // Chronic diseases
  formData.chronicDiseases.forEach(disease => {
    const checkbox = document.querySelector(`input[name="chronicDiseases"][value="${disease}"]`);
    if (checkbox) checkbox.checked = true;
  });

  if (formData.drugAllergies.length) document.getElementById('drugAllergies').value = formData.drugAllergies.join(', ');
  if (formData.foodAllergies.length) document.getElementById('foodAllergies').value = formData.foodAllergies.join(', ');

  // Step 3
  renderMedicationList();

  // Step 4
  if (formData.address) document.getElementById('address').value = formData.address;
  if (formData.phoneNumber) document.getElementById('phoneNumber').value = formData.phoneNumber;
  if (formData.emergencyContactName) document.getElementById('emergencyContactName').value = formData.emergencyContactName;
  if (formData.emergencyContactPhone) document.getElementById('emergencyContactPhone').value = formData.emergencyContactPhone;
  if (formData.emergencyContactRelation) document.getElementById('emergencyContactRelation').value = formData.emergencyContactRelation;
}

// ========================================
// Medication Management
// ========================================

function addMedication() {
  const name = document.getElementById('medName').value.trim();
  const dosage = document.getElementById('medDosage').value.trim();

  // Get selected frequencies
  const frequencies = [];
  document.querySelectorAll('input[name="medFrequency"]:checked').forEach(cb => {
    frequencies.push(cb.value);
  });

  if (!name) {
    showError('กรุณากรอกชื่อยา');
    return;
  }

  if (frequencies.length === 0) {
    showError('กรุณาเลือกเวลาที่กินยา');
    return;
  }

  // Add to formData
  formData.medications.push({
    id: getUniqueId(),
    name,
    dosage,
    frequency: frequencies
  });

  // Clear form
  document.getElementById('medName').value = '';
  document.getElementById('medDosage').value = '';
  document.querySelectorAll('input[name="medFrequency"]:checked').forEach(cb => cb.checked = false);

  // Re-render list
  renderMedicationList();

  showSuccess('เพิ่มยาเรียบร้อย');
}

function removeMedication(id) {
  formData.medications = formData.medications.filter(med => med.id !== id);
  renderMedicationList();
}

function renderMedicationList() {
  const listEl = document.getElementById('medicationList');
  if (!listEl) return;

  if (formData.medications.length === 0) {
    listEl.innerHTML = '<p class="text-center text-small" style="color: #999;">ยังไม่มียาที่เพิ่ม</p>';
    return;
  }

  listEl.innerHTML = formData.medications.map(med => {
    const freqText = med.frequency.map(f => {
      const labels = {
        morning: 'เช้า',
        noon: 'เที่ยง',
        evening: 'เย็น',
        night: 'ก่อนนอน'
      };
      return labels[f] || f;
    }).join(', ');

    return `
      <div class="medication-item">
        <div class="medication-info">
          <div class="medication-name">${med.name}</div>
          <div class="medication-details">
            ${med.dosage ? `ขนาด: ${med.dosage} | ` : ''}
            กินตอน: ${freqText}
          </div>
        </div>
        <button class="btn btn-remove" onclick="removeMedication('${med.id}')">ลบ</button>
      </div>
    `;
  }).join('');
}

// ========================================
// Form Submission
// ========================================

async function submitForm() {
  try {
    // Validate final step
    if (!validateStep(currentStep)) {
      return;
    }

    // Save form data
    saveFormData();

    // Show loading
    showLoading('กำลังลงทะเบียน...');

    // Prepare data for API
    const requestData = {
      line_user_id: liffProfile.userId,
      ...formData
    };

    console.log('📤 Submitting patient data:', requestData);

    // Call API
    const result = await api.registerPatient(requestData);

    console.log('✅ Registration successful:', result);

    // Clear draft
    clearDraft('patient');

    hideLoading();

    // Redirect to success page (use absolute path from root)
    window.location.href = `/liff/success.html?patient_id=${result.profile.id}`;

  } catch (error) {
    console.error('❌ Registration error:', error);
    hideLoading();
    showError(error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง');
  }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // Clear errors on focus
  document.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('focus', () => clearFieldError(field));
  });
}

// ========================================
// Start
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
