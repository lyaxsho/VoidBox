import { useState, useEffect, useCallback } from 'react';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
const TOKEN_KEY = 'voidbox_token';
const USER_KEY = 'voidbox_user';

export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Step 1: Send OTP code to phone number
  const sendCode = useCallback(async (phoneNumber: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/sendCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: { message: data.error || 'Failed to send code' }, data: null };
      }

      return {
        error: null,
        data: {
          phoneCodeHash: data.phoneCodeHash as string,
          timeout: data.timeout as number,
          tempToken: data.tempToken as string,
        },
      };
    } catch {
      return { error: { message: 'Network error' }, data: null };
    }
  }, []);

  // Step 2: Verify OTP code
  const verifyCode = useCallback(async (
    phoneNumber: string,
    phoneCode: string,
    phoneCodeHash: string,
    tempToken: string,
  ) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, phoneCode, phoneCodeHash, tempToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: { message: data.error || 'Verification failed' }, data: null };
      }

      // Check if 2FA is required
      if (data.requiresPassword) {
        return {
          error: null,
          data: { requiresPassword: true, tempToken: data.tempToken as string },
        };
      }

      // Login successful
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      return { error: null, data: { user: data.user } };
    } catch {
      return { error: { message: 'Network error' }, data: null };
    }
  }, []);

  // Step 2b: Verify 2FA password
  const verify2FA = useCallback(async (password: string, tempToken: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, tempToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: { message: data.error || '2FA verification failed' } };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      return { error: null };
    } catch {
      return { error: { message: 'Network error' } };
    }
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    return { error: null };
  }, []);

  return { user, loading, sendCode, verifyCode, verify2FA, signOut };
}