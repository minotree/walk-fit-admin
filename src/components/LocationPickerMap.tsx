// src/components/LocationPickerMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
}

const MapRecenter: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

const MapEventsHandler: React.FC<{
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
}> = ({ onChange, disabled }) => {
  useMapEvents({
    click(e) {
      if (!disabled) {
        onChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const LocationPickerMap: React.FC<LocationPickerProps> = ({
  lat,
  lng,
  onChange,
  disabled = false,
}) => {
  const defaultCenter: [number, number] = [37.5665, 126.978];
  const currentCenter: [number, number] =
    lat !== null && lng !== null ? [lat, lng] : defaultCenter;

  const tileUrl =
    import.meta.env.VITE_OSM_TILE_URL ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div style={{ height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
      <MapContainer
        center={currentCenter}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
        />
        <MapEventsHandler onChange={onChange} disabled={disabled} />

        {lat !== null && lng !== null && (
          <>
            <Marker
              position={[lat, lng]}
              draggable={!disabled}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  onChange(position.lat, position.lng);
                },
              }}
            />
            <MapRecenter lat={lat} lng={lng} />
          </>
        )}
      </MapContainer>
    </div>
  );
};