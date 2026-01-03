import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// 📍 COMPLETE COORDINATES FOR ALL 47 COUNTIES
const LOCATIONS = {
  "Baringo": [0.6698, 35.9525],
  "Bomet": [-0.7933, 35.3421],
  "Bungoma": [0.5695, 34.5584],
  "Busia": [0.4608, 34.1115],
  "Elgeyo-Marakwet": [0.8000, 35.5000],
  "Embu": [-0.5380, 37.4589],
  "Garissa": [-0.4532, 39.6460],
  "Homa Bay": [-0.5273, 34.4571],
  "Isiolo": [0.3546, 37.5822],
  "Kajiado": [-1.8524, 36.7768],
  "Kakamega": [0.2827, 34.7519],
  "Kericho": [-0.3692, 35.2839],
  "Kiambu": [-1.1717, 36.8356],
  "Kilifi": [-3.6307, 39.8499],
  "Kirinyaga": [-0.5061, 37.2796],
  "Kisii": [-0.6773, 34.7796],
  "Kisumu": [-0.0917, 34.7680],
  "Kitui": [-1.3746, 38.0106],
  "Kwale": [-4.1744, 39.4607],
  "Laikipia": [0.0097, 36.9036],
  "Lamu": [-2.2717, 40.9020],
  "Machakos": [-1.5177, 37.2634],
  "Makueni": [-1.8041, 37.6203],
  "Mandera": [3.9373, 41.8569],
  "Marsabit": [2.3337, 37.9902],
  "Meru": [0.0463, 37.6559],
  "Migori": [-1.0667, 34.4667],
  "Mombasa": [-4.0435, 39.6682],
  "Murang'a": [-0.7167, 37.1500],
  "Nairobi": [-1.2921, 36.8219],
  "Nakuru": [-0.3031, 36.0800],
  "Nandi": [0.1833, 35.1167],
  "Narok": [-1.0783, 35.8601],
  "Nyamira": [-0.5633, 34.9358],
  "Nyandarua": [-0.1800, 36.3700],
  "Nyeri": [-0.4169, 36.9510],
  "Samburu": [1.2667, 36.6833],
  "Siaya": [0.0626, 34.2878],
  "Taita Taveta": [-3.3167, 38.4833],
  "Tana River": [-1.5000, 40.0000],
  "Tharaka-Nithi": [-0.2970, 37.8732],
  "Trans Nzoia": [1.0167, 35.0000],
  "Turkana": [3.1167, 35.6000],
  "Uasin Gishu": [0.5167, 35.2833],
  "Vihiga": [0.0833, 34.7167],
  "Wajir": [1.7471, 40.0573],
  "West Pokot": [1.2333, 35.1167],
  "Default": [-1.2921, 36.8219]
};

// 🛡️ Privacy Jitter (Adds ~500m-1km random offset)
const getFuzzedCoordinates = (locationName) => {
  // Normalize string to match keys (e.g. "Nairobi" instead of "Nairobi, Westlands")
  // You might want to enhance this logic later
  const key = Object.keys(LOCATIONS).find(k => locationName.includes(k)) || 'Default';
  const center = LOCATIONS[key];

  const lat = center[0] + (Math.random() - 0.5) * 0.05; 
  const lng = center[1] + (Math.random() - 0.5) * 0.05;
  return [lat, lng];
};

// 🔥 Heatmap Layer
const HeatmapLayer = ({ data }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !data.length) return;

    // Log to confirm updates are happening
    console.log(`🗺️ Redrawing Heatmap with ${data.length} points`);

    const points = data.map(patient => {
      const loc = patient.location || 'Default';
      const [lat, lng] = getFuzzedCoordinates(loc);
      
      let intensity = 0.3; // Default Green
      if (patient.triage_category === 'RED') intensity = 1.0;
      if (patient.triage_category === 'YELLOW') intensity = 0.6;

      return [lat, lng, intensity];
    });

    const heat = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 10,
      gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'orange', 1.0: 'red' }
    }).addTo(map);

    // CLEANUP: Remove old layer when data changes!
    return () => {
      map.removeLayer(heat);
    };
  }, [map, data]); // <--- This dependency array ensures re-run on data change

  return null;
};

const DiseaseMap = ({ patients }) => {
  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #374151', zIndex: 0 }}>
      <MapContainer 
        center={[-0.0236, 37.9062]} 
        zoom={6} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <HeatmapLayer data={patients} />
      </MapContainer>
    </div>
  );
};

export default DiseaseMap;