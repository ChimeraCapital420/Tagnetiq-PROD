// src/pages/Feedback.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { APP_VERSION } from '@/lib/constants';

const Feedback: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Submit Feedback</CardTitle>
          <CardDescription>We'd love to hear your thoughts on TagnetIQ version {APP_VERSION}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback">Your Message</Label>
            <Textarea id="feedback" placeholder="Tell us what you think..." />
          </div>
          <Button>Submit Feedback</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Feedback;