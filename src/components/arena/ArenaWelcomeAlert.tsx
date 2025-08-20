// FILE: src/components/arena/ArenaWelcomeAlert.tsx

import React, { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Trophy } from 'lucide-react';

interface ArenaWelcomeAlertProps {
  isOpen: boolean;
  onDismiss: (dontShowAgain: boolean) => void;
}

export const ArenaWelcomeAlert: React.FC<ArenaWelcomeAlertProps> = ({ isOpen, onDismiss }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex flex-col items-center text-center">
            <Trophy className="h-12 w-12 text-primary mb-4" />
            <AlertDialogTitle className="text-2xl">Welcome to the Tagnetiq Arena!</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <div className="text-sm text-muted-foreground space-y-4">
            <p>
                You've just stepped into the ultimate proving ground for treasure hunters and deal makers. The goal is simple: achieve the highest Return on Investment (ROI) and climb the leaderboards to prove your skills.
            </p>
            <div>
                <h4 className="font-semibold text-foreground mb-2">How to Compete:</h4>
                <ol className="list-decimal list-inside space-y-1">
                    <li><span className="font-semibold">SCAN:</span> Use Tagnetiq's AI to analyze any item—from a rare collectible in a photo to a real-world property.</li>
                    <li><span className="font-semibold">CHALLENGE:</span> Start a "Public Challenge" to log your purchase price and enter the competition.</li>
                    <li><span className="font-semibold">WIN:</span> Log your final sale price to complete the challenge. Your ROI is automatically calculated and ranked!</li>
                </ol>
            </div>
            <p className="font-semibold text-foreground">
                Every scan is a potential victory. Spot the hidden value, make the winning flip, and become a Tagnetiq Titan.
            </p>
        </div>
        <AlertDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-4">
            <div className="flex items-center space-x-2">
                <Checkbox id="dont-show-again" checked={dontShowAgain} onCheckedChange={(checked) => setDontShowAgain(!!checked)} />
                <Label htmlFor="dont-show-again" className="text-sm font-normal">Don't show this again</Label>
            </div>
          <Button className="w-full" onClick={() => onDismiss(dontShowAgain)}>Let the Games Begin!</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};