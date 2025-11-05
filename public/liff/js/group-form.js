// ========================================
// Group Registration Form Logic (TASK-002)
// ========================================

let currentStep = 1;
const totalSteps = 4;

// Form data
const formData = {
  // Group info
  lineGroupId: '',
  groupName: '',

  // Caregiver info (Step 1)
  caregiver: {
    lineUserId: '',
    displayName: '',
    pictureUrl: '',
    firstName: '',
    lastName: '',
    phoneNumber: ''
  },

  // Patient basic info (Step 2)
  patient: {
    firstName: '',
    lastName: '',
    nickname: '',
    birthDate: '',
    gender: '',

    // Patient health info (Step 3)
    weightKg: null,
    heightCm: null,
    bloodType: '',
    chronicDiseases: [],
    drugAllergies: [],
    foodAllergies: [],

    // Patient contact info (Step 4)
    address: '',
    phoneNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: ''
  }
};

// ========================================
// Initialization
// ========================================

async function init() {
  try {
    console.log('🚀 Initializing group registration...');

    // Initialize LIFF
    liffProfile = await initLiff();
    if (!liffProfile) {
      showError('ไม่สามารถเชื่อมต่อกับ LINE ได้');
      return;
    }

    // Check if in group context
    const context = liff.getContext();
    console.log('📱 LIFF Context:', context);

    // For group registration, we need group context
    if (context.type !== 'group') {
      showError('กรุณาเปิดหน้านี้จากกลุ่ม LINE');
      return;
    }

    // Save group ID and context
    formData.lineGroupId = context.groupId;
    formData.groupName = ''; // Will be filled by user or use default

    // Pre-fill caregiver info from LIFF profile
    formData.caregiver.lineUserId = liffProfile.userId;
    formData.caregiver.displayName = liffProfile.displayName;
    formData.caregiver.pictureUrl = liffProfile.pictureUrl || '';

    console.log('✅ Group context detected:', formData.lineGroupId);

    // Check if group already registered
    await checkGroupRegistration();

    // Load draft if exists
    const draft = loadDraft('group');
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
    showError('เกิดข้อผิดพลาด: ' + error.message);
  }
}

// ========================================
// Check Group Registration
// ========================================

async function checkGroupRegistration() {
  try {
    console.log('🔍 Checking if group already registered...');

    const response = await fetch('/api/groups/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_group_id: formData.lineGroupId
      })
    });

    const result = await response.json();

    if (result.exists) {
      // Group already registered
      console.log('⚠️ Group already registered');
      showError('กลุ่มนี้ลงทะเบียนแล้ว กำลังพาคุณไปหน้าแดชบอร์ด...');

      setTimeout(() => {
        window.location.href = '/liff/group-dashboard.html';
      }, 2000);

      return true;
    }

    console.log('✅ Group not registered yet, proceed with registration');
    return false;

  } catch (error) {
    console.error('❌ Error checking group:', error);
    // Continue with registration even if check fails
    return false;
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
  saveDraft('group', formData);

  // Move to next step
  if (currentStep < totalSteps) {
    currentStep++;
    updateStepUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function prevStep() {
  // Save draft
  saveFormData();
  saveDraft('group', formData);

  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function updateStepUI() {
  // Hide all steps
  for (let i = 1; i <= totalSteps; i++) {
    const stepEl = document.getElementById(`step${i}`);
    const progressEl = document.getElementById(`progress-step-${i}`);

    if (stepEl) stepEl.classList.add('hidden');
    if (progressEl) progressEl.classList.remove('active');
  }

  // Show current step
  const currentStepEl = document.getElementById(`step${currentStep}`);
  const currentProgressEl = document.getElementById(`progress-step-${currentStep}`);

  if (currentStepEl) currentStepEl.classList.remove('hidden');
  if (currentProgressEl) currentProgressEl.classList.add('active');

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

// ========================================
// Form Validation
// ========================================

function validateStep(step) {
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
  // Validate caregiver info
  const firstName = document.getElementById('caregiverFirstName').value.trim();
  const lastName = document.getElementById('caregiverLastName').value.trim();

  if (!firstName) {
    showError('กรุณากรอกชื่อของคุณ');
    return false;
  }

  if (!lastName) {
    showError('กรุณากรอกนามสกุลของคุณ');
    return false;
  }

  return true;
}

function validateStep2() {
  // Validate patient basic info
  const firstName = document.getElementById('patientFirstName').value.trim();
  const lastName = document.getElementById('patientLastName').value.trim();
  const birthDate = document.getElementById('patientBirthDate').value;
  const gender = document.querySelector('input[name="patientGender"]:checked');

  if (!firstName) {
    showError('กรุณากรอกชื่อผู้ป่วย');
    return false;
  }

  if (!lastName) {
    showError('กรุณากรอกนามสกุลผู้ป่วย');
    return false;
  }

  if (!birthDate) {
    showError('กรุณาเลือกวันเกิดผู้ป่วย');
    return false;
  }

  // Validate birthdate is not in the future
  const birthDateObj = new Date(birthDate);
  const today = new Date();
  if (birthDateObj > today) {
    showError('วันเกิดไม่ถูกต้อง (อนาคต)');
    return false;
  }

  // Validate age is reasonable (not more than 120 years old)
  const age = today.getFullYear() - birthDateObj.getFullYear();
  if (age > 120) {
    showError('วันเกิดไม่ถูกต้อง (มากกว่า 120 ปี)');
    return false;
  }

  if (!gender) {
    showError('กรุณาเลือกเพศ');
    return false;
  }

  return true;
}

function validateStep3() {
  // Step 3 is optional, just validate data types if filled
  const weight = document.getElementById('patientWeightKg').value;
  const height = document.getElementById('patientHeightCm').value;

  if (weight && (weight < 20 || weight > 300)) {
    showError('น้ำหนักไม่ถูกต้อง (20-300 กก.)');
    return false;
  }

  if (height && (height < 50 || height > 250)) {
    showError('ส่วนสูงไม่ถูกต้อง (50-250 ซม.)');
    return false;
  }

  return true;
}

function validateStep4() {
  // Validate emergency contact (required)
  const emergencyName = document.getElementById('emergencyContactName').value.trim();
  const emergencyPhone = document.getElementById('emergencyContactPhone').value.trim();
  const emergencyRelation = document.getElementById('emergencyContactRelation').value;

  if (!emergencyName) {
    showError('กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน');
    return false;
  }

  if (!emergencyPhone) {
    showError('กรุณากรอกเบอร์โทรผู้ติดต่อฉุกเฉิน');
    return false;
  }

  if (!emergencyRelation) {
    showError('กรุณาเลือกความสัมพันธ์กับผู้ติดต่อฉุกเฉิน');
    return false;
  }

  return true;
}

// ========================================
// Save Form Data
// ========================================

function saveFormData() {
  // Step 1: Caregiver
  formData.caregiver.firstName = document.getElementById('caregiverFirstName').value.trim();
  formData.caregiver.lastName = document.getElementById('caregiverLastName').value.trim();
  formData.caregiver.phoneNumber = document.getElementById('caregiverPhoneNumber').value.trim();

  // Step 2: Patient basic
  formData.patient.firstName = document.getElementById('patientFirstName').value.trim();
  formData.patient.lastName = document.getElementById('patientLastName').value.trim();
  formData.patient.nickname = document.getElementById('patientNickname').value.trim();
  formData.patient.birthDate = document.getElementById('patientBirthDate').value;

  const gender = document.querySelector('input[name="patientGender"]:checked');
  formData.patient.gender = gender ? gender.value : '';

  // Step 3: Patient health
  const weight = document.getElementById('patientWeightKg').value;
  const height = document.getElementById('patientHeightCm').value;

  formData.patient.weightKg = weight ? parseFloat(weight) : null;
  formData.patient.heightCm = height ? parseFloat(height) : null;
  formData.patient.bloodType = document.getElementById('patientBloodType').value;

  // Chronic diseases
  formData.patient.chronicDiseases = [];
  document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
    if (cb.id.startsWith('disease-')) {
      formData.patient.chronicDiseases.push(cb.value);
    }
  });

  // Allergies
  const drugAllergies = document.getElementById('patientDrugAllergies').value.trim();
  formData.patient.drugAllergies = drugAllergies ? drugAllergies.split(',').map(s => s.trim()).filter(Boolean) : [];

  const foodAllergies = document.getElementById('patientFoodAllergies').value.trim();
  formData.patient.foodAllergies = foodAllergies ? foodAllergies.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Step 4: Contact & Emergency
  formData.patient.address = document.getElementById('patientAddress').value.trim();
  formData.patient.phoneNumber = document.getElementById('patientPhoneNumber').value.trim();
  formData.patient.emergencyContactName = document.getElementById('emergencyContactName').value.trim();
  formData.patient.emergencyContactPhone = document.getElementById('emergencyContactPhone').value.trim();
  formData.patient.emergencyContactRelation = document.getElementById('emergencyContactRelation').value;
}

// ========================================
// Populate Form from Draft
// ========================================

function populateFormFromDraft() {
  // Step 1: Caregiver
  if (formData.caregiver.firstName) {
    document.getElementById('caregiverFirstName').value = formData.caregiver.firstName;
  }
  if (formData.caregiver.lastName) {
    document.getElementById('caregiverLastName').value = formData.caregiver.lastName;
  }
  if (formData.caregiver.phoneNumber) {
    document.getElementById('caregiverPhoneNumber').value = formData.caregiver.phoneNumber;
  }

  // Step 2: Patient basic
  if (formData.patient.firstName) {
    document.getElementById('patientFirstName').value = formData.patient.firstName;
  }
  if (formData.patient.lastName) {
    document.getElementById('patientLastName').value = formData.patient.lastName;
  }
  if (formData.patient.nickname) {
    document.getElementById('patientNickname').value = formData.patient.nickname;
  }
  if (formData.patient.birthDate) {
    document.getElementById('patientBirthDate').value = formData.patient.birthDate;
  }
  if (formData.patient.gender) {
    const genderRadio = document.querySelector(`input[name="patientGender"][value="${formData.patient.gender}"]`);
    if (genderRadio) genderRadio.checked = true;
  }

  // Step 3: Patient health
  if (formData.patient.weightKg) {
    document.getElementById('patientWeightKg').value = formData.patient.weightKg;
  }
  if (formData.patient.heightCm) {
    document.getElementById('patientHeightCm').value = formData.patient.heightCm;
  }
  if (formData.patient.bloodType) {
    document.getElementById('patientBloodType').value = formData.patient.bloodType;
  }

  // Chronic diseases
  if (formData.patient.chronicDiseases && formData.patient.chronicDiseases.length > 0) {
    formData.patient.chronicDiseases.forEach(disease => {
      const checkbox = document.getElementById(`disease-${disease}`);
      if (checkbox) checkbox.checked = true;
    });
  }

  // Allergies
  if (formData.patient.drugAllergies && formData.patient.drugAllergies.length > 0) {
    document.getElementById('patientDrugAllergies').value = formData.patient.drugAllergies.join(', ');
  }
  if (formData.patient.foodAllergies && formData.patient.foodAllergies.length > 0) {
    document.getElementById('patientFoodAllergies').value = formData.patient.foodAllergies.join(', ');
  }

  // Step 4: Contact & Emergency
  if (formData.patient.address) {
    document.getElementById('patientAddress').value = formData.patient.address;
  }
  if (formData.patient.phoneNumber) {
    document.getElementById('patientPhoneNumber').value = formData.patient.phoneNumber;
  }
  if (formData.patient.emergencyContactName) {
    document.getElementById('emergencyContactName').value = formData.patient.emergencyContactName;
  }
  if (formData.patient.emergencyContactPhone) {
    document.getElementById('emergencyContactPhone').value = formData.patient.emergencyContactPhone;
  }
  if (formData.patient.emergencyContactRelation) {
    document.getElementById('emergencyContactRelation').value = formData.patient.emergencyContactRelation;
  }
}

// ========================================
// Form Submission
// ========================================

async function submitForm() {
  console.log('📤 Submitting group registration...');

  // Validate all steps
  saveFormData();

  for (let i = 1; i <= totalSteps; i++) {
    if (!validateStep(i)) {
      currentStep = i;
      updateStepUI();
      return;
    }
  }

  // Show loading
  showLoading('กำลังลงทะเบียน...');

  try {
    // Prepare request payload
    const payload = {
      lineGroupId: formData.lineGroupId,
      groupName: formData.groupName || `กลุ่มดูแล${formData.patient.firstName}`,
      caregiver: formData.caregiver,
      patient: formData.patient
    };

    console.log('📦 Payload:', payload);

    // Submit to API
    const response = await fetch('/api/groups/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    hideLoading();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'ลงทะเบียนไม่สำเร็จ');
    }

    console.log('✅ Registration successful:', result);

    // Clear draft
    clearDraft('group');

    // Show success message
    showSuccess('ลงทะเบียนสำเร็จ! กำลังพาคุณไปหน้าแดชบอร์ด...');

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      window.location.href = '/liff/group-dashboard.html';
    }, 2000);

  } catch (error) {
    console.error('❌ Registration error:', error);
    hideLoading();
    showError('เกิดข้อผิดพลาด: ' + error.message);
  }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // Auto-save on input change
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      saveFormData();
      saveDraft('group', formData);
    });
  });

  // Handle Enter key
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (currentStep < totalSteps) {
        nextStep();
      } else {
        submitForm();
      }
    }
  });
}

// ========================================
// Start when DOM is ready
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
