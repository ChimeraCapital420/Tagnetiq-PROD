import React from 'react';
import { ReferralCard } from '@/components/beta/ReferralCard';

const BetaReferrals: React.FC = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <ReferralCard />
      </div>
    </div>
  );
};

export default BetaReferrals;