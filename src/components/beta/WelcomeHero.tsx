import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants';

const WelcomeHero: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const handleDownloadPdf = () => {
    // This opens the API endpoint in a new tab to trigger the download or show the placeholder.
    window.open('/api/beta/welcome-pdf', '_blank');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">Welcome to the TagnetIQ Beta</CardTitle>
        <CardDescription>You are currently testing version {APP_VERSION}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-muted/50 rounded-lg text-center space-y-3">
            <div>
                <h3 className="font-semibold">Your Mission</h3>
                <p className="text-sm text-muted-foreground">
                    Your feedback is crucial. Please review the Welcome PDF for a full guide and mission list.
                </p>
            </div>
            <Button variant="outline" onClick={handleDownloadPdf}>
                <Download className="mr-2 h-4 w-4" />
                Download Welcome PDF
            </Button>
        </div>
        <div className="space-y-2">
            <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span>Scan at least 3 items using the camera.</span></div>
            <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span>Explore the different AI categories.</span></div>
            <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span>Submit one piece of feedback (a bug or idea).</span></div>
        </div>
        <Button size="lg" className="w-full" onClick={onStart}>I'm Ready - Start Testing</Button>
      </CardContent>
    </Card>
  );
};

export default WelcomeHero;