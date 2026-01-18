// FILE: src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx.js';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext.tsx.js';
import { MfaProvider } from './contexts/MfaContext.tsx.js';
import './i18n'; // Initializes the language library

// Creates the client for the data-fetching library
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Provides the data-fetching client to the entire app */}
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MfaProvider>
            {/* Allows language files to load correctly */}
            <React.Suspense fallback="Loading...">
              <App />
            </React.Suspense>
          </MfaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);