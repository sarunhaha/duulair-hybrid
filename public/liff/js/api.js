// ========================================
// API Wrapper
// ========================================

// API Base URL (auto-detect production/development)
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : 'https://app.oonj.ai/api';

/**
 * API Client
 */
const api = {
  /**
   * Generic API call
   * @param {string} endpoint
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async call(endpoint, options = {}) {
    try {
      const url = `${API_BASE_URL}${endpoint}`;

      const config = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      };

      if (options.body) {
        config.body = JSON.stringify(options.body);
      }

      console.log(`📡 API Call: ${config.method} ${url}`, options.body);

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      console.log(`✅ API Response:`, data);
      return data;

    } catch (error) {
      console.error(`❌ API Error:`, error);
      throw error;
    }
  },

  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.call(url, { method: 'GET' });
  },

  /**
   * POST request
   */
  async post(endpoint, body) {
    return this.call(endpoint, {
      method: 'POST',
      body
    });
  },

  /**
   * PUT request
   */
  async put(endpoint, body) {
    return this.call(endpoint, {
      method: 'PUT',
      body
    });
  },

  /**
   * DELETE request
   */
  async delete(endpoint) {
    return this.call(endpoint, {
      method: 'DELETE'
    });
  },

  // ========================================
  // Registration API
  // ========================================

  /**
   * Check if user is registered
   * @param {string} lineUserId
   * @returns {Promise<Object>}
   */
  async checkRegistration(lineUserId) {
    return this.post('/registration/check', {
      line_user_id: lineUserId
    });
  },

  /**
   * Register patient
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async registerPatient(data) {
    return this.post('/registration/patient', data);
  },

  /**
   * Register caregiver
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async registerCaregiver(data) {
    return this.post('/registration/caregiver', data);
  },

  /**
   * Generate link code
   * @param {string} patientId
   * @returns {Promise<Object>}
   */
  async generateLinkCode(patientId) {
    return this.post('/registration/generate-link-code', {
      patient_id: patientId
    });
  },

  /**
   * Link caregiver to patient
   * @param {string} caregiverId
   * @param {string} linkCode
   * @param {string} relationship
   * @returns {Promise<Object>}
   */
  async linkPatient(caregiverId, linkCode, relationship) {
    return this.post('/registration/link-patient', {
      caregiver_id: caregiverId,
      link_code: linkCode,
      relationship
    });
  },

  /**
   * Add medication to patient profile
   * @param {string} patientId
   * @param {Object} medication
   * @returns {Promise<Object>}
   */
  async addMedication(patientId, medication) {
    return this.post(`/registration/patient/${patientId}/medications`, medication);
  },

  /**
   * Get patient profile
   * @param {string} patientId
   * @returns {Promise<Object>}
   */
  async getPatientProfile(patientId) {
    return this.get(`/registration/patient/${patientId}`);
  },

  /**
   * Get caregiver profile
   * @param {string} caregiverId
   * @returns {Promise<Object>}
   */
  async getCaregiverProfile(caregiverId) {
    return this.get(`/registration/caregiver/${caregiverId}`);
  },

  /**
   * Get list of patients for a caregiver
   * @param {string} caregiverId
   * @returns {Promise<Object>}
   */
  async getCaregiverPatients(caregiverId) {
    return this.get(`/registration/caregiver/${caregiverId}/patients`);
  },

  /**
   * Get list of caregivers for a patient
   * @param {string} patientId
   * @returns {Promise<Object>}
   */
  async getPatientCaregivers(patientId) {
    return this.get(`/registration/patient/${patientId}/caregivers`);
  }
};
