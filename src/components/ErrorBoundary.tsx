// FILE: src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-lg text-center">
                <CardHeader>
                    <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                    <CardTitle className="mt-4">Application Error</CardTitle>
                    <CardDescription>
                        Sorry, something went wrong. Please try refreshing the page.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => window.location.reload()}>
                        Refresh Page
                    </Button>
                </CardContent>
            </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;