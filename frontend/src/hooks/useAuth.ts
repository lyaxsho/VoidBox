import { useState, useEffect, useCallback } from 'react';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
const TOKEN_KEY = 'voidbox_token';
const USER_KEY = 'voidbox_user';

export interface User {
  id: string;
  email?: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  email_verified?: boolean;
  secure_upload_enabled: boolean;
  is_admin?: boolean;
  telegram_linked: boolean;
  telegram_id?: number;
  channel_id?: number;
  created_at: string;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((token: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        // /me returns a refreshed token when it upgrades a session-less JWT
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, firstName?: string, lastName?: string) => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, firstName, lastName }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: { message: data.error || 'Signup failed' } };
        }
        if (data.token && data.user) {
          persistSession(data.token, data.user);
        }
        return { error: null, data };
      } catch {
        return { error: { message: 'Network error' } };
      }
    },
    [persistSession]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: { message: data.error || 'Login failed' } };
        }
        persistSession(data.token, data.user);
        return { error: null };
      } catch {
        return { error: { message: 'Network error' } };
      }
    },
    [persistSession]
  );

  const setSecureUpload = useCallback(
    async (enabled: boolean) => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/secure-upload`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ enabled }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            error: { message: data.error || 'Failed to update setting', code: data.code },
          };
        }
        if (data.token) {
          persistSession(data.token, data.user);
        } else {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
        return { error: null, user: data.user as User };
      } catch {
        return { error: { message: 'Network error' } };
      }
    },
    [persistSession]
  );

  const checkEmail = useCallback(async (email: string): Promise<{ exists: boolean } | { error: string }> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Failed to check email' };
      return { exists: data.exists as boolean };
    } catch {
      return { error: 'Network error' };
    }
  }, []);

  const resendVerification = useCallback(async (email: string): Promise<{ message?: string; error?: string }> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Failed to resend' };
      return { message: data.message };
    } catch {
      return { error: 'Network error' };
    }
  }, []);

  const requestMagicLink = useCallback(async (email: string): Promise<{ message?: string; error?: string }> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Failed to send magic link' };
      return { message: data.message };
    } catch {
      return { error: 'Network error' };
    }
  }, []);

  const sendLinkCode = useCallback(async (phoneNumber: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/link-telegram/sendCode`, {
        method: 'POST',
        headers: authHeaders(),
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

  const verifyLinkCode = useCallback(
    async (
      phoneNumber: string,
      phoneCode: string,
      phoneCodeHash: string,
      tempToken: string
    ) => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/link-telegram/verify`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ phoneNumber, phoneCode, phoneCodeHash, tempToken }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: { message: data.error || 'Verification failed' }, data: null };
        }
        if (data.requiresPassword) {
          return {
            error: null,
            data: { requiresPassword: true, tempToken: data.tempToken as string },
          };
        }
        persistSession(data.token, data.user);
        return { error: null, data: { user: data.user } };
      } catch {
        return { error: { message: 'Network error' }, data: null };
      }
    },
    [persistSession]
  );

  const verifyLink2FA = useCallback(
    async (password: string, tempToken: string) => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/link-telegram/verify`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ password, tempToken }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: { message: data.error || '2FA verification failed' } };
        }
        persistSession(data.token, data.user);
        return { error: null };
      } catch {
        return { error: { message: 'Network error' } };
      }
    },
    [persistSession]
  );

  const unlinkTelegram = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/link-telegram`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.error || 'Failed to unlink' } };
      persistSession(data.token, data.user);
      return { error: null };
    } catch {
      return { error: { message: 'Network error' } };
    }
  }, [persistSession]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    return { error: null };
  }, []);

  return {
    user,
    loading,
    signUp,
    signIn,
    checkEmail,
    resendVerification,
    requestMagicLink,
    setSecureUpload,
    unlinkTelegram,
    sendLinkCode,
    verifyLinkCode,
    verifyLink2FA,
    signOut,
  };
}
