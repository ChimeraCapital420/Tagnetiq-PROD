import React from 'react';
import { TriageTable } from '@/components/beta/TriageTable';
import { AdminAnalytics } from '@/components/beta/AdminAnalytics';
import { AdminInviteForm } from '@/components/beta/AdminInviteForm';

const BetaConsole: React.FC = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Beta Program Admin Console</h1>
          <p className="text-muted-foreground">Manage testers, review feedback, and monitor program health.</p>
        </div>
        
        <AdminAnalytics />
        
        <div className="grid gap-8 md:grid-cols-2">
          <AdminInviteForm />
           {/* Placeholder for Patch Notes Editor */}
           <div className="p-4 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Patch Notes Editor (Coming Soon)</p>
          </div>
        </div>
        
        <TriageTable />
      </div>
    </div>
  );
};

export default BetaConsole;