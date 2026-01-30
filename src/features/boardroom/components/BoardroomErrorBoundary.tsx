// FILE: src/features/boardroom/components/BoardroomErrorBoundary.tsx
// Error boundary component for isolating failures in boardroom sections

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class BoardroomErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Boardroom Error Boundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { 
        fallbackTitle = 'Something went wrong', 
        fallbackMessage = 'This section encountered an error and could not be displayed.',
        className = '',
      } = this.props;

      return (
        <Card className={`border-destructive/50 ${className}`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-destructive mb-1">
                  {fallbackTitle}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {fallbackMessage}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mb-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Error details
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                      {this.state.error.message}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={this.handleReset}
                  className="gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Wrapper HOC for functional components
export function withBoardroomErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <BoardroomErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </BoardroomErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withBoardroomErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

export default BoardroomErrorBoundary;