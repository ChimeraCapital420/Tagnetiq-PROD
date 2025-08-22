// FILE: src/pages/InvestorSuite.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, UserPlus } from 'lucide-react';
import { KpiCards } from '@/components/investor/KpiCards';
import { FunnelChart } from '@/components/investor/FunnelChart';
import { DocsShelf } from '@/components/investor/DocsShelf';
import { ArenaGrowthMetrics } from '@/components/investor/ArenaGrowthMetrics';
import { LiveFeed } from '@/components/investor/LiveFeed';
import { SentimentChart } from '@/components/investor/SentimentChart';
import { TopFeatures } from '@/components/investor/TopFeatures';

const InvestorSuite: React.FC = () => {
  const handlePrint = () => { window.print(); };

  return (
    <div className="container mx-auto p-4 md:p-8 investor-suite-page">
      {/* This style block specifically fixes the background issue */}
      <style>{`
        .investor-suite-page { background: transparent !important; }
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none; }
        }
      `}</style>
      <div className="printable-area space-y-8">
        <div className="flex justify-between items-center no-print">
          <div>
            <h1 className="text-3xl font-bold">Investor Suite Dashboard</h1>
            <p className="text-muted-foreground">Real-time metrics and growth projections for TagnetIQ.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
                <Link to="/admin/investors/manage">
                    <UserPlus className="mr-2 h-4 w-4" /> Manage Invites
                </Link>
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Export One-Pager
            </Button>
          </div>
        </div>
        
        <KpiCards />
        <ArenaGrowthMetrics />
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <LiveFeed />
            <SentimentChart />
            <TopFeatures />
        </div>
        
        <div className="grid gap-8 md:grid-cols-2">
            <FunnelChart />
            <DocsShelf />
        </div>

      </div>
    </div>
  );
};

export default InvestorSuite;
