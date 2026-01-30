// FILE: src/features/boardroom/components/ErrorBoundary.tsx
// Error boundary to catch and display errors gracefully in the Boardroom

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// =============================================================================
// TYPES
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log to console in development
    console.error('Boardroom Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
              <CardDescription>
                The Boardroom encountered an unexpected error. Don't worry, your data is safe.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error details (collapsible in production) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="bg-muted rounded-lg p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-red-500">
                    Error Details
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={this.handleReset} 
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  onClick={this.handleRefresh} 
                  className="flex-1"
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Page
                </Button>
                <Button 
                  onClick={this.handleGoHome} 
                  className="flex-1"
                  variant="ghost"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {/* Support message */}
              <p className="text-xs text-center text-muted-foreground">
                If this keeps happening, please contact support or try clearing your browser cache.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// FUNCTIONAL WRAPPER (for hooks compatibility)
// =============================================================================

interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<{ error: Error; reset: () => void }>;
}

export const BoardroomErrorBoundary: React.FC<ErrorBoundaryWrapperProps> = ({
  children,
  fallbackComponent: FallbackComponent,
}) => {
  const [resetKey, setResetKey] = React.useState(0);

  const handleReset = () => {
    setResetKey(prev => prev + 1);
  };

  if (FallbackComponent) {
    return (
      <ErrorBoundary
        key={resetKey}
        onReset={handleReset}
        fallback={null}
      >
        {children}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary key={resetKey} onReset={handleReset}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;