import type { UserInfo, AuthData } from './types';

const USERS_KEY = 'minicoze_users';

interface StoredUser extends UserInfo {
  password: string;
}

export function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

function generateId(): string {
  return 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

export function generateToken(userId: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  return encodedHeader + '.' + encodedPayload + '.mock-signature';
}

export function parseToken(token: string): { sub: string; iat: number; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as { sub: string; iat: number; exp: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function stripPassword(user: StoredUser): UserInfo {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...info } = user;
  return info;
}

function findUserByEmail(email: string): StoredUser | undefined {
  return readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id: string): StoredUser | undefined {
  return readUsers().find((u) => u.id === id);
}

export function initDefaultUser() {
  const users = readUsers();
  if (users.length === 0) {
    const defaultUser: StoredUser = {
      id: generateId(),
      username: 'admin',
      email: 'admin@minicoze.com',
      phone: '',
      bio: '',
      password: 'admin123',
      avatarUrl: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeUsers([defaultUser]);
  }
}

export function handleLogin(email: string, password: string): AuthData {
  const user = findUserByEmail(email);
  if (!user) {
    throw new Error('邮箱未注册');
  }
  if (user.password !== password) {
    throw new Error('密码错误');
  }
  const token = generateToken(user.id);
  return {
    accessToken: token,
    tokenType: 'Bearer',
    user: stripPassword(user),
  };
}

export function handleRegister(username: string, email: string, password: string): AuthData {
  if (findUserByEmail(email)) {
    throw new Error('该邮箱已被注册');
  }
  const now = new Date().toISOString();
  const newUser: StoredUser = {
    id: generateId(),
    username,
    email,
    phone: '',
    bio: '',
    password,
    avatarUrl: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  const users = readUsers();
  users.push(newUser);
  writeUsers(users);
  const token = generateToken(newUser.id);
  return {
    accessToken: token,
    tokenType: 'Bearer',
    user: stripPassword(newUser),
  };
}

export function handleGetProfile(token: string): UserInfo {
  const payload = parseToken(token);
  if (!payload) {
    throw new Error('未登录或 token 已过期');
  }
  const user = findUserById(payload.sub);
  if (!user) {
    throw new Error('用户不存在');
  }
  return stripPassword(user);
}

export function handleUpdateProfile(token: string, updates: Partial<Omit<StoredUser, 'id' | 'password' | 'createdAt'>>): UserInfo {
  const payload = parseToken(token);
  if (!payload) {
    throw new Error('未登录或 token 已过期');
  }
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === payload.sub);
  if (idx === -1) {
    throw new Error('用户不存在');
  }
  if (updates.username !== undefined) users[idx].username = updates.username;
  if (updates.email !== undefined) users[idx].email = updates.email;
  if (updates.phone !== undefined) users[idx].phone = updates.phone;
  if (updates.bio !== undefined) users[idx].bio = updates.bio;
  if (updates.avatarUrl !== undefined) users[idx].avatarUrl = updates.avatarUrl;
  users[idx].updatedAt = new Date().toISOString();
  writeUsers(users);
  return stripPassword(users[idx]);
}

export function handleChangePassword(token: string, oldPassword: string, newPassword: string): boolean {
  const payload = parseToken(token);
  if (!payload) {
    throw new Error('未登录或 token 已过期');
  }
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === payload.sub);
  if (idx === -1) {
    throw new Error('用户不存在');
  }
  if (users[idx].password !== oldPassword) {
    throw new Error('旧密码错误');
  }
  users[idx].password = newPassword;
  users[idx].updatedAt = new Date().toISOString();
  writeUsers(users);
  return true;
}
