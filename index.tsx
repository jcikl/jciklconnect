import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/accessibility.css';
import { AuthProvider } from './hooks/useAuth';
import { AccessibilityRunner } from './components/accessibility/AccessibilityRunner';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <AccessibilityRunner>
        <App />
      </AccessibilityRunner>
    </AuthProvider>
  </React.StrictMode>
);
