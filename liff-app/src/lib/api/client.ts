// API Client - ported from public/liff/js/api.js

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
  }
  return '/api';
};

const API_BASE_URL = getBaseUrl();

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
}

interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { params, ...fetchConfig } = config;

  let url = `${API_BASE_URL}${endpoint}`;

  // Add query params if provided
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  console.log(`[API] ${config.method || 'GET'} ${url}`);

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...fetchConfig,
    headers: {
      ...defaultHeaders,
      ...fetchConfig.headers,
    },
  });

  const data = await response.json();

  console.log(`[API] Response ${response.status}:`, data);

  if (!response.ok) {
    // Backend returns { error: '...' } not { message: '...' }
    const errorMessage = data.message || data.error || 'API request failed';
    console.error(`[API] Error: ${errorMessage}`);
    const error: ApiError = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const apiClient = {
  get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return request<T>(endpoint, { method: 'GET', params });
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' });
  },
};

// API Endpoints
export const endpoints = {
  registration: {
    check: '/registration/check',
    patient: '/registration/patient',
    caregiver: '/registration/caregiver',
    quickRegister: '/quick-register',
    generateLinkCode: '/registration/generate-link-code',
    linkPatient: '/registration/link-patient',
    getPatient: (id: string) => `/registration/patient/${id}`,
    getCaregiver: (id: string) => `/registration/caregiver/${id}`,
    getCaregiverPatients: (id: string) => `/registration/caregiver/${id}/patients`,
    getPatientCaregivers: (id: string) => `/registration/patient/${id}/caregivers`,
  },
  groups: {
    check: '/groups/check',
  },
  health: {
    vitals: '/health/vitals',
    medications: '/health/medications',
    symptoms: '/health/symptoms',
    water: '/health/water',
    sleep: '/health/sleep',
    exercise: '/health/exercise',
  },
};

// Registration API Types
export interface RegistrationCheckResponse {
  exists: boolean;
  role?: 'patient' | 'caregiver';
  profile?: {
    id: string;
    user_id?: string;
    first_name?: string;
    last_name?: string;
    linked_patient_id?: string; // For caregivers: the patient they're linked to
  };
}

export interface GroupCheckResponse {
  exists: boolean;
  group?: {
    id: string;
    group_name?: string;
    active_patient_id?: string;
  };
}

export interface QuickRegisterRequest {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage?: string;
  contextType: 'utou' | 'group';
  groupId: string | null;
  caregiver: {
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    relationship: string;
  };
  patient: {
    firstName: string;
    lastName: string;
    birthDate: string;
    medicalCondition: string | null;
  };
}

export interface QuickRegisterResponse {
  success: boolean;
  caregiverId: string;
  patientId: string;
  groupId?: string;
}

export interface LinkCodeResponse {
  code: string;
  expires_at: string;
}

// Registration API Helper Functions
export const registrationApi = {
  async checkUser(lineUserId: string): Promise<RegistrationCheckResponse> {
    return apiClient.post(endpoints.registration.check, { line_user_id: lineUserId });
  },

  async checkGroup(lineGroupId: string): Promise<GroupCheckResponse> {
    return apiClient.post(endpoints.groups.check, { line_group_id: lineGroupId });
  },

  async quickRegister(data: QuickRegisterRequest): Promise<QuickRegisterResponse> {
    return apiClient.post(endpoints.registration.quickRegister, data);
  },

  async generateLinkCode(patientId: string): Promise<LinkCodeResponse> {
    return apiClient.post(endpoints.registration.generateLinkCode, { patient_id: patientId });
  },

  /**
   * Auto-create patient profile for health recording
   * Creates minimal profile if user doesn't have one yet
   */
  async autoCreatePatient(lineUserId: string, displayName: string, pictureUrl?: string): Promise<{ success: boolean; patientId: string; isNew: boolean }> {
    return apiClient.post('/registration/auto-create', {
      line_user_id: lineUserId,
      display_name: displayName,
      picture_url: pictureUrl,
    });
  },
};
