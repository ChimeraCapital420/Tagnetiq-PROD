// FILE: src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n'; // CRITICAL: This was missing. It initializes the language library.

// CORRECTED: The QueryClient MUST be instantiated with parentheses `()`.
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/*
          React.Suspense is required by i18next to handle the async loading of translation files.
        */}
        <React.Suspense fallback="Loading...">
          <App />
        </React.Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);