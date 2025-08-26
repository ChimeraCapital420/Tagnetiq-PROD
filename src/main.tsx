// FILE: src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n'; // Initializes the language library

// Creates the client for the data-fetching library
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Provides the data-fetching client to the entire app */}
      <QueryClientProvider client={queryClient}>
        {/* Allows language files to load correctly */}
        <React.Suspense fallback="Loading...">
          <App />
        </React.Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);