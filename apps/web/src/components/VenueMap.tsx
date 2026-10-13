import { useEffect, useRef, useState } from 'react';
import {
  Map as LibreMap,
  setWorkerUrl,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Venue } from '@matchplay/shared/game';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
setWorkerUrl(workerUrl);

type Props = {
  venues: Venue[];
  selected: string | null;
  origin: [number, number];
  onSelect: (id: string) => void;
  onBounds: (bounds: string) => void;
};
const geojson = (venues: Venue[], selected: string | null): FeatureCollection => ({
  type: 'FeatureCollection',
  features: venues.map((v) => ({
    type: 'Feature',
    properties: {
      id: v.id,
      selected: v.id === selected,
      live: v.matches.some((m) => m.status === 'live'),
    },
    geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
  })),
});
export default function VenueMap({ venues, selected, origin, onSelect, onBounds }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const focused = useRef<string | null>(null);
  const callbacks = useRef({ onSelect, onBounds });
  const data = useRef(geojson(venues, selected));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    callbacks.current = { onSelect, onBounds };
  }, [onSelect, onBounds]);
  useEffect(() => {
    data.current = geojson(venues, selected);
    (map.current?.getSource('venues') as GeoJSONSource | undefined)?.setData(data.current);
  }, [venues, selected, ready]);
  useEffect(() => {
    if (!container.current) return;
    const instance = new LibreMap({
      container: container.current,
      style: '/map/style.json',
      center: [24.113, 56.9645],
      zoom: 11.8,
      minZoom: 6,
      maxZoom: 18,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    instance.on('load', () => {
      instance.addSource('venues', {
        type: 'geojson',
        data: data.current,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 28,
      });
      instance.addLayer({
        id: 'venue-clusters',
        type: 'circle',
        source: 'venues',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': 22,
          'circle-color': '#FC4C02',
          'circle-stroke-color': '#12131C',
          'circle-stroke-width': 3,
        },
      });
      instance.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'venues',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#FFFFFF' },
      });
      instance.addLayer({
        id: 'venue-halo',
        type: 'circle',
        source: 'venues',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 28, 21],
          'circle-color': '#FC4C02',
          'circle-opacity': 0.16,
        },
      });
      instance.addLayer({
        id: 'venue-points',
        type: 'circle',
        source: 'venues',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 17, 13],
          'circle-color': ['case', ['get', 'selected'], '#FC4C02', '#12131C'],
          'circle-stroke-color': '#FC4C02',
          'circle-stroke-width': 3,
        },
      });
      instance.addLayer({
        id: 'venue-symbol',
        type: 'symbol',
        source: 'venues',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': '×',
          'text-font': ['Noto Sans Regular'],
          'text-size': 23,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': ['case', ['get', 'selected'], '#FFFFFF', '#FC4C02'] },
      });
      instance.on('click', 'venue-points', (event: MapMouseEvent) => {
        const feature = instance.queryRenderedFeatures(event.point, {
          layers: ['venue-points'],
        })[0];
        if (feature) callbacks.current.onSelect(String(feature.properties.id));
      });
      instance.on('click', 'venue-clusters', async (event) => {
        const feature = instance.queryRenderedFeatures(event.point, {
          layers: ['venue-clusters'],
        })[0];
        if (feature?.geometry.type !== 'Point') return;
        const zoom = await (instance.getSource('venues') as GeoJSONSource).getClusterExpansionZoom(
          Number(feature.properties.cluster_id),
        );
        instance.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
      });
      for (const layer of ['venue-points', 'venue-clusters']) {
        instance.on('mouseenter', layer, () => {
          instance.getCanvas().style.cursor = 'pointer';
        });
        instance.on('mouseleave', layer, () => {
          instance.getCanvas().style.cursor = '';
        });
      }
      setReady(true);
      const bounds = instance.getBounds();
      callbacks.current.onBounds(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(','),
      );
    });
    instance.on('moveend', () => {
      const b = instance.getBounds();
      callbacks.current.onBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','));
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
  useEffect(() => {
    if (!selected) {
      focused.current = null;
      return;
    }
    const venue = venues.find((v) => v.id === selected);
    if (venue && ready) {
      const key = `${venue.id}:${venue.longitude}:${venue.latitude}`;
      if (focused.current === key) return;
      focused.current = key;
      map.current?.easeTo({
        center: [venue.longitude, venue.latitude],
        zoom: Math.max(13.7, map.current.getZoom()),
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550,
      });
    }
  }, [selected, ready, venues]);
  useEffect(() => {
    if (ready && origin[0] !== 24.105)
      map.current?.easeTo({ center: origin, zoom: 13, duration: 400 });
  }, [origin, ready]);
  return (
    <>
      <div
        className="map-canvas"
        ref={container}
        aria-label="Interactive map of sports venues in Riga"
      />
      {!ready && (
        <div className="map-loading">
          <span className="map-loading-ring" />
          <p>Finding your court…</p>
        </div>
      )}
      {failed && (
        <div className="map-error" role="status">
          Map connection interrupted. You can still browse venues.
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
    </>
  );
}
