// FILE: src/components/HeatmapLayer.tsx (CREATE THIS NEW FILE)

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import 'leaflet.heat';
import L from 'leaflet';

// Define LatLngExpression array for clarity
type LatLngTuple = [number, number, number];

interface HeatmapLayerProps {
  points: LatLngTuple[];
  radius?: number;
  blur?: number;
  max?: number;
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points, radius, blur, max }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    // The 'any' type is used here as a workaround because the leaflet.heat library
    // dynamically adds the 'heatLayer' method to the L object, and TypeScript's
    // default type definitions for Leaflet don't know about it.
    const heatLayer = (L as any).heatLayer(points, {
      radius: radius || 25,
      blur: blur || 15,
      max: max || 1.0,
    });

    map.addLayer(heatLayer);

    // Cleanup function to remove the layer when the component unmounts or points change
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points, radius, blur, max]); // Re-run effect if props change

  return null; // This component does not render any visible JSX itself
};

export default HeatmapLayer;