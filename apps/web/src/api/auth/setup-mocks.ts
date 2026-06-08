import { registerMockHandler, ApiError } from '../http';
import { initDefaultUser, handleLogin, handleRegister, handleGetProfile, handleUpdateProfile, handleChangePassword } from './mock-server';

let registered = false;

function errorResponse(message: string, status = 400): never {
  throw new ApiError(message, status);
}

function getTokenFromHeaders(headers: Headers): string {
  return headers.get('Authorization')?.replace('Bearer ', '') ?? '';
}

export function setupAuthMocks() {
  if (registered) return;
  registered = true;

  initDefaultUser();

  registerMockHandler('POST', 'auth/login', async (body) => {
    try {
      const { email, password } = body as { email: string; password: string };
      const authData = handleLogin(email, password);
      return { code: 0, message: 'ok', data: authData };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '请求失败');
    }
  });

  registerMockHandler('POST', 'auth/register', async (body) => {
    try {
      const { username, email, password } = body as {
        username: string;
        email: string;
        password: string;
      };
      const authData = handleRegister(username, email, password);
      return { code: 0, message: 'ok', data: authData };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '请求失败');
    }
  });

  registerMockHandler('GET', 'auth/profile', async (_body, headers) => {
    try {
      const token = getTokenFromHeaders(headers);
      const userInfo = handleGetProfile(token);
      return { code: 0, message: 'ok', data: userInfo };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '未登录', 401);
    }
  });

  registerMockHandler('PUT', 'auth/profile', async (body, headers) => {
    try {
      const token = getTokenFromHeaders(headers);
      const updates = body as Record<string, unknown>;
      const userInfo = handleUpdateProfile(token, updates);
      return { code: 0, message: 'ok', data: userInfo };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '更新失败', 400);
    }
  });

  registerMockHandler('GET', 'users/me', async (_body, headers) => {
    try {
      const token = getTokenFromHeaders(headers);
      const userInfo = handleGetProfile(token);
      return { code: 0, message: 'ok', data: userInfo };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '未登录', 401);
    }
  });

  registerMockHandler('PATCH', 'users/me', async (body, headers) => {
    try {
      const token = getTokenFromHeaders(headers);
      const updates = body as Record<string, unknown>;
      const userInfo = handleUpdateProfile(token, updates);
      return { code: 0, message: 'ok', data: userInfo };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '更新失败', 400);
    }
  });

  registerMockHandler('PUT', 'auth/password', async (body, headers) => {
    try {
      const token = getTokenFromHeaders(headers);
      const { oldPassword, newPassword } = body as { oldPassword: string; newPassword: string };
      handleChangePassword(token, oldPassword, newPassword);
      return { code: 0, message: 'ok', data: { success: true } };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '密码修改失败', 400);
    }
  });

  registerMockHandler('POST', 'auth/avatar', async (body, headers) => {
    try {
      const token = getTokenFromHeaders(headers);
      // 如果是 FormData，模拟上传头像
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`;
      const userInfo = handleUpdateProfile(token, { avatarUrl });
      return { code: 0, message: 'ok', data: { avatarUrl: userInfo.avatarUrl } };
    } catch (err) {
      errorResponse(err instanceof Error ? err.message : '头像上传失败', 400);
    }
  });

  registerMockHandler('POST', 'files/upload', async () => ({
    code: 0,
    message: 'ok',
    data: {
      url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
    },
  }));
}
