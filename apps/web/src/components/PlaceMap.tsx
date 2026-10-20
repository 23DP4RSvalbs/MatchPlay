import { useEffect, useRef, useState } from 'react';
import {
  Map as LibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

type Point = [number, number];

type Props = {
  center: Point;
  value: Point;
  onChange?: (value: Point) => void;
  className?: string;
};

const toGeoJSON = (value: Point): FeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: value },
    },
  ],
});

export default function PlaceMap({ center, value, onChange, className = '' }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const data = useRef(toGeoJSON(value));
  const initialCenter = useRef(center);
  const change = useRef(onChange);
  const [longitude, latitude] = value;

  useEffect(() => {
    change.current = onChange;
    if (map.current) map.current.getCanvas().style.cursor = onChange ? 'crosshair' : '';
  }, [onChange]);

  useEffect(() => {
    data.current = toGeoJSON([longitude, latitude]);
    (map.current?.getSource('place') as GeoJSONSource | undefined)?.setData(data.current);
    if (ready)
      map.current?.easeTo({
        center: [longitude, latitude],
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
      });
  }, [longitude, latitude, ready]);

  useEffect(() => {
    if (!container.current) return;
    const instance = new LibreMap({
      container: container.current,
      style: '/map/style.json',
      center: initialCenter.current,
      zoom: 14.2,
      minZoom: 6,
      maxZoom: 18,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    instance.on('load', () => {
      instance.addSource('place', {
        type: 'geojson',
        data: data.current,
      });
      instance.addLayer({
        id: 'place-halo',
        type: 'circle',
        source: 'place',
        paint: {
          'circle-radius': 20,
          'circle-color': '#FC4C02',
          'circle-opacity': 0.18,
        },
      });
      instance.addLayer({
        id: 'place-point',
        type: 'circle',
        source: 'place',
        paint: {
          'circle-radius': 10,
          'circle-color': '#FC4C02',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 3,
        },
      });
      instance.on('click', (event: MapMouseEvent) => {
        change.current?.([event.lngLat.lng, event.lngLat.lat]);
      });
      instance.getCanvas().style.cursor = change.current ? 'crosshair' : '';
      setReady(true);
    });
    instance.on('error', (event) => {
      if (event.error.message.includes('fetch') || event.error.message.includes('HTTP'))
        setFailed(true);
    });
    instance.on('idle', () => setFailed(false));
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  return (
    <div className={`place-map ${className}`}>
      <div
        ref={container}
        className="place-map-canvas"
        aria-label={
          onChange ? 'Map for choosing a venue location' : 'Map preview of a venue location'
        }
      />
      {!ready && (
        <div className="map-loading">
          <span className="map-loading-ring" />
          <p>Loading the map…</p>
        </div>
      )}
      {failed && (
        <div className="map-error" role="status">
          Map connection interrupted. You can still use the form.
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
