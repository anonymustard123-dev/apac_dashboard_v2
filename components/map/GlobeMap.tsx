'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMap, {
  MapRef,
  Marker,
  NavigationControl,
  Popup,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  CapturedTamOpportunity,
  CityOpportunityGroup,
  ProductId,
} from '@/types';
import { PRODUCT_CONFIG_BY_ID, PRODUCT_CONFIGS } from '@/lib/products';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const APAC_MAX_BOUNDS: [[number, number], [number, number]] = [
  [65, -50],
  [180, 60],
];

type ViewMode = 'pipeline' | 'tam';

const scaleByValue = (
  value: number,
  maxValue: number,
  minSize: number,
  maxSize: number
) => {
  if (maxValue <= 0) {
    return minSize;
  }

  const ratio = Math.sqrt(Math.max(value, 0) / maxValue);
  return minSize + (maxSize - minSize) * ratio;
};

interface GlobeMapProps {
  cityGroups: CityOpportunityGroup[];
  selectedCityId?: string | null;
  onCitySelect: (cityGroup: CityOpportunityGroup) => void;
  onTamCitySelect: (locationKey: string) => void;
  viewMode: ViewMode;
  tamData: CapturedTamOpportunity[];
  activeProducts: ProductId[];
}

type DisplayWhitespaceOpportunity = CapturedTamOpportunity & {
  displayLatitude: number;
  displayLongitude: number;
};

export function GlobeMap({
  cityGroups,
  selectedCityId,
  onCitySelect,
  onTamCitySelect,
  viewMode,
  tamData,
  activeProducts,
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  const [selectedTamOpportunity, setSelectedTamOpportunity] =
    useState<DisplayWhitespaceOpportunity | null>(null);
  const [hoveredTamOpportunity, setHoveredTamOpportunity] =
    useState<DisplayWhitespaceOpportunity | null>(null);

  const activeProductSet = useMemo(
    () => new Set(activeProducts),
    [activeProducts]
  );

  const pipelineLocationKeys = useMemo(
    () =>
      new Set(
        cityGroups.flatMap((cityGroup) =>
          cityGroup.opportunities.map((opportunity) => opportunity.locationKey)
        )
      ),
    [cityGroups]
  );

  const visibleWhitespace = useMemo<DisplayWhitespaceOpportunity[]>(() => {
    const locationCounts = new Map<string, number>();

    return tamData
      .filter(
        (opportunity) =>
          !opportunity.isCaptured && activeProductSet.has(opportunity.product)
      )
      .map((opportunity) => {
        const key = `${opportunity.locationKey}-${opportunity.product}`;
        const index = locationCounts.get(key) ?? 0;
        locationCounts.set(key, index + 1);

        const hasPipelineAtLocation = pipelineLocationKeys.has(
          opportunity.locationKey
        );
        const productIndex = PRODUCT_CONFIGS.findIndex(
          (product) => product.id === opportunity.product
        );
        const productOffset = (productIndex - 1) * 0.28;
        const columnOffset = hasPipelineAtLocation ? 0.42 : 0;
        const stackOffset = index * 0.08;

        return {
          ...opportunity,
          displayLongitude:
            opportunity.longitude + columnOffset + productOffset + stackOffset,
          displayLatitude:
            opportunity.latitude + (index % 2 === 0 ? 0.05 : -0.05),
        };
      });
  }, [activeProductSet, pipelineLocationKeys, tamData]);

  const maxPipelineValue = useMemo(
    () => Math.max(...cityGroups.map((cityGroup) => cityGroup.totalBidValue), 1),
    [cityGroups]
  );

  const maxWhitespaceValue = useMemo(
    () =>
      Math.max(
        ...visibleWhitespace.map((opportunity) => opportunity['Total Bid Value']),
        1
      ),
    [visibleWhitespace]
  );

  const activeTamOpportunity = hoveredTamOpportunity ?? selectedTamOpportunity;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeMap = () => mapRef.current?.resize();
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(container);
    window.setTimeout(resizeMap, 150);

    return () => resizeObserver.disconnect();
  }, []);

  const handleCityClick = (cityGroup: CityOpportunityGroup) => {
    onCitySelect(cityGroup);
    setSelectedTamOpportunity(null);
    mapRef.current?.flyTo({
      center: [cityGroup.longitude, cityGroup.latitude],
      zoom: cityGroup.opportunities.length > 1 ? 4.8 : 4.1,
      duration: 900,
    });
  };

  const handleTamClick = (opportunity: DisplayWhitespaceOpportunity) => {
    setSelectedTamOpportunity(opportunity);
    onTamCitySelect(opportunity.locationKey);
    mapRef.current?.flyTo({
      center: [opportunity.longitude + 0.35, opportunity.latitude],
      zoom: 4.3,
      duration: 900,
    });
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-bny-navy p-8 text-center">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-bny-primary">
            Mapbox Token Required
          </div>
          <p className="mt-3 max-w-md text-sm text-white/75">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to enable APAC globe
            rendering and city-level pipeline markers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[420px] overflow-hidden bg-black"
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_56%_45%,transparent_0%,rgba(0,36,61,0.2)_46%,rgba(0,0,0,0.72)_100%)]" />
      <ReactMap
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 122,
          latitude: 8,
          zoom: 2.65,
        }}
        maxBounds={APAC_MAX_BOUNDS}
        minZoom={2.35}
        maxZoom={8}
        renderWorldCopies={false}
        dragRotate={false}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        projection="globe"
        style={{ width: '100%', height: '100%' }}
        onLoad={(event) => {
          event.target.setFog({
            color: 'rgb(0, 36, 61)',
            'high-color': 'rgb(45, 155, 173)',
            'horizon-blend': 0.12,
            'space-color': 'rgb(0, 8, 14)',
            'star-intensity': 0.12,
          });
        }}
      >
        <NavigationControl position="bottom-right" showCompass showZoom />
        {cityGroups.map((cityGroup) => {
          const isSelected = selectedCityId === cityGroup.id;
          const count = cityGroup.opportunities.length;
          const dominantProduct =
            PRODUCT_CONFIGS.find(
              (product) => cityGroup.productCounts[product.id] > 0
            ) ?? PRODUCT_CONFIGS[0];
          const isTamMode = viewMode === 'tam';
          const markerSize = scaleByValue(
            cityGroup.totalBidValue,
            maxPipelineValue,
            11,
            23
          );
          const glowSize = markerSize * (isTamMode ? 1.85 : 1.55);

          return (
            <Marker
              key={cityGroup.id}
              longitude={cityGroup.longitude}
              latitude={cityGroup.latitude}
              anchor="center"
            >
              <button
                type="button"
                aria-label={`View ${cityGroup.label} opportunities`}
                onClick={() => handleCityClick(cityGroup)}
                className="group relative grid place-items-center rounded-full transition-transform hover:scale-110"
              >
                <span
                  className={`absolute rounded-full blur-md transition-opacity ${
                    isSelected || isTamMode
                      ? 'opacity-75'
                      : 'opacity-45 group-hover:opacity-65'
                  }`}
                  style={{
                    width: glowSize,
                    height: glowSize,
                    backgroundColor: dominantProduct.color,
                  }}
                />
                {isTamMode && (
                  <span
                    className="absolute rounded-full border shadow-[0_0_22px_rgba(255,255,255,0.35)]"
                    style={{
                      borderColor: dominantProduct.color,
                      height: markerSize + 10,
                      width: markerSize + 10,
                    }}
                  />
                )}
                <span
                  className={`relative grid h-5 w-5 place-items-center rounded-full border-2 font-bold text-white ${
                    isSelected ? 'border-white' : 'border-white/75'
                  }`}
                  style={{
                    backgroundColor: dominantProduct.color,
                    boxShadow: `0 0 24px ${dominantProduct.glow}`,
                    height: markerSize,
                    width: markerSize,
                  }}
                >
                  <span className="sr-only">{cityGroup.label}</span>
                </span>
                <span className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {PRODUCT_CONFIGS.filter(
                    (product) => cityGroup.productCounts[product.id] > 0
                  ).map((product) => (
                    <span
                      key={product.id}
                      className="h-1.5 w-1.5 rounded-full border border-white/60"
                      style={{ backgroundColor: product.color }}
                    />
                  ))}
                </span>
                {count > 1 && (
                  <span className="absolute left-full top-1/2 z-10 ml-1.5 grid h-5 min-w-5 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-bny-navy px-1.5 text-[10px] font-black text-white shadow-lg">
                    {count}
                  </span>
                )}
              </button>
            </Marker>
          );
        })}
        {viewMode === 'tam' &&
          visibleWhitespace.map((opportunity) => {
            const product = PRODUCT_CONFIG_BY_ID[opportunity.product];
            const ringSize = scaleByValue(
              opportunity['Total Bid Value'],
              maxWhitespaceValue,
              15,
              30
            );

            return (
              <Marker
                key={`${opportunity['Oppty ID']}-${opportunity.locationKey}`}
                longitude={opportunity.displayLongitude}
                latitude={opportunity.displayLatitude}
                anchor="center"
              >
                <button
                  type="button"
                  aria-label={`View TAM whitespace opportunity ${opportunity.Client}`}
                  onClick={() => handleTamClick(opportunity)}
                  onMouseEnter={() => setHoveredTamOpportunity(opportunity)}
                  onMouseLeave={() => setHoveredTamOpportunity(null)}
                  className="group relative grid place-items-center rounded-full transition-transform hover:scale-125"
                  style={{ height: ringSize, width: ringSize }}
                >
                  <span
                    className="absolute rounded-full blur-sm opacity-15 transition group-hover:opacity-25"
                    style={{
                      backgroundColor: product.color,
                      height: ringSize * 1.25,
                      width: ringSize * 1.25,
                    }}
                  />
                  <span
                    className="relative rounded-full border bg-transparent opacity-60 transition group-hover:opacity-90"
                    style={{
                      borderColor: product.color,
                      borderStyle: 'dashed',
                      boxShadow: `0 0 ${Math.round(ringSize * 0.28)}px ${product.glow}`,
                      height: ringSize,
                      width: ringSize,
                    }}
                  />
                  <span
                    className="absolute rounded-full opacity-50"
                    style={{
                      backgroundColor: product.color,
                      height: 3,
                      width: 3,
                    }}
                  />
                </button>
              </Marker>
            );
          })}
        {viewMode === 'tam' && activeTamOpportunity && (
          <Popup
            longitude={activeTamOpportunity.displayLongitude}
            latitude={activeTamOpportunity.displayLatitude}
            anchor="top"
            closeButton={Boolean(selectedTamOpportunity)}
            closeOnClick={false}
            onClose={() => setSelectedTamOpportunity(null)}
            offset={16}
            className="bny-map-popup"
          >
            <div className="min-w-52 rounded-xl border border-bny-primary/30 bg-bny-navy/95 p-3 text-white shadow-2xl backdrop-blur-xl">
              <div
                className="text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  color: PRODUCT_CONFIG_BY_ID[activeTamOpportunity.product].color,
                }}
              >
                Market Whitespace
              </div>
              <div className="mt-2 text-sm font-semibold">
                {activeTamOpportunity.Client}
              </div>
              <div className="mt-1 text-xs text-white/65">
                {activeTamOpportunity['Opportunity City']},{' '}
                {activeTamOpportunity['Opportunity Country']}
              </div>
              <div className="mt-3 rounded-lg bg-white/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                  Estimated TAM
                </div>
                <div className="mt-1 text-sm font-bold text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(activeTamOpportunity['Total Bid Value'])}
                </div>
              </div>
            </div>
          </Popup>
        )}
      </ReactMap>

      <div className="pointer-events-none absolute left-6 top-6 z-20 rounded-2xl border border-bny-primary/25 bg-bny-navy/85 px-5 py-4 backdrop-blur-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-bny-primary">
          {viewMode === 'tam' ? 'APAC Whitespace Map' : 'APAC Pipeline Map'}
        </div>
        <div className="mt-1 text-sm text-white/75">
          {viewMode === 'tam'
            ? `${visibleWhitespace.length} whitespace opportunities`
            : `${cityGroups.length} APAC cities mapped`}
        </div>
      </div>
    </div>
  );
}
