"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";

interface OfficeMapProps {
  lat: number;
  lng: number;
  radius: number;
  userLat?: number | null;
  userLng?: number | null;
  readOnly?: boolean;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function OfficeMap({
  lat,
  lng,
  radius,
  userLat,
  userLng,
  readOnly = false,
  onLocationChange,
}: OfficeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Fix default Leaflet icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current).setView([lat, lng], 16);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Office Marker (Draggable)
    const marker = L.marker([lat, lng], {
      draggable: !readOnly,
    }).addTo(map);
    marker.bindPopup("<b>Lokasi Kantor</b>").openPopup();
    markerRef.current = marker;

    // Radius Circle (Blue transparent)
    const circle = L.circle([lat, lng], {
      color: "#4f8cff",
      fillColor: "#4f8cff",
      fillOpacity: 0.25,
      weight: 2,
      radius: radius,
    }).addTo(map);
    circleRef.current = circle;

    // Map Click Listener
    if (!readOnly) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        marker.setLatLng([newLat, newLng]);
        circle.setLatLng([newLat, newLng]);
        onLocationChange(newLat, newLng);
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        onLocationChange(pos.lat, pos.lng);
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Office Marker and Circle when lat/lng/radius change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radius);
    }
  }, [lat, lng, radius]);

  // Update User Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (userLat && userLng) {
      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `<div style="background-color: #2ee59d; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(46,229,157,0.8);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([userLat, userLng], {
          icon: userIcon,
        }).addTo(mapInstanceRef.current);
        userMarkerRef.current.bindPopup("<b>Posisi Anda Saat Ini</b>");
      } else {
        userMarkerRef.current.setLatLng([userLat, userLng]);
      }
    }
  }, [userLat, userLng]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[400px] sm:h-[480px] rounded-2xl z-10 border border-white/10 overflow-hidden shadow-glow"
    />
  );
}
