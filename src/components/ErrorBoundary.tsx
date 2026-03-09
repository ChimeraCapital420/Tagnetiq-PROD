// FILE: src/components/ErrorBoundary.tsx
// ═══════════════════════════════════════════════════════════════════════
// Reusable Error Boundary — Hardening Sprint #8
// ═══════════════════════════════════════════════════════════════════════
//
// Wraps new components (ActionFork, GuidedOverlay, MarketplacePairing)
// so a runtime error in one component does not crash the page.
//
// Usage:
//   <ErrorBoundary>               ← fallback defaults to null (silent)
//     <ActionFork ... />
//   </ErrorBoundary>
//
//   <ErrorBoundary fallback={<p>Something went wrong</p>}>
//     <GuidedOverlay />
//   </ErrorBoundary>
//
// Behavior:
//   - Catches render errors in any child component tree
//   - Renders fallback (null by default — component disappears silently)
//   - Logs to console in development; silenced in production
//   - Does NOT catch: event handlers, async errors, SSR errors
// ═══════════════════════════════════════════════════════════════════════

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered when an error is caught. Defaults to null (silent fail). */
  fallback?: ReactNode;
  /** Called when error is caught — for external error reporting */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for debugging — in production this goes to your error tracker
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
    } else {
      console.error('[ErrorBoundary] Component render failed:', error.message);
    }
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.hasError) {
      // Default fallback is null — the component disappears silently.
      // The page keeps working. A bug in GuidedOverlay doesn't kill the scan.
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;