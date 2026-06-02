import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../../api/auth';
import type { RegisterPayload } from '../../api/auth';
import { Form, Input } from 'antd';
import { AuthPageLayout } from './auth-layout';

export function RegisterPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleFinish(values: RegisterPayload) {
    setError('');
    setLoading(true);
    try {
      await register(values);
      navigate('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageLayout<RegisterPayload>
      title="注册 MiniCoze"
      submitText="注 册"
      loading={loading}
      error={error}
      onValuesChange={() => setError('')}
      onFinish={handleFinish}
      footerQuestion="已有账号？"
      footerActionText="立即登录"
      onFooterAction={() => navigate('/login')}
    >
      <Form.Item
        label="用户名"
        name="username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input placeholder="请输入用户名" autoComplete="username" />
      </Form.Item>

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
          placeholder="请输入密码（至少 6 位）"
          autoComplete="new-password"
        />
      </Form.Item>
    </AuthPageLayout>
  );
}
