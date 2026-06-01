export interface UserInfo {
  id: string;
  username: string;
  email: string;
  phone: string;
  bio: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthData {
  accessToken: string;
  tokenType: 'Bearer';
  user: UserInfo;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  username?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}
