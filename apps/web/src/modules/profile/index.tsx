export { ProfilePage } from './ProfilePage';
// import { useState } from 'react';
// import { Avatar, Button, Form, Input, message } from 'antd';
// import { UserOutlined } from '@ant-design/icons';
// import { getCurrentUser } from '../../api/auth/auth-store';
// import styles from './index.module.css';

// export function ProfilePage() {
//   const user = getCurrentUser();
//   const [saving, setSaving] = useState(false);

//   const handleSave = () => {
//     setSaving(true);
//     setTimeout(() => {
//       setSaving(false);
//       message.success('个人资料已更新');
//     }, 800);
//   };

//   return (
//     <section className={styles.page}>
//       <div className={styles.header}>
//         <h1>个人中心</h1>
//         <p>管理你的个人资料和账户信息</p>
//       </div>

//       <div className={styles.card}>
//         <div className={styles.avatarSection}>
//           <Avatar
//             size={80}
//             src={user?.avatarUrl ?? undefined}
//             icon={!user?.avatarUrl && <UserOutlined />}
//           />
//           <div className={styles.avatarInfo}>
//             <span className={styles.displayName}>{user?.username ?? '用户'}</span>
//             <span className={styles.email}>{user?.email ?? ''}</span>
//           </div>
//         </div>
//       </div>

//       <div className={styles.card}>
//         <h2>基本资料</h2>
//         <Form layout="vertical" className={styles.form} onFinish={handleSave}>
//           <Form.Item label="用户名" name="username" initialValue={user?.username ?? ''}>
//             <Input placeholder="请输入用户名" />
//           </Form.Item>
//           <Form.Item label="邮箱" name="email" initialValue={user?.email ?? ''}>
//             <Input placeholder="请输入邮箱" />
//           </Form.Item>
//           <Form.Item>
//             <Button type="primary" htmlType="submit" loading={saving}>
//               保存修改
//             </Button>
//           </Form.Item>
//         </Form>
//       </div>
//     </section>
//   );
// }
