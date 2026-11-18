import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeMode } from '../../hooks/useThemeMode';
import styles from './welcome.module.css';

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ');

function RoleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="10" cy="6.8" r="3.1" />
      <path d="M3.8 17c0-3 2.8-5.1 6.2-5.1s6.2 2.1 6.2 5.1" />
    </svg>
  );
}

function KnowledgeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 2.6 3.4 6l6.6 3.4L16.6 6 10 2.6Z" />
      <path d="m3.4 10 6.6 3.4 6.6-3.4" />
      <path d="m3.4 14 6.6 3.4 6.6-3.4" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7 2.8v3.6M13 2.8v3.6M5 6.4h10v3.2a5 5 0 0 1-10 0V6.4Z" />
      <path d="M10 14.6v2.6" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="5" cy="5" r="1.9" />
      <circle cx="15.2" cy="7" r="1.9" />
      <circle cx="7" cy="15" r="1.9" />
      <path d="m6.7 5.7 6.8 1M6 6.7l.8 6.4M14 8.6l-5.4 5" />
    </svg>
  );
}

const features = [
  { key: 'role', title: '角色设定', desc: '人设、指令、模型与记忆', icon: <RoleIcon /> },
  { key: 'kb', title: '知识库', desc: '解析、切片、检索开箱可用', icon: <KnowledgeIcon /> },
  { key: 'tools', title: '工具调用', desc: 'HTTP、插件、代码即插即用', icon: <ToolsIcon /> },
  { key: 'workflow', title: '工作流编排', desc: '拖拽连线，多 Agent 协同', icon: <WorkflowIcon /> }
];

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BrandMark = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="welcomeBrandGrad" x1="2" y1="2" x2="24" y2="24">
        <stop offset="0" stopColor="#5C6BFF" />
        <stop offset="1" stopColor="#12B8B0" />
      </linearGradient>
    </defs>
    <path d="M13 2.2 22.5 7.6v10.8L13 23.8 3.5 18.4V7.6L13 2.2Z" fill="url(#welcomeBrandGrad)" fillOpacity="0.1" stroke="url(#welcomeBrandGrad)" strokeWidth="1.4" />
    <path d="M13 2.2v21.6M3.5 7.6 13 13l9.5-5.4" stroke="url(#welcomeBrandGrad)" strokeWidth="1" opacity="0.75" />
  </svg>
);

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.7" />
      <path d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M15.3 4.7 14 6M6 14l-1.3 1.3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.2 12.4A6.8 6.8 0 0 1 7.6 3.8a6.9 6.9 0 1 0 8.6 8.6Z" />
    </svg>
  );
}

const BASE_TILT_X = 10;
const BASE_TILT_Y = -17;

export function WelcomePage() {
  // 让 /welcome 自己维护 <html data-theme>，不依赖 AppLayout
  const { isDark, toggle: toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [deckReady, setDeckReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeckReady(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const deck = deckRef.current;
    if (!stage || !deck) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let running = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const paint = () => {
      const tiltX = (BASE_TILT_X - currentY * 6).toFixed(2);
      const tiltY = (BASE_TILT_Y + currentX * 9).toFixed(2);
      deck.style.transform = 'rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)';
    };

    const step = () => {
      currentX += (targetX - currentX) * 0.07;
      currentY += (targetY - currentY) * 0.07;
      paint();
      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        frame = window.requestAnimationFrame(step);
      } else {
        currentX = targetX;
        currentY = targetY;
        running = false;
      }
    };

    const kick = () => {
      if (running) return;
      running = true;
      frame = window.requestAnimationFrame(step);
    };

    const handleMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      kick();
    };

    const handleLeave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };

    stage.addEventListener('pointermove', handleMove);
    stage.addEventListener('pointerleave', handleLeave);

    return () => {
      window.cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove', handleMove);
      stage.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  const handleExplore = () => {
    const target = document.getElementById('welcome-features');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className={styles.page}>
      <header className={cx(styles.wrap, styles.nav)}>
        <Link className={styles.brand} to="/welcome">
          <BrandMark />
          MiniCoze
        </Link>
        <nav className={styles.navLinks}>
          <a href="#welcome-features">功能特性</a>
        </nav>
        <div className={styles.navRight}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={isDark ? '切换到浅色主题' : '切换到暗色主题'}
            title={isDark ? '切换到浅色主题' : '切换到暗色主题'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/login">登录</Link>
          <Link className={styles.navCta} to="/register">
            免费开始
          </Link>
        </div>
      </header>

      <main className={cx(styles.wrap, styles.hero)}>
        <div>
          <div className={cx(styles.eyebrow, styles.up, styles.d1)}>
            <span className={styles.eyebrowMark}>✦</span>
            可视化 Agent 构建平台
          </div>
          <h1 id="page-title" className={cx(styles.title, styles.up, styles.d2)}>
            把想法，搭成一个
            <br />
            真正<span className={styles.accent}>会干活</span>的 Agent
          </h1>
          <p className={cx(styles.sub, styles.up, styles.d3)}>
            角色、知识库、工具、工作流，四块积木拼出你的 AI 同事。
            <br />
            调试、评估、发布，都在一块画布上完成。
          </p>
          <div className={cx(styles.actions, styles.up, styles.d4)}>
            <button className={cx(styles.btn, styles.btnPrimary)} type="button" onClick={() => navigate('/login')}>
              进入平台
              <ArrowIcon />
            </button>
            <button className={cx(styles.btn, styles.btnGhost)} type="button" onClick={handleExplore}>
              看看能搭什么
              <ArrowIcon />
            </button>
          </div>
          <p className={cx(styles.meta, styles.up, styles.d4)}>多 Agent 编排 · 知识库检索 · 全程可调试</p>
        </div>

        <div className={styles.stage} ref={stageRef} aria-hidden="true">
          <div className={styles.deckWrap}>
            <div className={cx(styles.deck, deckReady && styles.deckIn)} ref={deckRef}>
              <div className={styles.floor} />

              <div className={cx(styles.cardSlot, styles.slotKb)}>
                <div className={cx(styles.float, styles.f2)}>
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.dot} />
                      <b>知识库</b>
                      <span className={styles.tag}>3 个文件</span>
                    </div>
                    <div className={styles.kbList}>
                      <div className={styles.kbRow}>
                        <span className={styles.kbIco} style={{ background: 'linear-gradient(135deg,#FF7A59,#F2543C)' }}>
                          PDF
                        </span>
                        <div>
                          <div className={styles.kbT}>产品手册 v3.2.pdf</div>
                          <div className={styles.kbS}>已索引 · 128 个片段</div>
                        </div>
                      </div>
                      <div className={styles.kbRow}>
                        <span className={styles.kbIco} style={{ background: 'linear-gradient(135deg,#5C6BFF,#3F4BE0)' }}>
                          DOC
                        </span>
                        <div>
                          <div className={styles.kbT}>客服 SOP.docx</div>
                          <div className={styles.kbS}>已索引 · 64 个片段</div>
                        </div>
                      </div>
                      <div className={styles.kbRow}>
                        <span className={styles.kbIco} style={{ background: 'linear-gradient(135deg,#12B8B0,#0E9A94)' }}>
                          MD
                        </span>
                        <div>
                          <div className={styles.kbT}>FAQ.md</div>
                          <div className={styles.kbS}>已索引 · 32 个片段</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={cx(styles.cardSlot, styles.slotFlow)}>
                <div className={cx(styles.float, styles.f1)}>
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.dot} />
                      <b>工作流 · 客服分流</b>
                      <span className={styles.tag}>运行中</span>
                    </div>
                    <div className={styles.canvasMini}>
                      <svg viewBox="0 0 400 170" width="100%" height="170">
                        <defs>
                          <linearGradient id="welcomeFlowGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0" stopColor="#C9D2FF" />
                            <stop offset="1" stopColor="#6C7CFF" />
                          </linearGradient>
                        </defs>
                        <g stroke="url(#welcomeFlowGrad)" strokeWidth="1.6" fill="none" strokeLinecap="round">
                          <path d="M96 74 C116 74 122 44 142 44" />
                          <path d="M96 74 C116 74 122 122 142 122" />
                          <path d="M238 44 C258 44 264 82 284 82" />
                          <path d="M238 122 C258 122 264 82 284 82" />
                        </g>
                        <g fontSize="11" fill="#4A5470" textAnchor="middle">
                          <g>
                            <rect x="16" y="58" width="80" height="32" rx="8" fill="#EEF1FF" stroke="#D5DCFF" />
                            <text x="56" y="78">开始</text>
                          </g>
                          <g>
                            <rect x="142" y="28" width="96" height="32" rx="8" fill="#F4F7FF" stroke="#DDE4F7" />
                            <text x="190" y="48">意图识别</text>
                          </g>
                          <g>
                            <rect x="142" y="106" width="96" height="32" rx="8" fill="#F4F7FF" stroke="#DDE4F7" />
                            <text x="190" y="126">知识检索</text>
                          </g>
                          <g>
                            <rect x="284" y="66" width="96" height="32" rx="8" fill="#EFFBF9" stroke="#C9EFEB" />
                            <text x="332" y="86">回复</text>
                          </g>
                        </g>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className={cx(styles.cardSlot, styles.slotChat)}>
                <div className={cx(styles.float, styles.f3)}>
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.dot} />
                      <b>Agent · 售后助手</b>
                      <span className={styles.tag}>在线</span>
                    </div>
                    <div className={styles.chatBody}>
                      <div className={styles.bubble}>
                        已根据知识库整理出 3 条答案，并调用了「订单查询」工具
                        <span className={styles.typing}>
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className={cx(styles.wrap, styles.caps)} id="welcome-features" aria-label="核心能力">
        {features.map((feature, index) => (
          <article key={feature.key} className={cx(styles.cap, styles.up, index < 2 ? styles.d2 : styles.d3)}>
            <div className={styles.capIco}>{feature.icon}</div>
            <h3 className={styles.capTitle}>{feature.title}</h3>
            <p className={styles.capDesc}>{feature.desc}</p>
          </article>
        ))}
      </section>

      <footer className={cx(styles.wrap, styles.foot)}>
        <span>© 2026 MiniCoze</span>
        <span>可视化 AI Agent 搭建平台</span>
      </footer>
    </div>
  );
}