import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvestorInviteForm } from '@/components/admin/investor/InvestorInviteForm';

const Investor: React.FC = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Investor Suite Admin</h1>
          <p className="text-muted-foreground">Manage investor access, track engagement, and view key metrics.</p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2">
            <InvestorInviteForm />
             {/* Placeholder for Investor Analytics */}
            <Card>
                <CardHeader><CardTitle>Engagement Analytics</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">Investor activity will be shown here.</p></CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Investor;