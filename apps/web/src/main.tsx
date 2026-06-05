import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(

  <ConfigProvider
    theme={{
      algorithm: theme.defaultAlgorithm,
      token: {
        colorPrimary: '#18202f',
        borderRadius: 8,
        colorLink: '#0f766e',
        colorLinkHover: '#115e59',
      },
    }}
  >
    <AntdApp>
      <App />
    </AntdApp>
  </ConfigProvider>
  ,
);
