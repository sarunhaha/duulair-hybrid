// ========================================
// Utilities
// ========================================

// ========================================
// UI Helpers
// ========================================

/**
 * Show loading overlay
 * @param {string} message
 */
function showLoading(message = 'กำลังโหลด...') {
  let loading = document.getElementById('loading');

  if (!loading) {
    loading = document.createElement('div');
    loading.id = 'loading';
    loading.className = 'loading';
    loading.innerHTML = `
      <div class="spinner"></div>
      <div class="loading-text">${message}</div>
    `;
    document.body.appendChild(loading);
  } else {
    loading.querySelector('.loading-text').textContent = message;
    loading.classList.remove('hidden');
  }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
  }
}

/**
 * Show error message
 * @param {string} message
 * @param {Element} container - Container element (optional)
 */
function showError(message, container = null) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.textContent = message;

  if (container) {
    container.prepend(alert);
  } else {
    const main = document.querySelector('.container');
    if (main) main.prepend(alert);
  }

  // Auto remove after 5 seconds
  setTimeout(() => alert.remove(), 5000);
}

/**
 * Show success message
 * @param {string} message
 * @param {Element} container - Container element (optional)
 */
function showSuccess(message, container = null) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success';
  alert.textContent = message;

  if (container) {
    container.prepend(alert);
  } else {
    const main = document.querySelector('.container');
    if (main) main.prepend(alert);
  }

  // Auto remove after 5 seconds
  setTimeout(() => alert.remove(), 5000);
}

/**
 * Show field error
 * @param {Element} field
 * @param {string} message
 */
function showFieldError(field, message) {
  // Remove existing error
  clearFieldError(field);

  // Add error class
  field.classList.add('error');

  // Add error message
  const error = document.createElement('span');
  error.className = 'error-message';
  error.textContent = message;
  field.parentNode.appendChild(error);
}

/**
 * Clear field error
 * @param {Element} field
 */
function clearFieldError(field) {
  field.classList.remove('error');

  const error = field.parentNode.querySelector('.error-message');
  if (error) error.remove();
}

/**
 * Clear all errors in container
 * @param {Element} container
 */
function clearAllErrors(container = document) {
  const errors = container.querySelectorAll('.error-message');
  errors.forEach(error => error.remove());

  const errorFields = container.querySelectorAll('.error');
  errorFields.forEach(field => field.classList.remove('error'));
}

// ========================================
// Validation
// ========================================

/**
 * Validate required field
 * @param {*} value
 * @returns {boolean}
 */
function validateRequired(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

/**
 * Validate Thai/English name
 * @param {string} value
 * @returns {boolean}
 */
function validateName(value) {
  if (!value) return false;
  // Allow Thai and English characters
  const nameRegex = /^[a-zA-Zก-๙\s]+$/;
  return nameRegex.test(value) && value.length <= 100;
}

/**
 * Validate birth date (age 18-120)
 * @param {string} dateString - YYYY-MM-DD
 * @returns {boolean}
 */
function validateBirthDate(dateString) {
  if (!dateString) return false;

  const birthDate = new Date(dateString);
  const today = new Date();

  // Check if valid date
  if (isNaN(birthDate.getTime())) return false;

  // Check if in the past
  if (birthDate >= today) return false;

  // Calculate age
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 18 && age <= 120;
}

/**
 * Validate phone number (Thai format)
 * @param {string} phone
 * @returns {boolean}
 */
function validatePhone(phone) {
  if (!phone) return true; // Optional field

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Thai phone: 0XXXXXXXXX (10 digits)
  return digits.length === 10 && digits.startsWith('0');
}

/**
 * Validate weight (20-300 kg)
 * @param {number} weight
 * @returns {boolean}
 */
function validateWeight(weight) {
  if (!weight) return true; // Optional
  return weight >= 20 && weight <= 300;
}

/**
 * Validate height (50-250 cm)
 * @param {number} height
 * @returns {boolean}
 */
function validateHeight(height) {
  if (!height) return true; // Optional
  return height >= 50 && height <= 250;
}

/**
 * Validate link code (6 digits)
 * @param {string} code
 * @returns {boolean}
 */
function validateLinkCode(code) {
  if (!code) return false;
  return /^\d{6}$/.test(code);
}

/**
 * Validate email
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  if (!email) return true; // Optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ========================================
// localStorage Helpers
// ========================================

/**
 * Save form data to localStorage (draft)
 * @param {string} key
 * @param {Object} data
 */
function saveDraft(key, data) {
  try {
    localStorage.setItem(`oonjai_draft_${key}`, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
}

/**
 * Load form data from localStorage
 * @param {string} key
 * @returns {Object|null}
 */
function loadDraft(key) {
  try {
    const data = localStorage.getItem(`oonjai_draft_${key}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
}

/**
 * Clear draft from localStorage
 * @param {string} key
 */
function clearDraft(key) {
  try {
    localStorage.removeItem(`oonjai_draft_${key}`);
  } catch (error) {
    console.error('Error clearing draft:', error);
  }
}

/**
 * Save user data to localStorage
 * @param {Object} data
 */
function saveUserData(data) {
  try {
    localStorage.setItem('oonjai_user', JSON.stringify(data));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

/**
 * Load user data from localStorage
 * @returns {Object|null}
 */
function loadUserData() {
  try {
    const data = localStorage.getItem('oonjai_user');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading user data:', error);
    return null;
  }
}

/**
 * Clear user data from localStorage
 */
function clearUserData() {
  try {
    localStorage.removeItem('oonjai_user');
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
}

// ========================================
// Formatting
// ========================================

/**
 * Format phone number
 * @param {string} phone
 * @returns {string}
 */
function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Format date to Thai format
 * @param {Date|string} date
 * @returns {string}
 */
function formatDateThai(date) {
  const d = new Date(date);
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return d.toLocaleDateString('th-TH', options);
}

/**
 * Calculate age from birth date
 * @param {string} dateString - YYYY-MM-DD
 * @returns {number}
 */
function calculateAge(dateString) {
  const birthDate = new Date(dateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

// ========================================
// QR Code Generation
// ========================================

/**
 * Generate QR code using Google Charts API
 * @param {string} data - Data to encode
 * @param {number} size - Size in pixels (default 250)
 * @returns {string} - Image URL
 */
function generateQRCode(data, size = 250) {
  const encoded = encodeURIComponent(data);
  return `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}`;
}

// ========================================
// Array Helpers
// ========================================

/**
 * Toggle item in array
 * @param {Array} array
 * @param {*} item
 * @returns {Array}
 */
function toggleArrayItem(array, item) {
  const index = array.indexOf(item);
  if (index > -1) {
    array.splice(index, 1);
  } else {
    array.push(item);
  }
  return array;
}

/**
 * Get unique ID
 * @returns {string}
 */
function getUniqueId() {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========================================
// First-Time User Detection
// ========================================

/**
 * Check if user is registered and redirect to registration if not
 * Call this function after LIFF init in pages that require registration
 * @param {string} lineUserId - LINE user ID from LIFF profile
 * @param {string} apiBaseUrl - API base URL (default: https://app.oonj.ai/api)
 * @returns {Promise<boolean>} - Returns true if user is registered, false otherwise
 */
async function checkUserRegistration(lineUserId, apiBaseUrl = 'https://app.oonj.ai/api') {
  try {
    const response = await fetch(`${apiBaseUrl}/check-user?lineUserId=${encodeURIComponent(lineUserId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to check user registration:', response.status);
      return false;
    }

    const result = await response.json();

    // If user is not registered, redirect to registration page
    if (!result.isRegistered) {
      console.log('User not registered, redirecting to registration page...');

      // Use LIFF URL if in LINE client, otherwise use relative path
      if (typeof liff !== 'undefined' && liff.isInClient()) {
        window.location.href = 'https://liff.line.me/2008278683-5k69jxNq/group-registration.html';
      } else {
        window.location.href = '/liff/group-registration.html';
      }

      return false;
    }

    return true;

  } catch (error) {
    console.error('Error checking user registration:', error);
    // In case of error, allow user to continue (fail open)
    // This prevents blocking users if API is down
    return true;
  }
}

/**
 * Initialize LIFF with first-time user detection
 * This is a wrapper function that combines LIFF init and user registration check
 * @param {string} liffId - LIFF ID
 * @param {Function} onSuccess - Callback function to run after successful init and registration check
 * @param {string} apiBaseUrl - API base URL (optional)
 * @returns {Promise<void>}
 */
async function initLiffWithRegistrationCheck(liffId, onSuccess, apiBaseUrl = 'https://app.oonj.ai/api') {
  try {
    // Initialize LIFF
    await liff.init({ liffId: liffId });

    // Check if logged in
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    // Get user profile
    const profile = await liff.getProfile();

    // Check if user is registered
    const isRegistered = await checkUserRegistration(profile.userId, apiBaseUrl);

    // If registered, run success callback
    if (isRegistered && onSuccess) {
      onSuccess(profile);
    }

  } catch (error) {
    console.error('LIFF initialization failed:', error);
    throw error;
  }
}
