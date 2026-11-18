import { useLayoutEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

type MediaQueryLike = {
  matches: boolean;
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
};

const STORAGE_KEY = 'theme';

/** 同一页面内多个订阅者共享的刷新通知，避免各自监听 storage（同文档不会触发 storage）。 */
const listeners = new Set<() => void>();

const readStoredMode = (): ThemeMode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* 隐私模式下读不到 localStorage，按浅色处理 */
  }
  return 'light';
};

const getMediaQuery = (): MediaQueryLike | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-color-scheme: dark)') as unknown as MediaQueryLike;
};

const resolveDark = (mode: ThemeMode): boolean => {
  if (mode === 'dark') return true;
  if (mode === 'system') return Boolean(getMediaQuery()?.matches);
  return false;
};

const applyAttribute = (dark: boolean) => {
  if (typeof document === 'undefined') return;
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
};

/**
 * 写入主题偏好并立即同步到 <html data-theme>。
 * AppLayout 在登录后仍按自己的 state 管理主题，这里写入的 localStorage 值会在其挂载时被读取。
 */
export function setThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* 忽略写入失败 */
  }
  applyAttribute(resolveDark(mode));
  listeners.forEach((notify) => notify());
}

/**
 * 只读地跟随全站主题（localStorage 'theme' + 系统偏好），并把结果同步到
 * <html data-theme="dark">。用于 AppLayout 之外的独立页面（/welcome、/login 等），
 * 使这些页面在登录前后呈现一致的主题。
 */
export function useThemeMode(): { isDark: boolean; mode: ThemeMode; toggle: () => void } {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    Boolean(getMediaQuery()?.matches),
  );

  // 用 layout effect 在首次绘制前写好 data-theme，避免浅色闪一下
  useLayoutEffect(() => {
    const sync = () => {
      const stored = readStoredMode();
      setMode(stored);
      setSystemPrefersDark(Boolean(getMediaQuery()?.matches));
      applyAttribute(resolveDark(stored));
    };

    sync();

    const mql = getMediaQuery();
    const onMediaChange = () => {
      const stored = readStoredMode();
      setSystemPrefersDark(Boolean(mql?.matches));
      applyAttribute(resolveDark(stored));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync();
    };

    mql?.addEventListener('change', onMediaChange);
    window.addEventListener('storage', onStorage);
    listeners.add(sync);
    return () => {
      mql?.removeEventListener('change', onMediaChange);
      window.removeEventListener('storage', onStorage);
      listeners.delete(sync);
    };
  }, []);

  const isDark = resolveDark(mode);

  const toggle = () => setThemeMode(isDark ? 'light' : 'dark');

  return { isDark, mode, toggle };
}
