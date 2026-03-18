'use client';

import { useEffect, useRef } from 'react';

interface UserLocation {
  lat: number;
  lng: number;
  label: string;
}

interface StationPoint {
  lat: number;
  lng: number;
  name: string;
  rank: number;
}

interface KakaoMapProps {
  userLocations: UserLocation[];
  stations: StationPoint[];
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

export default function KakaoMap({ userLocations, stations }: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;

    const initMap = () => {
      const allPoints = [
        ...userLocations.map(u => ({ lat: u.lat, lng: u.lng })),
        ...stations.map(s => ({ lat: s.lat, lng: s.lng })),
      ];
      if (allPoints.length === 0) return;

      const centerLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
      const centerLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;

      const map = new window.kakao.maps.Map(mapRef.current, {
        center: new window.kakao.maps.LatLng(centerLat, centerLng),
        level: 7,
      });

      // 유저 위치 마커 (빨간 기본 마커)
      userLocations.forEach((loc) => {
        const marker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(loc.lat, loc.lng),
          map,
        });
        const infowindow = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:5px 8px;font-size:12px;white-space:nowrap;font-weight:bold;">${loc.label}</div>`,
        });
        window.kakao.maps.event.addListener(marker, 'click', () => {
          infowindow.open(map, marker);
        });
      });

      // 추천 지하철역 마커 (번호 스프라이트)
      stations.forEach((station) => {
        const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_number_blue.png';
        const imageSize = new window.kakao.maps.Size(36, 37);
        const imgOptions = {
          spriteSize: new window.kakao.maps.Size(36, 691),
          spriteOrigin: new window.kakao.maps.Point(0, (station.rank - 1) * 46 + 10),
          offset: new window.kakao.maps.Point(13, 37),
        };
        const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imgOptions);
        const marker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(station.lat, station.lng),
          map,
          image: markerImage,
        });
        const infowindow = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:5px 8px;font-size:12px;white-space:nowrap;font-weight:bold;color:#000;">${station.name}</div>`,
        });
        window.kakao.maps.event.addListener(marker, 'click', () => {
          infowindow.open(map, marker);
        });
      });

      // 모든 마커가 보이도록 범위 조정
      if (allPoints.length > 1) {
        const bounds = new window.kakao.maps.LatLngBounds();
        allPoints.forEach(p => bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng)));
        map.setBounds(bounds, 80);
      }
    };

    // kakao SDK가 아직 로드 안 됐을 수 있으므로 폴링
    const tryInit = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(initMap);
      } else {
        setTimeout(tryInit, 200);
      }
    };
    tryInit();
  }, [userLocations, stations]);

  return (
    <div ref={mapRef} className="w-full h-72 rounded-xl overflow-hidden border border-green-200" />
  );
}
