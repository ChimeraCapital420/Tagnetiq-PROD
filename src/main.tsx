// FILE: src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n'; // This was missing: It initializes the language library.

// This was misconfigured: It creates the client for data fetching.
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* This was missing: It provides the data client to your app. */}
      <QueryClientProvider client={queryClient}>
        {/* This was missing: It allows language files to load. */}
        <React.Suspense fallback="Loading...">
          <App />
        </React.Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);