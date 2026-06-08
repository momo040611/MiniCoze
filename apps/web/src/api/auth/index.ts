import { http, type ApiEnvelope } from '../http';
import { saveAuthData, clearAuthData, updateUserData } from './auth-store';
import type { AuthData, UserInfo, LoginPayload, RegisterPayload, UpdateProfilePayload, ChangePasswordPayload } from './types';

export { setupAuthMocks } from './setup-mocks';
export type { UserInfo, AuthData, LoginPayload, RegisterPayload, UpdateProfilePayload, ChangePasswordPayload } from './types';

export async function login(payload: LoginPayload) {
  const res = await http.post<ApiEnvelope<AuthData>>('auth/login', payload);
  const authData = res.data;
  saveAuthData(authData.accessToken, authData.user);
  return authData;
}

export async function register(payload: RegisterPayload) {
  const res = await http.post<ApiEnvelope<AuthData>>('auth/register', payload);
  const authData = res.data;
  saveAuthData(authData.accessToken, authData.user);
  return authData;
}

export async function getProfile() {
  const res = await http.get<ApiEnvelope<UserInfo>>('users/me');
  return res.data;
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const res = await http.patch<ApiEnvelope<UserInfo>>('users/me', payload);
  const user = res.data;
  updateUserData(user);
  return user;
}

export async function changePassword(payload: ChangePasswordPayload) {
  const res = await http.put<ApiEnvelope<{ success: boolean }>>('auth/password', payload);
  return res.data;
}

export async function updateAvatar(file: File) {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await http.post<ApiEnvelope<{ avatarUrl: string | null }>>('auth/avatar', formData, {
    timeout: 30000,
  });

  const avatarUrl = res.data.avatarUrl;
  if (!avatarUrl) {
    throw new Error('头像地址生成失败');
  }

  const currentUser = await getProfile();
  updateUserData({ ...currentUser, avatarUrl });
  return avatarUrl;
}

export function logout() {
  clearAuthData();
}
