// FILE: src/components/investor/InvestorMap.tsx

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

// Fix for default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

type Metric = 'total_users' | 'beta_testers' | 'high_value_scans';
type GeoPoint = {
    id: string;
    email: string;
    lat: number;
    lon: number;
    last_sign_in_at: string;
};

const MapController: React.FC<{ points: GeoPoint[] }> = ({ points }) => {
    const map = useMap();
    useEffect(() => {
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            map.setView([20, 0], 2);
        }
    }, [points, map]);
    return null;
};


const InvestorMap: React.FC = () => {
    const [metric, setMetric] = useState<Metric>('total_users');
    const [dataPoints, setDataPoints] = useState<GeoPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (metric === 'high_value_scans') {
                toast.info("Data for 'High-Value Scans' is not yet available.");
                setDataPoints([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(`/api/map/data?metric=${metric}`);
                if (!response.ok) throw new Error('Failed to fetch map data.');
                const data = await response.json();
                setDataPoints(data);
            } catch (error) {
                toast.error("Error loading map data", { description: (error as Error).message });
                setDataPoints([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [metric]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Market Heatmap</CardTitle>
                <CardDescription>Real-time visualization of user engagement hotspots.</CardDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant={metric === 'total_users' ? 'default' : 'secondary'} size="sm" onClick={() => setMetric('total_users')}>General Users</Button>
                    <Button variant={metric === 'beta_testers' ? 'default' : 'secondary'} size="sm" onClick={() => setMetric('beta_testers')}>Beta Testers</Button>
                    <Button variant={metric === 'high_value_scans' ? 'default' : 'secondary'} size="sm" onClick={() => setMetric('high_value_scans')} disabled>High-Value Scans</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[450px] w-full rounded-lg overflow-hidden border">
                    {loading ? (
                        <div className="flex items-center justify-center h-full bg-muted">
                            <p>Loading Map Data...</p>
                        </div>
                    ) : (
                        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%', backgroundColor: '#1a1a1a' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />
                            {dataPoints.map(point => (
                                <Marker key={point.id} position={[point.lat, point.lon]}>
                                    <Popup>
                                        <strong>User:</strong> {point.email}<br/>
                                        <strong>Last Seen:</strong> {new Date(point.last_sign_in_at).toLocaleString()}
                                    </Popup>
                                </Marker>
                            ))}
                            <MapController points={dataPoints} />
                        </MapContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default InvestorMap;