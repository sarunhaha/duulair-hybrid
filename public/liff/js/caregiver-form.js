// ========================================
// Caregiver Registration Form Logic
// ========================================

// liffProfile is declared in liff-init.js - don't redeclare it here

// Form data
const formData = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  linkCode: '',
  relationship: ''
};

// ========================================
// Initialization
// ========================================

async function init() {
  try {
    // Initialize LIFF
    liffProfile = await initLiff();
    if (!liffProfile) return;

    // Check if user already registered
    const checkResult = await api.checkRegistration(liffProfile.userId);
    console.log('🔍 Registration check:', checkResult);

    if (checkResult.exists && checkResult.role === 'caregiver') {
      // User already registered as caregiver - hide personal info fields
      console.log('✅ User already registered - showing "Add Patient" mode');

      // Update UI for "Add Patient" mode
      document.getElementById('pageTitle').textContent = '➕ เพิ่มผู้ป่วย';
      document.getElementById('instructionText').textContent =
        'กรอกรหัสเชื่อมต่อที่ได้รับจากผู้ป่วยเพื่อเชื่อมต่อกับบัญชีของเขา';

      // Hide personal info card
      document.getElementById('personalInfoCard').style.display = 'none';

      // Pre-fill with existing data (in case validation needs it)
      formData.firstName = checkResult.profile.first_name || 'Existing';
      formData.lastName = checkResult.profile.last_name || 'User';
      formData.phoneNumber = checkResult.profile.phone_number || '';

      // Populate DOM elements for validation
      populateFormFromDraft();

      showSuccess('กรอกรหัสเชื่อมต่อเพื่อเพิ่มผู้ป่วย');

    } else if (checkResult.exists && checkResult.role === 'patient') {
      // User registered as patient - show error
      showError('คุณลงทะเบียนเป็นผู้ป่วยแล้ว ไม่สามารถเป็นผู้ดูแลได้');
      setTimeout(() => {
        window.location.href = '/liff/dashboard.html';
      }, 2000);
      return;

    } else {
      // New user - show full registration form
      console.log('📝 New user - showing full registration form');

      // Load draft if exists
      const draft = loadDraft('caregiver');
      if (draft) {
        Object.assign(formData, draft);
        populateFormFromDraft();
        showSuccess('โหลดข้อมูลที่กรอกไว้แล้ว');
      }
    }

    // Setup event listeners
    setupEventListeners();

  } catch (error) {
    console.error('❌ Initialization error:', error);
    showError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}

// ========================================
// Validation
// ========================================

function validateForm() {
  clearAllErrors();

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

  // Phone Number (optional)
  const phone = document.getElementById('phoneNumber');
  if (phone.value && !validatePhone(phone.value)) {
    showFieldError(phone, 'เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็น 0XXXXXXXXX)');
    isValid = false;
  }

  // Link Code
  const linkCode = document.getElementById('linkCode');
  if (!validateRequired(linkCode.value)) {
    showFieldError(linkCode, 'กรุณากรอกรหัสเชื่อมต่อ');
    isValid = false;
  } else if (!validateLinkCode(linkCode.value)) {
    showFieldError(linkCode, 'รหัสเชื่อมต่อต้องเป็นตัวเลข 6 หลัก');
    isValid = false;
  }

  // Relationship
  const relationship = document.getElementById('relationship');
  if (!validateRequired(relationship.value)) {
    showFieldError(relationship, 'กรุณาเลือกความสัมพันธ์');
    isValid = false;
  }

  return isValid;
}

// ========================================
// Form Data Management
// ========================================

function saveFormData() {
  formData.firstName = document.getElementById('firstName')?.value || '';
  formData.lastName = document.getElementById('lastName')?.value || '';
  formData.phoneNumber = document.getElementById('phoneNumber')?.value || '';
  formData.linkCode = document.getElementById('linkCode')?.value || '';
  formData.relationship = document.getElementById('relationship')?.value || '';
}

function populateFormFromDraft() {
  if (formData.firstName) document.getElementById('firstName').value = formData.firstName;
  if (formData.lastName) document.getElementById('lastName').value = formData.lastName;
  if (formData.phoneNumber) document.getElementById('phoneNumber').value = formData.phoneNumber;
  if (formData.linkCode) document.getElementById('linkCode').value = formData.linkCode;
  if (formData.relationship) document.getElementById('relationship').value = formData.relationship;
}

// ========================================
// QR Code Scanner
// ========================================

async function scanQRCode() {
  if (!liff.isInClient()) {
    showError('การสแกน QR Code ใช้ได้เฉพาะใน LINE เท่านั้น');
    return;
  }

  try {
    // Open QR code scanner
    const result = await liff.scanCodeV2();

    if (result && result.value) {
      // Extract link code from QR code value
      // Expected format: "DUULAIR:123456" or just "123456"
      let linkCode = result.value;

      if (linkCode.includes(':')) {
        linkCode = linkCode.split(':')[1];
      }

      // Validate and set
      if (validateLinkCode(linkCode)) {
        document.getElementById('linkCode').value = linkCode;
        showSuccess('สแกน QR Code สำเร็จ');
      } else {
        showError('QR Code ไม่ถูกต้อง');
      }
    }
  } catch (error) {
    console.error('QR scan error:', error);
    if (error.message !== 'CANCEL') {
      showError('ไม่สามารถสแกน QR Code ได้ กรุณากรอกรหัสด้วยตนเอง');
    }
  }
}

// ========================================
// Form Submission
// ========================================

async function submitForm() {
  try {
    // Validate form
    if (!validateForm()) {
      return;
    }

    // Save form data
    saveFormData();

    // Show loading
    showLoading('กำลังลงทะเบียน...');

    // Prepare data for API
    const requestData = {
      line_user_id: liffProfile.userId,
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone_number: formData.phoneNumber || null,
      link_code: formData.linkCode,
      relationship: formData.relationship
    };

    console.log('📤 Submitting caregiver data:', requestData);

    // ✅ Check if user already registered
    const checkResult = await api.checkRegistration(liffProfile.userId);
    console.log('🔍 Registration check:', checkResult);

    let caregiverId;

    if (checkResult.exists && checkResult.role === 'caregiver') {
      // User already registered as caregiver
      console.log('✅ User already registered, using existing profile');
      caregiverId = checkResult.profile.id;
    } else if (checkResult.exists && checkResult.role !== 'caregiver') {
      // User registered as different role
      throw new Error('คุณลงทะเบียนเป็น' + (checkResult.role === 'patient' ? 'ผู้ป่วย' : 'บทบาทอื่น') + 'แล้ว ไม่สามารถเป็นผู้ดูแลได้');
    } else {
      // New user - register caregiver
      console.log('📝 New user - registering caregiver');
      const registerResult = await api.registerCaregiver(requestData);
      console.log('✅ Caregiver registration successful:', registerResult);
      caregiverId = registerResult.data.id;
    }

    // Step 2: Link to patient
    const linkResult = await api.linkPatient(
      caregiverId,
      formData.linkCode,
      formData.relationship
    );

    console.log('✅ Patient link successful:', linkResult);

    // Clear draft
    clearDraft('caregiver');

    hideLoading();

    // Show success message based on whether user was already registered
    if (checkResult.exists) {
      showSuccess('เพิ่มผู้ป่วยสำเร็จ! รอผู้ป่วยอนุมัติการเชื่อมต่อ');
    } else {
      showSuccess('ลงทะเบียนสำเร็จ! รอผู้ป่วยอนุมัติการเชื่อมต่อ');
    }

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      window.location.href = '/liff/dashboard.html';
    }, 2000);

  } catch (error) {
    console.error('❌ Registration error:', error);
    hideLoading();

    // Check for specific error messages
    if (error.message.includes('Link code not found') || error.message.includes('invalid')) {
      showError('รหัสเชื่อมต่อไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    } else if (error.message.includes('already linked')) {
      showError('คุณได้เชื่อมต่อกับผู้ป่วยท่านนี้แล้ว');
    } else {
      showError(error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง');
    }
  }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // Clear errors on focus
  document.querySelectorAll('input, select').forEach(field => {
    field.addEventListener('focus', () => clearFieldError(field));
  });

  // Auto-save draft
  document.querySelectorAll('input, select').forEach(field => {
    field.addEventListener('change', () => {
      saveFormData();
      saveDraft('caregiver', formData);
    });
  });

  // Format link code input (remove non-digits)
  const linkCodeInput = document.getElementById('linkCode');
  if (linkCodeInput) {
    linkCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
  }
}

// ========================================
// Start
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
