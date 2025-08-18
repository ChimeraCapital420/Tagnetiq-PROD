// FILE: src/components/investor/InvestorMap.tsx (REPLACE ENTIRE FILE)

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';
import HeatmapLayer from '@/components/HeatmapLayer'; // <-- Import our new custom component
import { Maximize, Minimize } from 'lucide-react';

type GeoData = [number, number, number];

const InvestorMap: React.FC = () => {
  const [mapData, setMapData] = useState<GeoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'total_users' | 'new_signups' | 'beta_testers'>('total_users');
  const [mapKey, setMapKey] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/map/data?metric=${metric}`);
        if (!response.ok) throw new Error('Failed to fetch map data');
        const data = await response.json();
        setMapData(data);
        setMapKey(Date.now());
      } catch (error) {
        toast.error("Map Data Error", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, [metric]);

  const toggleFullscreen = () => {
    if (!mapCardRef.current) return;
    if (!document.fullscreenElement) {
      mapCardRef.current.requestFullscreen().catch(err => {
        toast.error("Could not enter fullscreen mode", { description: err.message });
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <Card ref={mapCardRef} className="transition-all duration-300 bg-card">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Market Footprint</CardTitle>
            <CardDescription>Live heatmap of user activity.</CardDescription>
          </div>
          <div className="flex items-center gap-1 no-print">
            {!isFullscreen && (
              <>
                <Button size="sm" variant={metric === 'total_users' ? 'default' : 'outline'} onClick={() => setMetric('total_users')}>Total</Button>
                <Button size="sm" variant={metric === 'new_signups' ? 'default' : 'outline'} onClick={() => setMetric('new_signups')}>New</Button>
                <Button size="sm" variant={metric === 'beta_testers' ? 'default' : 'outline'} onClick={() => setMetric('beta_testers')}>Beta</Button>
              </>
            )}
            <Button size="icon" variant="outline" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`w-full p-0 ${isFullscreen ? 'h-[90vh]' : 'h-96'}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading Map...</div>
        ) : (
          <MapContainer
            key={mapKey}
            center={[39.8283, -98.5795]}
            zoom={isFullscreen ? 5 : 4}
            style={{ height: '100%', width: '100%', backgroundColor: '#1C1C1C' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {mapData.length > 0 && (
              <HeatmapLayer
                points={mapData}
                radius={25}
                blur={20}
                max={1.0}
              />
            )}
          </MapContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default InvestorMap;