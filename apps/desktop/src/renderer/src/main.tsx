import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { PublicScreen } from './components/PublicScreen.js';
import './styles.css';

const isPublicScreen = window.location.hash === '#public';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {isPublicScreen ? <PublicScreen /> : <App />}
    </React.StrictMode>,
  );
}
