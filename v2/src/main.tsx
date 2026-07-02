// v2 React 앱을 브라우저 루트에 마운트한다.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('앱을 마운트할 root 엘리먼트를 찾지 못했습니다.');
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
