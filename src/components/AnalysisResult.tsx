// FILE: src/components/AnalysisResult.tsx (IMPROVED)

import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, ScanLine } from 'lucide-react'; // ScanLine imported
import { toast } from 'sonner';

const AnalysisResult: React.FC = () => {
  const { lastAnalysisResult, setLastAnalysisResult, setIsScanning } = useAppContext(); // Added setIsScanning
  const [feedbackSent, setFeedbackSent] = useState(false);

  if (!lastAnalysisResult) {
    return null;
  }

  const handleFeedback = (isGood: boolean) => {
    console.log(`Feedback for analysis ID ${lastAnalysisResult.id}: ${isGood ? 'Good' : 'Bad'}`);
    setFeedbackSent(true);
    toast.success("Thank you!", {
      description: "Your feedback helps our AI improve.",
    });
  };

  // NEW FUNCTION: Implements the continuous scanning flow
  const handleScanNext = () => {
    setLastAnalysisResult(null); // Clear the current result
    setIsScanning(true);       // Immediately open the scanner
  };
  
  const isBuy = lastAnalysisResult.decision === 'BUY';

  return (
    <Card className="w-full max-w-md mx-auto text-left shadow-lg mt-8">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{lastAnalysisResult.itemName}</CardTitle>
            <CardDescription>Hydra AI Consensus Report</CardDescription>
          </div>
          <div className={`flex items-center gap-2 font-bold ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
            {isBuy ? <CheckCircle /> : <XCircle />}
            <span>{lastAnalysisResult.decision}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Estimated Value</p>
          <p className="text-2xl font-bold">{lastAnalysisResult.estimatedValue}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Reasoning</p>
          <p>{lastAnalysisResult.reasoning}</p>
        </div>
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>Confidence: {lastAnalysisResult.confidence}</span>
          <span>Consensus: {lastAnalysisResult.consensusRatio || 'N/A'} ({lastAnalysisResult.analysisCount || 1} AIs)</span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between bg-muted/50 px-6 py-3">
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => handleFeedback(true)} disabled={feedbackSent}>
            <ThumbsUp className="h-4 w-4 mr-2" /> Good
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleFeedback(false)} disabled={feedbackSent}>
            <ThumbsDown className="h-4 w-4 mr-2" /> Bad
          </Button>
        </div>
        {/* NEW BUTTON for continuous scanning */}
        <Button onClick={handleScanNext}>
            <ScanLine className="h-4 w-4 mr-2" />
            Scan Next Item
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AnalysisResult;