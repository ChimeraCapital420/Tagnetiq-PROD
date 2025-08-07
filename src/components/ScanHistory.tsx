import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';

interface ScanHistoryProps {
  scans?: Array<{
    id: string;
    code: string;
    decision: string;
    item: string;
    marketValue: string;
    timestamp: Date;
  }>;
}

const ScanHistory: React.FC<ScanHistoryProps> = ({ scans = [] }) => {
  const { theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);

  // Mock data for demonstration
  const mockScans = [
    {
      id: '1',
      code: '123456789012',
      decision: 'GO',
      item: 'Vintage Nike Sneakers',
      marketValue: '$150.00',
      timestamp: new Date(Date.now() - 300000) // 5 minutes ago
    },
    {
      id: '2', 
      code: '987654321098',
      decision: 'GO',
      item: 'Designer Watch',
      marketValue: '$320.00',
      timestamp: new Date(Date.now() - 600000) // 10 minutes ago
    }
  ];

  const displayScans = scans.length > 0 ? scans : mockScans;

  return (
    <Card 
      className="w-full"
      style={{ 
        backgroundColor: themeConfig.colors.surface,
        borderColor: themeConfig.colors.border
      }}
    >
      <CardHeader>
        <CardTitle 
          style={{ 
            color: themeConfig.colors.text,
            fontFamily: themeConfig.fonts.heading
          }}
        >
          Recent Scans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayScans.length === 0 ? (
          <p style={{ color: themeConfig.colors.textSecondary }}>
            No scans yet. Start scanning to see your history!
          </p>
        ) : (
          displayScans.map((scan) => (
            <div 
              key={scan.id}
              className="flex items-center justify-between p-3 rounded-lg border"
              style={{ 
                backgroundColor: themeConfig.colors.background,
                borderColor: themeConfig.colors.border
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant={scan.decision === 'GO' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {scan.decision}
                  </Badge>
                  <span 
                    className="text-sm font-medium"
                    style={{ color: themeConfig.colors.text }}
                  >
                    {scan.item}
                  </span>
                </div>
                <p 
                  className="text-xs"
                  style={{ color: themeConfig.colors.textSecondary }}
                >
                  Code: {scan.code}
                </p>
              </div>
              <div className="text-right">
                <p 
                  className="font-semibold"
                  style={{ color: themeConfig.colors.primary }}
                >
                  {scan.marketValue}
                </p>
                <p 
                  className="text-xs"
                  style={{ color: themeConfig.colors.textSecondary }}
                >
                  {scan.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ScanHistory;