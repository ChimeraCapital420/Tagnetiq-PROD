import React from 'react';
import PrivateDashboard from '@/components/PrivateDashboard';
import ContinuousScanner from '@/components/ContinuousScanner';
import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getThemeConfig } from '@/lib/themes';

export default function DemoDashboard() {
  const { isScanning, setIsScanning, theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-50">
        <Link to="/demo">
          <Button
            variant="ghost"
            size="sm"
            className="backdrop-blur-sm"
            style={{ 
              color: themeConfig.colors.text,
              backgroundColor: `${themeConfig.colors.surface}80`
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Demo
          </Button>
        </Link>
      </div>
      
      <PrivateDashboard />
      <ContinuousScanner 
        isOpen={isScanning} 
        onClose={() => setIsScanning(false)} 
      />
    </div>
  );
}