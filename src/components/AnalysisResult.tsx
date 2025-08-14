import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const AnalysisResult: React.FC = () => {
  const { lastAnalysisResult } = useAppContext();
  const [feedbackSent, setFeedbackSent] = useState(false);

  if (!lastAnalysisResult) {
    return null;
  }

  const handleFeedback = (isGood: boolean) => {
    console.log(`Feedback for analysis ID ${lastAnalysisResult.id}: ${isGood ? 'Good' : 'Bad'}`);
    setFeedbackSent(true);
    toast.success("Feedback submitted!", {
      description: "Your input helps our AI get smarter.",
    });
  };
  
  const isBuy = lastAnalysisResult.decision === 'BUY';

  return (
    <Card className="w-full max-w-md mx-auto text-left shadow-lg">
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
          <p className="text-2xl font-bold">${lastAnalysisResult.estimatedValue}</p>
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
        <p className="text-xs text-muted-foreground">Was this result helpful?</p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => handleFeedback(true)} disabled={feedbackSent}>
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleFeedback(false)} disabled={feedbackSent}>
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AnalysisResult;