// FILE: src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './i18n'; // Import the i18n configuration

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <React.Suspense fallback={<div>Loading...</div>}>
        <App />
      </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);