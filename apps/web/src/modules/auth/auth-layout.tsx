import type { ReactNode } from 'react';
import { Button, Card, Flex, Form, Typography } from 'antd';
import styles from './auth.module.css';

const { Title, Text } = Typography;

interface AuthPageLayoutProps<T extends object> {
  title: string;
  submitText: string;
  loading: boolean;
  error: string;
  onValuesChange: () => void;
  onFinish: (values: T) => void | Promise<void>;
  footerQuestion: string;
  footerActionText: string;
  onFooterAction: () => void;
  children: ReactNode;
}

export function AuthPageLayout<T extends object = Record<string, unknown>>({
  title,
  submitText,
  loading,
  error,
  onValuesChange,
  onFinish,
  footerQuestion,
  footerActionText,
  onFooterAction,
  children,
}: AuthPageLayoutProps<T>) {
  return (
    <main className={styles.shell}>
      <Card className={styles.card} styles={{ body: { width: '100%' } }}>
        <Flex vertical gap={28}>
          <Flex align="center" gap={10}>
            <div className={styles.brandIcon}>MC</div>
            <Text className={styles.brandName}>MiniCoze</Text>
          </Flex>

          <Title level={2} className={styles.pageTitle}>
            {title}
          </Title>

          <Form<T>
            className={styles.form}
            layout="vertical"
            onFinish={onFinish}
            onValuesChange={onValuesChange}
            autoComplete="off"
          >
            {children}

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={loading}
              className={styles.submitBtn}
            >
              {submitText}
            </Button>
          </Form>

          <Flex justify="center" gap={4}>
            <Text className={styles.footerText}>{footerQuestion}</Text>
            <Button
              type="link"
              onClick={onFooterAction}
              className={styles.footerLink}
            >
              {footerActionText}
            </Button>
          </Flex>
        </Flex>
      </Card>
    </main>
  );
}
