import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { APP_VERSION } from '@/lib/constants';

interface VersionSplashProps {
  onDismiss: () => void;
}

const VersionSplash: React.FC<VersionSplashProps> = ({ onDismiss }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Welcome to TagnetIQ v{APP_VERSION} Beta</CardTitle>
          <CardDescription>Thank you for helping us test the future of asset intelligence.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold">What's New:</h4>
            <ul className="list-disc list-inside text-muted-foreground">
              <li>Activated dynamic, theme-based backgrounds.</li>
              <li>Implemented the full Beta Tester Suite & Admin Console.</li>
              <li>Added the foundational Investor Suite.</li>
            </ul>
          </div>
          <Button className="w-full mt-6" onClick={onDismiss}>
            Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VersionSplash;