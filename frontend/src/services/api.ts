const API_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '') + '/api';

export interface PasswordEntry {
  id: string;
  account_name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  tags: string[];
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

async function parseError(response: Response, fallback: string) {
  try {
    const error = await response.json();
    const detail = error?.detail;
    if (typeof detail === 'string') {
      throw new Error(detail);
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (typeof first === 'string') {
        throw new Error(first);
      }
      const field = Array.isArray(first?.loc)
        ? first.loc.filter((x: unknown) => x !== 'body').join('.')
        : '';
      const msg = first?.msg || first?.message || JSON.stringify(first);
      throw new Error(field ? `${field}: ${msg}` : msg || fallback);
    }
    throw new Error(fallback);
  } catch (e) {
    if (e instanceof Error && e.message !== fallback) throw e;
    throw new Error(fallback);
  }
}

export const api = {
  checkSetup: async (email?: string) => {
    const qs = email ? `?email=${encodeURIComponent(email)}` : '';
    const response = await fetch(`${API_URL}/auth/check${qs}`);
    return response.json();
  },

  setupMasterPassword: async (email: string, masterPassword: string) => {
    const response = await fetch(`${API_URL}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, master_password: masterPassword }),
    });
    if (!response.ok) await parseError(response, 'Setup failed');
    return response.json();
  },

  forgotPassword: async (email: string) => {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) await parseError(response, 'Failed to send OTP');
    return response.json();
  },

  verifyOTPReset: async (email: string, otpCode: string, newMasterPassword: string) => {
    const response = await fetch(`${API_URL}/auth/verify-otp-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp_code: otpCode,
        new_master_password: newMasterPassword,
      }),
    });
    if (!response.ok) await parseError(response, 'OTP verification failed');
    return response.json();
  },

  login: async (email: string, masterPassword: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, master_password: masterPassword }),
    });
    if (!response.ok) await parseError(response, 'Login failed');
    return response.json();
  },

  resetAllData: async () => {
    const response = await fetch(`${API_URL}/auth/reset`, {
      method: 'DELETE',
    });
    if (!response.ok) await parseError(response, 'Reset failed');
    return response.json();
  },

  getAllPasswords: async (email: string, masterPassword: string): Promise<PasswordEntry[]> => {
    const response = await fetch(
      `${API_URL}/passwords?email=${encodeURIComponent(email)}&master_password=${encodeURIComponent(masterPassword)}`,
    );
    if (!response.ok) throw new Error('Failed to fetch passwords');
    return response.json();
  },

  createPassword: async (data: any) => {
    const response = await fetch(`${API_URL}/passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, 'Failed to create password');
    return response.json();
  },

  updatePassword: async (id: string, data: any) => {
    const response = await fetch(`${API_URL}/passwords/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, 'Failed to update password');
    return response.json();
  },

  deletePassword: async (id: string, email: string, masterPassword: string) => {
    const response = await fetch(
      `${API_URL}/passwords/${id}?email=${encodeURIComponent(email)}&master_password=${encodeURIComponent(masterPassword)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) await parseError(response, 'Failed to delete password');
    return response.json();
  },

  reorderPasswords: async (
    email: string,
    masterPassword: string,
    orderedIds: string[],
  ) => {
    const response = await fetch(`${API_URL}/passwords/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        master_password: masterPassword,
        ordered_ids: orderedIds,
      }),
    });
    if (!response.ok) await parseError(response, 'Failed to reorder passwords');
    return response.json();
  },

  searchPasswords: async (
    query: string,
    email: string,
    masterPassword: string,
  ): Promise<PasswordEntry[]> => {
    const response = await fetch(`${API_URL}/passwords/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, email, master_password: masterPassword }),
    });
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  },

  getCategories: async () => {
    const response = await fetch(`${API_URL}/categories`);
    return response.json();
  },
};
