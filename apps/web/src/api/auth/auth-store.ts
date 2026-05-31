import { setAuthToken, clearAuthToken } from '../http';
import { clearWorkspaceCache } from '../workspace';
import type { UserInfo } from './types';
const TOKEN_KEY = 'minicoze_token';
const USER_KEY = 'minicoze_user';
let currentUser: UserInfo | null = null;
let listeners: Array<() => void> = [];
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function readUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);

    if (raw) {
      return JSON.parse(raw) as UserInfo;
    }
  } catch {
    // ignore
  }

  return null;
}
function persistToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}
function persistUser(user: UserInfo | null) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // ignore
  }
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function subscribeToAuth(fn: () => void) {
  listeners.push(fn);

  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getCurrentUser(): UserInfo | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}

export function saveAuthData(token: string, user: UserInfo) {
  persistToken(token);
  persistUser(user);
  setAuthToken(token);
  currentUser = user;
  notifyListeners();
}

export function updateUserData(user: UserInfo) {
  persistUser(user);
  currentUser = user;
  notifyListeners();
}

export function clearAuthData() {
  persistToken(null);
  persistUser(null);
  clearAuthToken();
  clearWorkspaceCache();
  currentUser = null;
  notifyListeners();
}

export function restoreAuthData(): boolean {
  const token = readToken();
  const user = readUser();

  if (!token || !user) return false;

  // 校验 token 是否过期（兼容 mock JWT 格式）
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1])) as { exp?: number };
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        clearAuthData();
        return false;
      }
    }
  } catch {
    // 非标准 JWT 格式时跳过校验
  }

  setAuthToken(token);
  currentUser = user;
  return true;
}
