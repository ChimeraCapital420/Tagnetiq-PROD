// FILE: src/pages/admin/MapConsole.tsx (COMPLETELY REVISED)

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Fix for default icon issue with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

type Metric = 'total_users' | 'new_signups' | 'beta_testers';
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
            map.setView([20, 0], 2); // Reset to global view if no points
        }
    }, [points, map]);
    return null;
};

const MapConsole: React.FC = () => {
    const [metric, setMetric] = useState<Metric>('total_users');
    const [dataPoints, setDataPoints] = useState<GeoPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/map/data?metric=${metric}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch map data.');
                }
                const data = await response.json();
                setDataPoints(data);
                toast.success(`Loaded ${data.length} data points for "${metric.replace('_', ' ')}".`);
            } catch (error) {
                toast.error("Error loading map data", { description: (error as Error).message });
                setDataPoints([]); // Clear points on error
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [metric]);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-4">
                <div>
                    <h1 className="text-3xl font-bold">Global Activity Map</h1>
                    <p className="text-muted-foreground">Real-time visualization of user engagement.</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <Button variant={metric === 'total_users' ? 'default' : 'outline'} onClick={() => setMetric('total_users')}>Total Users</Button>
                    <Button variant={metric === 'new_signups' ? 'default' : 'outline'} onClick={() => setMetric('new_signups')}>New Sign-ups (96h)</Button>
                    <Button variant={metric === 'beta_testers' ? 'default' : 'outline'} onClick={() => setMetric('beta_testers')}>Beta Testers</Button>
                </div>
                
                <div className="h-[70vh] w-full rounded-lg overflow-hidden border">
                    {loading ? (
                        <div className="flex items-center justify-center h-full bg-muted">
                            <p>Loading Map Data...</p>
                        </div>
                    ) : (
                        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            </div>
        </div>
    );
};

export default MapConsole;