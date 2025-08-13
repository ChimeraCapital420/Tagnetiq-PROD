import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { getCategoryColors } from '@/lib/categoryColors';

interface FlipAlert {
  id: string;
  name: string;
  image: string;
  roi: number;
  timeAgo: string;
  category: string;
}

const InstantFlipAlerts: React.FC = () => {
  const { selectedCategory, theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);
  const categoryColors = getCategoryColors(selectedCategory);
  
  const mockAlerts: FlipAlert[] = [
    {
      id: '1',
      name: 'LEGO Millennium Falcon 75257',
      image: 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png',
      roi: 145,
      timeAgo: '2m ago',
      confidence: 92
    },
    {
      id: '2',
      name: 'Vintage Star Wars Boba Fett',
      image: 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png',
      roi: 230,
      timeAgo: '5m ago',
      confidence: 88
    },
    {
      id: '3',
      name: 'Nintendo Switch OLED',
      image: 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png',
      roi: 85,
      timeAgo: '8m ago',
      confidence: 95
    },
    {
      id: '4',
      name: 'Apple Watch Series 8',
      image: 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png',
      roi: 120,
      timeAgo: '12m ago',
      confidence: 90
    },
    {
      id: '5',
      name: 'Jordan 1 Retro High OG',
      image: 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png',
      roi: 180,
      timeAgo: '15m ago',
      category: 'Fashion'
    }
  ];

  const getRoiColor = (roi: number) => {
    if (roi >= 200) return { bg: themeConfig.colors.success, text: themeConfig.colors.text };
    if (roi >= 100) return { bg: '#f59e0b', text: '#000000' };
    return { bg: '#f97316', text: '#ffffff' };
  };

  const getAlertItemStyle = () => {
    if (theme === 'matrix') {
      return {
        backgroundColor: `${themeConfig.colors.primary}10`,
        border: `1px solid ${themeConfig.colors.primary}20`,
        transition: 'all 0.3s ease'
      };
    }
    if (theme === 'executive') {
      return {
        backgroundColor: `${themeConfig.colors.surface}60`,
        border: `1px solid ${themeConfig.colors.border}30`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
      };
    }
    return {
      backgroundColor: `${categoryColors.primary}10`,
      border: `1px solid ${categoryColors.primary}20`
    };
  };

  return (
    <Card 
      className="backdrop-blur-sm border"
      style={{
        backgroundColor: `${themeConfig.colors.surface}90`,
        borderColor: `${themeConfig.colors.border}50`,
        color: themeConfig.colors.text
      }}
    >
      <CardHeader>
        <CardTitle 
          className="flex items-center"
          style={{ 
            color: themeConfig.colors.text,
            fontFamily: themeConfig.fonts.heading
          }}
        >
          <TrendingUp 
            className="w-5 h-5 mr-2" 
            style={{ color: categoryColors.accent }}
          />
          Instant Flip Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {mockAlerts.map((alert) => {
            const roiColors = getRoiColor(alert.roi);
            return (
              <div
                key={alert.id}
                className="flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 cursor-pointer hover:scale-[1.02]"
                style={getAlertItemStyle()}
              >
                <img
                  src={alert.image}
                  alt={alert.name}
                  className="w-12 h-12 rounded-lg object-cover"
                  style={{ backgroundColor: themeConfig.colors.secondary }}
                />
                <div className="flex-1 min-w-0">
                  <h4 
                    className="font-medium text-sm truncate"
                    style={{ color: themeConfig.colors.text }}
                  >
                    {alert.name}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{
                        borderColor: `${categoryColors.primary}50`,
                        color: categoryColors.primary,
                        backgroundColor: `${categoryColors.primary}10`
                      }}
                    >
                      {alert.category}
                    </Badge>
                    <span 
                      className="text-xs flex items-center"
                      style={{ color: themeConfig.colors.textSecondary }}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {alert.timeAgo}
                    </span>
                  </div>
                </div>
                <Badge 
                  className="font-bold"
                  style={{
                    backgroundColor: roiColors.bg,
                    color: roiColors.text
                  }}
                >
                  {alert.roi}% ROI
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default InstantFlipAlerts;