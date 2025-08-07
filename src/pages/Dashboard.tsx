import React from 'react';
import PrivateDashboard from '@/components/PrivateDashboard';
import DualScanner from '@/components/DualScanner'; // Updated import
import { useAppContext } from '@/contexts/AppContext';

export default function Dashboard() {
  const { isScanning, setIsScanning } = useAppContext();

  return (
    <>
      <PrivateDashboard />
      <DualScanner 
        isOpen={isScanning} 
        onClose={() => setIsScanning(false)} 
      />
    </>
  );
}