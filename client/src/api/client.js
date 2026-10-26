const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem('mealrelay_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.code = data?.error?.code;
      error.details = data?.error?.details;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const connError = new Error('Could not connect to MealRelay server. Please verify the backend is running.');
      connError.status = 0;
      throw connError;
    }
    throw err;
  }
}

export const api = {
  // Auth
  register: (userData) => apiRequest('/auth/register', { method: 'POST', body: userData }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  getMe: () => apiRequest('/auth/me', { method: 'GET' }),

  // Donations
  getDonations: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const queryStr = searchParams.toString();
    return apiRequest(`/donations${queryStr ? `?${queryStr}` : ''}`, { method: 'GET' });
  },
  getDonationById: (id) => apiRequest(`/donations/${id}`, { method: 'GET' }),
  createDonation: (donationData) => apiRequest('/donations', { method: 'POST', body: donationData }),
  updateDonation: (id, updateData) => apiRequest(`/donations/${id}`, { method: 'PATCH', body: updateData }),

  // Health
  checkHealth: () => apiRequest('/health', { method: 'GET' })
};
