import React from 'react';
import { MissionList } from '@/components/beta/MissionList';

const BetaMissions: React.FC = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <MissionList />
      </div>
    </div>
  );
};

export default BetaMissions;