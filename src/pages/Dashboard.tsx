import React from 'react';
import PrivateDashboard from '@/components/PrivateDashboard';
import ContinuousScanner from '@/components/ContinuousScanner';
import { useAppContext } from '@/contexts/AppContext';

export default function Dashboard() {
  const { isScanning, setIsScanning } = useAppContext();

  return (
    <>
      <PrivateDashboard />
      <ContinuousScanner 
        isOpen={isScanning} 
        onClose={() => setIsScanning(false)} 
      />
    </>
  );
}