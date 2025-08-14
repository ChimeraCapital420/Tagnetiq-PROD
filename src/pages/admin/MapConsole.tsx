import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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


const MapConsole: React.FC = () => {
  // Centered on a neutral location for a global view
  const position: L.LatLngExpression = [20, 0]; 

  return (
    <div className="container mx-auto p-4 md:p-8">
       <div>
          <h1 className="text-3xl font-bold">Global Activity Map</h1>
          <p className="text-muted-foreground">Real-time visualization of user engagement and market data.</p>
        </div>
      <div className="mt-4 h-[70vh] w-full rounded-lg overflow-hidden border">
        <MapContainer center={position} zoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Example Marker */}
          <Marker position={[51.505, -0.09]}>
            <Popup>
              A sample data point. <br /> London, UK.
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default MapConsole;