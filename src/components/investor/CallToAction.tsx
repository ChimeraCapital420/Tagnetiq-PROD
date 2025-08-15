// FILE: src/components/investor/CallToAction.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export const CallToAction: React.FC = () => {
    const handleRequestMeeting = () => {
        window.location.href = "mailto:invest@tagnetiq.com?subject=Request for Private Investment Meeting with TagnetIQ";
    };

    return (
        <Card className="text-center">
            <CardHeader>
                <CardTitle className="text-2xl">Ready to Invest in the Future?</CardTitle>
                <CardDescription>Join us in building the Bloomberg Terminal for physical assets.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button size="lg" onClick={handleRequestMeeting}>
                    <Mail className="mr-2 h-5 w-5" />
                    Request Private Investment Meeting
                </Button>
            </CardContent>
        </Card>
    );
};