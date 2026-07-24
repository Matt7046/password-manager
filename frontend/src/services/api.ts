const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export interface PasswordEntry {
  id: string;
  account_name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const api = {
  // Auth endpoints
  checkSetup: async () => {
    const response = await fetch(`${API_URL}/auth/check`);
    return response.json();
  },

  setupMasterPassword: async (email: string, masterPassword: string) => {
    const response = await fetch(`${API_URL}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, master_password: masterPassword })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Setup failed');
    }
    return response.json();
  },

  forgotPassword: async (email: string) => {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to send OTP');
    }
    return response.json();
  },

  verifyOTPReset: async (email: string, otpCode: string, newMasterPassword: string) => {
    const response = await fetch(`${API_URL}/auth/verify-otp-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp_code: otpCode,
        new_master_password: newMasterPassword
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'OTP verification failed');
    }
    return response.json();
  },

  login: async (email: string, masterPassword: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, master_password: masterPassword })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    return response.json();
  },

  resetAllData: async () => {
    const response = await fetch(`${API_URL}/auth/reset`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Reset failed');
    }
    return response.json();
  },

  // Password entries endpoints
  getAllPasswords: async (masterPassword: string): Promise<PasswordEntry[]> => {
    const response = await fetch(`${API_URL}/passwords?master_password=${encodeURIComponent(masterPassword)}`);
    if (!response.ok) throw new Error('Failed to fetch passwords');
    return response.json();
  },

  createPassword: async (data: any) => {
    const response = await fetch(`${API_URL}/passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create password');
    }
    return response.json();
  },

  updatePassword: async (id: string, data: any) => {
    const response = await fetch(`${API_URL}/passwords/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update password');
    }
    return response.json();
  },

  deletePassword: async (id: string, masterPassword: string) => {
    const response = await fetch(`${API_URL}/passwords/${id}?master_password=${encodeURIComponent(masterPassword)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete password');
    }
    return response.json();
  },

  searchPasswords: async (query: string, masterPassword: string): Promise<PasswordEntry[]> => {
    const response = await fetch(`${API_URL}/passwords/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, master_password: masterPassword })
    });
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  },

  getCategories: async () => {
    const response = await fetch(`${API_URL}/categories`);
    return response.json();
  }
};
