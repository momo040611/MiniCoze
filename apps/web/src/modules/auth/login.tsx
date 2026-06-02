import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import type { LoginPayload } from '../../api/auth';
import { Form, Input } from 'antd';
import { AuthPageLayout } from './auth-layout';

export function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleFinish(values: LoginPayload) {
    setError('');
    setLoading(true);
    try {
      await login(values);
      navigate('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageLayout
      title="登录 MiniCoze"
      submitText="登 录"
      loading={loading}
      error={error}
      onValuesChange={() => setError('')}
      onFinish={handleFinish}
      footerQuestion="还没有账号？"
      footerActionText="立即注册"
      onFooterAction={() => navigate('/register')}
    >
      <Form.Item
        label="邮箱"
        name="email"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '邮箱格式不正确' },
        ]}
      >
        <Input placeholder="请输入邮箱" autoComplete="email" />
      </Form.Item>

      <Form.Item
        label="密码"
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少 6 位' },
        ]}
      >
        <Input.Password
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </Form.Item>
    </AuthPageLayout>
  );
}
