// FILE: src/features/boardroom/components/AccessDenied.tsx
// Access denied screen for unauthorized users

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, Mail } from 'lucide-react';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showContactOption?: boolean;
  returnPath?: string;
  returnLabel?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  title = 'Access Restricted',
  message = 'The Executive Boardroom is a private feature available only to authorized users.',
  showContactOption = true,
  returnPath = '/dashboard',
  returnLabel = 'Return to Dashboard',
}) => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <Card className="border-destructive/50 shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-6">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            {message}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              variant="outline" 
              onClick={() => navigate(returnPath)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {returnLabel}
            </Button>
            
            {showContactOption && (
              <Button 
                variant="secondary"
                onClick={() => window.location.href = 'mailto:support@tagnetiq.com?subject=Boardroom%20Access%20Request'}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                Request Access
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessDenied;