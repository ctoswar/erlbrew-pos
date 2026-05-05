const BASE_URL = import.meta.env.VITE_API_URL || '';

function getApiUrl(path: string) {
  return `${BASE_URL}/api${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

// Token storage for admin auth
let authToken: string | null = null;

export function setAuthToken(token: string | null | undefined) {
  authToken = token ?? null;
  if (token) {
    localStorage.setItem('erlbrew_token', token);
  } else {
    localStorage.removeItem('erlbrew_token');
  }
}

export function getAuthToken(): string | null {
  // Always re-read from localStorage to catch changes in other tabs
  const stored = localStorage.getItem('erlbrew_token');
  if (stored && stored !== 'null' && stored !== 'undefined' && stored.trim().length > 0) {
    authToken = stored;
  } else {
    authToken = null;
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('erlbrew_token');
}

export function getApiUrlBase(): string {
  return BASE_URL;
}

export async function apiAdminGet<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      // Token exists but is invalid/expired - clear it locally
      clearAuthToken();
    }
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiAdminPost<T>(path: string, body: unknown): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearAuthToken();
    }
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiAdminPut<T>(path: string, body: unknown): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearAuthToken();
    }
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiAdminDelete<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    method: 'DELETE',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearAuthToken();
    }
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}