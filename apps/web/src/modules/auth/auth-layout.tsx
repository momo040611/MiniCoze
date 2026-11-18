import type { ReactNode } from 'react';
import { Button, ConfigProvider, Form, theme as antdTheme } from 'antd';
import { Link } from 'react-router-dom';
import { useThemeMode } from '../../hooks/useThemeMode';
import styles from './auth.module.css';

interface AuthPageLayoutProps<T extends object> {
  title: string;
  subtitle?: string;
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

const BrandMark = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="authBrandGrad" x1="2" y1="2" x2="24" y2="24">
        <stop offset="0" stopColor="#5C6BFF" />
        <stop offset="1" stopColor="#12B8B0" />
      </linearGradient>
    </defs>
    <path
      d="M13 2.2 22.5 7.6v10.8L13 23.8 3.5 18.4V7.6L13 2.2Z"
      fill="url(#authBrandGrad)"
      fillOpacity="0.1"
      stroke="url(#authBrandGrad)"
      strokeWidth="1.4"
    />
    <path d="M13 2.2v21.6M3.5 7.6 13 13l9.5-5.4" stroke="url(#authBrandGrad)" strokeWidth="1" opacity="0.75" />
  </svg>
);

const FONT_STACK =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

export function AuthPageLayout<T extends object = Record<string, unknown>>({
  title,
  subtitle,
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
  const { isDark } = useThemeMode();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#4f5bf0',
          colorLink: isDark ? '#8b96ff' : '#4f5bf0',
          colorLinkHover: isDark ? '#a4aeff' : '#3f4be0',
          colorBorder: isDark ? '#262d42' : '#e2e6f2',
          colorTextBase: isDark ? '#e8ecf7' : '#0e1424',
          borderRadius: 10,
          controlHeight: 42,
          fontSize: 14,
          fontFamily: FONT_STACK,
        },
      }}
    >
      <div className={styles.shell}>
        <aside className={styles.aside}>
          <div className={styles.asideInner}>
            <Link className={styles.brand} to="/welcome">
              <BrandMark />
              MiniCoze
            </Link>

            <div className={styles.eyebrow}>
              <span className={styles.eyebrowMark}>✦</span>
              可视化 Agent 构建平台
            </div>

            <h2 className={styles.headline}>
              把想法，搭成一个
              <br />
              真正<span className={styles.accent}>会干活</span>的 Agent
            </h2>

            <p className={styles.lead}>
              角色、知识库、工具、工作流，四块积木拼出你的 AI 同事。调试、评估、发布，都在一块画布上完成。
            </p>

            <div className={styles.visual} aria-hidden="true">
              <div className={styles.visualDeck}>
                <div className={styles.ghostCard} />
                <div className={styles.miniCard}>
                  <div className={styles.miniHead}>
                    <span className={styles.dot} />
                    Agent · 售后助手
                    <span className={styles.miniTag}>在线</span>
                  </div>
                  <div className={styles.miniBody}>
                    <div className={styles.bubble}>已根据知识库整理出 3 条答案，并调用了「订单查询」工具</div>
                    <div className={styles.chipRow}>
                      <span className={styles.chip}>知识库</span>
                      <span className={styles.chip}>订单查询</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className={styles.meta}>多 Agent 编排 · 知识库检索 · 全程可调试</p>
          </div>
        </aside>

        <section className={styles.panel}>
          <div className={styles.formWrap}>
            <div className={styles.panelHead}>
              <Link className={styles.panelBrand} to="/welcome">
                <BrandMark />
                MiniCoze
              </Link>
              <Link className={styles.backLink} to="/welcome">
                ← 返回首页
              </Link>
            </div>

            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}

            <Form<T>
              className={styles.form}
              layout="vertical"
              requiredMark={false}
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

            <div className={styles.footer}>
              <span className={styles.footText}>{footerQuestion}</span>
              <Button type="link" onClick={onFooterAction} className={styles.footLink}>
                {footerActionText}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </ConfigProvider>
  );
}
