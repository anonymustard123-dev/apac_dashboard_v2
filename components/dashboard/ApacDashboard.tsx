'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  DollarSign,
  Globe2,
  MapPin,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { GlobeMap } from '@/components/map/GlobeMap';
import { fetchTamCsv, parsePipelineCsvFile } from '@/lib/csv-data';
import { geocodeOpportunities, geocodeRecordsByLocation } from '@/lib/geocoding';
import { groupOpportunitiesByCity } from '@/lib/pipeline-groups';
import { PRODUCT_CONFIG_BY_ID, PRODUCT_CONFIGS } from '@/lib/products';
import {
  CapturedTamOpportunity,
  CityOpportunityGroup,
  GeocodedPipelineOpportunity,
  GeocodedTamOpportunity,
  ProductId,
  ProductPipelineOpportunity,
} from '@/types';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const HIGH_PROBABILITY_THRESHOLD = 30;
const SAMPLE_PIPELINE_BY_PRODUCT: Record<ProductId, string> = {
  dac: '/data/dac_pipeline.csv',
  stablecoin: '/data/stablecoin_pipeline.csv',
  tokenizedFunds: '/data/tokenized_funds_pipeline.csv',
};

type ViewMode = 'pipeline' | 'tam';

interface ProductMetric {
  pipelineValue: number;
  opportunityCount: number;
  whitespaceValue: number;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatCompactCurrency = (value: number) =>
  compactCurrencyFormatter.format(value);

const sortText = (values: string[]) =>
  values.filter(Boolean).sort((a, b) => a.localeCompare(b));

const createEmptyProductRecord = <T,>(value: T): Record<ProductId, T> => ({
  dac: value,
  stablecoin: value,
  tokenizedFunds: value,
});

const stageColorMap = {
  'Contract Signed': {
    border: 'border-l-emerald-400',
    badge: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/30',
  },
  'Verbal Mandate': {
    border: 'border-l-blue-400',
    badge: 'bg-blue-400/10 text-blue-200 ring-blue-400/30',
  },
  Propose: {
    border: 'border-l-purple-400',
    badge: 'bg-purple-400/10 text-purple-200 ring-purple-400/30',
  },
  Solution: {
    border: 'border-l-amber-300',
    badge: 'bg-amber-300/10 text-amber-100 ring-amber-300/30',
  },
  'Qualify originate': {
    border: 'border-l-slate-300',
    badge: 'bg-slate-300/10 text-slate-200 ring-slate-300/30',
  },
  Whitespace: {
    border: 'border-l-white/60',
    badge: 'bg-white/10 text-white ring-white/25',
  },
} as const;

const defaultStageColors = {
  border: 'border-l-white/25',
  badge: 'bg-white/10 text-white/75 ring-white/20',
};

const getStageColors = (stage: string) =>
  stageColorMap[stage as keyof typeof stageColorMap] ?? defaultStageColors;

export function ApacDashboard() {
  const [opportunitiesByProduct, setOpportunitiesByProduct] = useState<
    Record<ProductId, ProductPipelineOpportunity[]>
  >(createEmptyProductRecord<ProductPipelineOpportunity[]>([]));
  const [geocodedByProduct, setGeocodedByProduct] = useState<
    Record<ProductId, GeocodedPipelineOpportunity[]>
  >(createEmptyProductRecord<GeocodedPipelineOpportunity[]>([]));
  const [tamData, setTamData] = useState<GeocodedTamOpportunity[]>([]);
  const [activeProducts, setActiveProducts] = useState<ProductId[]>(
    PRODUCT_CONFIGS.map((product) => product.id)
  );
  const [uploadProduct, setUploadProduct] = useState<ProductId>('dac');
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [statusFilter, setStatusFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [minimumProbability, setMinimumProbability] = useState(0);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(
    null
  );
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<GeocodedPipelineOpportunity | null>(null);
  const [loadingProduct, setLoadingProduct] = useState<ProductId | null>(null);
  const [geocodingProduct, setGeocodingProduct] = useState<ProductId | null>(null);
  const [tamLoading, setTamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTamData() {
      try {
        setTamLoading(true);
        const geocodedGroups = await Promise.all(
          PRODUCT_CONFIGS.map(async (product) => {
            const rows = await fetchTamCsv(product.tamCsvPath, product.id);
            return geocodeRecordsByLocation(
              rows,
              MAPBOX_TOKEN,
              (opportunity) => opportunity['Opportunity City'],
              (opportunity) => opportunity['Opportunity Country']
            );
          })
        );

        if (isActive) {
          setTamData(geocodedGroups.flat());
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load APAC TAM data'
          );
        }
      } finally {
        if (isActive) {
          setTamLoading(false);
        }
      }
    }

    loadTamData();

    return () => {
      isActive = false;
    };
  }, []);

  const allOpportunities = useMemo(
    () => PRODUCT_CONFIGS.flatMap((product) => opportunitiesByProduct[product.id]),
    [opportunitiesByProduct]
  );

  const allGeocodedOpportunities = useMemo(
    () => PRODUCT_CONFIGS.flatMap((product) => geocodedByProduct[product.id]),
    [geocodedByProduct]
  );

  const activeProductSet = useMemo(
    () => new Set(activeProducts),
    [activeProducts]
  );

  const activeOpportunities = useMemo(
    () =>
      allOpportunities.filter((opportunity) =>
        activeProductSet.has(opportunity.product)
      ),
    [activeProductSet, allOpportunities]
  );

  const handlePipelineUpload = async (file: File, product: ProductId) => {
    try {
      setLoadingProduct(product);
      setGeocodingProduct(null);
      setError(null);
      setSelectedLocationKey(null);
      setSelectedOpportunity(null);

      const data = await parsePipelineCsvFile(file, product);
      setOpportunitiesByProduct((current) => ({
        ...current,
        [product]: data,
      }));

      setGeocodingProduct(product);
      const geocoded = await geocodeOpportunities(data, MAPBOX_TOKEN);
      setGeocodedByProduct((current) => ({
        ...current,
        [product]: geocoded,
      }));
    } catch (loadError) {
      setOpportunitiesByProduct((current) => ({
        ...current,
        [product]: [],
      }));
      setGeocodedByProduct((current) => ({
        ...current,
        [product]: [],
      }));
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to parse pipeline CSV'
      );
    } finally {
      setLoadingProduct(null);
      setGeocodingProduct(null);
    }
  };

  const handleClearProduct = (product: ProductId) => {
    setOpportunitiesByProduct((current) => ({ ...current, [product]: [] }));
    setGeocodedByProduct((current) => ({ ...current, [product]: [] }));
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
    setError(null);
  };

  const handleClearAll = () => {
    setOpportunitiesByProduct(createEmptyProductRecord<ProductPipelineOpportunity[]>([]));
    setGeocodedByProduct(createEmptyProductRecord<GeocodedPipelineOpportunity[]>([]));
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
    setStatusFilter('All');
    setOwnerFilter('All');
    setCountryFilter('All');
    setMinimumProbability(0);
    setError(null);
  };

  const handleToggleProduct = (product: ProductId) => {
    setActiveProducts((current) => {
      if (current.includes(product)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== product);
      }

      return [...current, product];
    });
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
  };

  const statuses = useMemo(
    () =>
      sortText(Array.from(new Set(activeOpportunities.map((item) => item.Status)))),
    [activeOpportunities]
  );

  const owners = useMemo(
    () =>
      sortText(Array.from(new Set(activeOpportunities.map((item) => item.Owner)))),
    [activeOpportunities]
  );

  const countries = useMemo(
    () =>
      sortText(
        Array.from(
          new Set(
            activeOpportunities.map((item) => item['Opportunity Country'])
          )
        )
      ),
    [activeOpportunities]
  );

  const filteredOpportunities = useMemo(
    () =>
      activeOpportunities.filter((opportunity) => {
        const matchesStatus =
          statusFilter === 'All' || opportunity.Status === statusFilter;
        const matchesOwner =
          ownerFilter === 'All' || opportunity.Owner === ownerFilter;
        const matchesCountry =
          countryFilter === 'All' ||
          opportunity['Opportunity Country'] === countryFilter;
        const matchesProbability =
          opportunity.Probability >= minimumProbability;

        return (
          matchesStatus &&
          matchesOwner &&
          matchesCountry &&
          matchesProbability
        );
      }),
    [
      activeOpportunities,
      countryFilter,
      minimumProbability,
      ownerFilter,
      statusFilter,
    ]
  );

  const filteredGeocodedOpportunities = useMemo(() => {
    const filteredIds = new Set(
      filteredOpportunities.map((opportunity) => opportunity['Oppty ID'])
    );

    return allGeocodedOpportunities.filter(
      (opportunity) =>
        activeProductSet.has(opportunity.product) &&
        filteredIds.has(opportunity['Oppty ID'])
    );
  }, [activeProductSet, allGeocodedOpportunities, filteredOpportunities]);

  const cityGroups = useMemo(
    () => groupOpportunitiesByCity(filteredGeocodedOpportunities),
    [filteredGeocodedOpportunities]
  );

  const capturedTamData = useMemo<CapturedTamOpportunity[]>(() => {
    const pipelineClients = new Set(
      allOpportunities.map(
        (opportunity) =>
          `${opportunity.product}:${opportunity.Client.trim().toLowerCase()}`
      )
    );

    return tamData.map((opportunity) => ({
      ...opportunity,
      isCaptured: pipelineClients.has(
        `${opportunity.product}:${opportunity.Client.trim().toLowerCase()}`
      ),
    }));
  }, [allOpportunities, tamData]);

  const activeTamData = useMemo(
    () =>
      capturedTamData.filter((opportunity) =>
        activeProductSet.has(opportunity.product)
      ),
    [activeProductSet, capturedTamData]
  );

  const selectedCity = useMemo(
    () =>
      cityGroups.find((group) =>
        group.opportunities.some(
          (opportunity) => opportunity.locationKey === selectedLocationKey
        )
      ) ?? null,
    [cityGroups, selectedLocationKey]
  );

  const selectedWhitespaceOpportunities = useMemo(
    () =>
      viewMode === 'tam' && selectedLocationKey
        ? activeTamData.filter(
            (opportunity) =>
              !opportunity.isCaptured &&
              opportunity.locationKey === selectedLocationKey
          )
        : [],
    [activeTamData, selectedLocationKey, viewMode]
  );

  const kpis = useMemo(() => {
    const totalPipelineValue = filteredOpportunities.reduce(
      (sum, opportunity) => sum + opportunity['Total Bid Value'],
      0
    );
    const highProbabilityValue = filteredOpportunities
      .filter((opportunity) => opportunity.Probability > HIGH_PROBABILITY_THRESHOLD)
      .reduce((sum, opportunity) => sum + opportunity['Total Bid Value'], 0);
    const whitespaceValue = activeTamData
      .filter((opportunity) => !opportunity.isCaptured)
      .reduce((sum, opportunity) => sum + opportunity['Total Bid Value'], 0);

    return {
      totalPipelineValue,
      activeOpportunities: filteredOpportunities.length,
      highProbabilityValue,
      whitespaceValue,
    };
  }, [activeTamData, filteredOpportunities]);

  const productMetrics = useMemo<Record<ProductId, ProductMetric>>(() => {
    const matchesGlobalFilters = (opportunity: ProductPipelineOpportunity) => {
      const matchesStatus =
        statusFilter === 'All' || opportunity.Status === statusFilter;
      const matchesOwner =
        ownerFilter === 'All' || opportunity.Owner === ownerFilter;
      const matchesCountry =
        countryFilter === 'All' ||
        opportunity['Opportunity Country'] === countryFilter;
      const matchesProbability = opportunity.Probability >= minimumProbability;

      return (
        matchesStatus &&
        matchesOwner &&
        matchesCountry &&
        matchesProbability
      );
    };

    return PRODUCT_CONFIGS.reduce(
      (acc, product) => {
        const productOpportunities = allOpportunities.filter(
          (opportunity) =>
            opportunity.product === product.id && matchesGlobalFilters(opportunity)
        );
        const productWhitespace = capturedTamData.filter(
          (opportunity) =>
            opportunity.product === product.id &&
            !opportunity.isCaptured &&
            (countryFilter === 'All' ||
              opportunity['Opportunity Country'] === countryFilter)
        );

        acc[product.id] = {
          pipelineValue: productOpportunities.reduce(
            (sum, opportunity) => sum + opportunity['Total Bid Value'],
            0
          ),
          opportunityCount: productOpportunities.length,
          whitespaceValue: productWhitespace.reduce(
            (sum, opportunity) => sum + opportunity['Total Bid Value'],
            0
          ),
        };

        return acc;
      },
      {} as Record<ProductId, ProductMetric>
    );
  }, [
    allOpportunities,
    capturedTamData,
    countryFilter,
    minimumProbability,
    ownerFilter,
    statusFilter,
  ]);

  useEffect(() => {
    if (
      selectedLocationKey &&
      !selectedCity &&
      selectedWhitespaceOpportunities.length === 0
    ) {
      setSelectedLocationKey(null);
      setSelectedOpportunity(null);
    }
  }, [selectedCity, selectedLocationKey, selectedWhitespaceOpportunities.length]);

  useEffect(() => {
    if (!selectedOpportunity) return;

    const selectedStillVisible = filteredGeocodedOpportunities.some(
      (opportunity) => opportunity['Oppty ID'] === selectedOpportunity['Oppty ID']
    );

    if (!selectedStillVisible) {
      setSelectedOpportunity(null);
    }
  }, [filteredGeocodedOpportunities, selectedOpportunity]);

  const handleCitySelect = (cityGroup: CityOpportunityGroup) => {
    setSelectedLocationKey(cityGroup.opportunities[0]?.locationKey ?? cityGroup.id);
    setSelectedOpportunity(null);
  };

  const handleBackToRegional = () => {
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
  };

  const handleTamCitySelect = (locationKey: string) => {
    setSelectedLocationKey(locationKey);
    setSelectedOpportunity(null);
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-bny-navy text-white">
      <div
        className={`grid h-full min-h-0 ${
          isPresentationMode
            ? 'grid-cols-1'
            : 'lg:grid-cols-[440px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)]'
        }`}
      >
        {!isPresentationMode && (
          <aside className="flex min-h-0 flex-col border-r border-bny-astronaut bg-bny-navy">
            <SidebarHeader
              hasData={allOpportunities.length > 0}
              uploadProduct={uploadProduct}
              onUploadProductChange={setUploadProduct}
              onFileUpload={handlePipelineUpload}
              onClearProduct={handleClearProduct}
              onClearAll={handleClearAll}
              onPresentationMode={() => setIsPresentationMode(true)}
              loadingProduct={loadingProduct}
              geocodingProduct={geocodingProduct}
            />

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {error && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-bny-accent/50 bg-bny-accent/15 px-4 py-3 text-sm text-white">
                  <AlertCircle className="h-5 w-5 text-bny-accent" />
                  <span>
                    {error}. Upload a valid product pipeline CSV and try again.
                  </span>
                </div>
              )}

              {selectedOpportunity ? (
                <OpportunityDetailView
                  opportunity={selectedOpportunity}
                  city={selectedCity}
                  onBack={() => setSelectedOpportunity(null)}
                  onRegional={handleBackToRegional}
                />
              ) : selectedCity || selectedWhitespaceOpportunities.length > 0 ? (
                <CityView
                  city={selectedCity}
                  whitespaceOpportunities={selectedWhitespaceOpportunities}
                  viewMode={viewMode}
                  onBack={handleBackToRegional}
                  onOpportunitySelect={setSelectedOpportunity}
                />
              ) : (
                <GlobalView
                  statuses={statuses}
                  owners={owners}
                  countries={countries}
                  statusFilter={statusFilter}
                  ownerFilter={ownerFilter}
                  countryFilter={countryFilter}
                  minimumProbability={minimumProbability}
                  onStatusChange={setStatusFilter}
                  onOwnerChange={setOwnerFilter}
                  onCountryChange={setCountryFilter}
                  onProbabilityChange={setMinimumProbability}
                  activeProducts={activeProducts}
                  onToggleProduct={handleToggleProduct}
                  productMetrics={productMetrics}
                  cityGroups={cityGroups}
                  kpis={kpis}
                  mappedCount={filteredGeocodedOpportunities.length}
                  viewMode={viewMode}
                  onViewModeChange={handleViewModeChange}
                  tamCount={activeTamData.length}
                  capturedTamCount={
                    activeTamData.filter((opportunity) => opportunity.isCaptured)
                      .length
                  }
                  tamLoading={tamLoading}
                  opportunitiesByProduct={opportunitiesByProduct}
                />
              )}
            </div>
          </aside>
        )}

        <section className="relative min-h-0">
          {isPresentationMode && (
            <button
              type="button"
              onClick={() => setIsPresentationMode(false)}
              className="absolute right-6 top-6 z-30 rounded-full border border-bny-primary/40 bg-bny-navy/85 px-5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-bny-teal shadow-2xl backdrop-blur-xl transition hover:bg-bny-primary/20 hover:text-white"
            >
              Show Controls
            </button>
          )}
          <GlobeMap
            cityGroups={cityGroups}
            selectedCityId={selectedCity?.id ?? null}
            onCitySelect={handleCitySelect}
            onTamCitySelect={handleTamCitySelect}
            viewMode={viewMode}
            tamData={capturedTamData}
            activeProducts={activeProducts}
          />
        </section>
      </div>
    </main>
  );
}

interface SidebarHeaderProps {
  hasData: boolean;
  uploadProduct: ProductId;
  onUploadProductChange: (product: ProductId) => void;
  onFileUpload: (file: File, product: ProductId) => void;
  onClearProduct: (product: ProductId) => void;
  onClearAll: () => void;
  onPresentationMode: () => void;
  loadingProduct: ProductId | null;
  geocodingProduct: ProductId | null;
}

function SidebarHeader({
  hasData,
  uploadProduct,
  onUploadProductChange,
  onFileUpload,
  onClearProduct,
  onClearAll,
  onPresentationMode,
  loadingProduct,
  geocodingProduct,
}: SidebarHeaderProps) {
  const activeProduct = PRODUCT_CONFIG_BY_ID[uploadProduct];
  const isLoading = loadingProduct === uploadProduct;
  const isGeocoding = geocodingProduct === uploadProduct;

  return (
    <div className="border-b border-bny-astronaut px-6 py-6">
      <Image
        src="/bny-logo.svg"
        alt="BNY"
        width={240}
        height={69}
        priority
        className="h-auto w-[180px] max-w-full object-contain"
      />
      <div className="mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-bny-teal">
        APAC Digital Assets
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">
        Pipeline and Market Whitespace
      </div>
      <button
        type="button"
        onClick={onPresentationMode}
        className="mt-5 rounded-full border border-bny-primary/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-bny-teal transition hover:bg-bny-primary/15 hover:text-white"
      >
        Presentation Mode
      </button>

      <div className="mt-5 rounded-2xl border border-bny-primary/30 bg-bny-surface/75 p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50">
          Upload Product CSV
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-bny-navy/70 p-1">
          {PRODUCT_CONFIGS.map((product) => {
            const isActive = uploadProduct === product.id;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onUploadProductChange(product.id)}
                className={`rounded-full px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] transition ${
                  isActive
                    ? 'text-bny-navy'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
                style={{
                  backgroundColor: isActive ? product.color : 'transparent',
                }}
              >
                {product.shortLabel}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <UploadButton
            product={uploadProduct}
            label={
              isLoading
                ? isGeocoding
                  ? 'Geocoding...'
                  : 'Parsing...'
                : `Upload ${activeProduct.shortLabel}`
            }
            onFileUpload={onFileUpload}
            disabled={Boolean(loadingProduct)}
          />
          {hasData && (
            <>
              <button
                type="button"
                onClick={() => onClearProduct(uploadProduct)}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Clear Tab
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Clear All
              </button>
            </>
          )}
        </div>
        <a
          href={SAMPLE_PIPELINE_BY_PRODUCT[uploadProduct]}
          className="mt-3 inline-block text-xs font-semibold text-bny-teal underline-offset-4 hover:underline"
        >
          Download dummy {activeProduct.shortLabel} CSV
        </a>
      </div>
    </div>
  );
}

interface UploadButtonProps {
  product: ProductId;
  label: string;
  onFileUpload: (file: File, product: ProductId) => void;
  disabled?: boolean;
}

function UploadButton({
  product,
  label,
  onFileUpload,
  disabled = false,
}: UploadButtonProps) {
  return (
    <label
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-bny-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-bny-teal ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <Upload className="h-3.5 w-3.5" />
      {label}
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileUpload(file, product);
          }
          event.target.value = '';
        }}
      />
    </label>
  );
}

interface GlobalViewProps {
  statuses: string[];
  owners: string[];
  countries: string[];
  statusFilter: string;
  ownerFilter: string;
  countryFilter: string;
  minimumProbability: number;
  onStatusChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onProbabilityChange: (value: number) => void;
  activeProducts: ProductId[];
  onToggleProduct: (product: ProductId) => void;
  productMetrics: Record<ProductId, ProductMetric>;
  cityGroups: CityOpportunityGroup[];
  kpis: {
    totalPipelineValue: number;
    activeOpportunities: number;
    highProbabilityValue: number;
    whitespaceValue: number;
  };
  mappedCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  tamCount: number;
  capturedTamCount: number;
  tamLoading: boolean;
  opportunitiesByProduct: Record<ProductId, ProductPipelineOpportunity[]>;
}

function GlobalView({
  statuses,
  owners,
  countries,
  statusFilter,
  ownerFilter,
  countryFilter,
  minimumProbability,
  onStatusChange,
  onOwnerChange,
  onCountryChange,
  onProbabilityChange,
  activeProducts,
  onToggleProduct,
  productMetrics,
  cityGroups,
  kpis,
  mappedCount,
  viewMode,
  onViewModeChange,
  tamCount,
  capturedTamCount,
  tamLoading,
  opportunitiesByProduct,
}: GlobalViewProps) {
  const whitespaceCount = Math.max(tamCount - capturedTamCount, 0);

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-bny-teal">
        <Globe2 className="h-4 w-4" />
        Regional Command Center
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        APAC Pipeline
      </h1>
      <p className="mt-3 text-sm leading-6 text-white/70">
        Toggle each digital assets product to compare active pipeline and TAM
        whitespace across APAC markets.
      </p>

      <div className="mt-6">
        <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>

      <section className="mt-6 rounded-xl border border-bny-primary/35 bg-bny-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
          Product Filters
        </div>
        <div className="mt-3 space-y-2">
          {PRODUCT_CONFIGS.map((product) => {
            const isActive = activeProducts.includes(product.id);
            const count = opportunitiesByProduct[product.id].length;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onToggleProduct(product.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-white/20 bg-white/10'
                    : 'border-white/10 bg-bny-navy/35 opacity-55 hover:opacity-90'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.4)]"
                    style={{ backgroundColor: product.color }}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {product.label}
                    </span>
                    <span className="text-xs text-white/45">
                      {count} uploaded records
                    </span>
                  </span>
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                  {isActive ? 'On' : 'Off'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-bny-astronaut bg-bny-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
          Product KPIs
        </div>
        <div className="mt-3 space-y-3">
          {PRODUCT_CONFIGS.map((product) => (
            <ProductMetricCard
              key={product.id}
              metric={productMetrics[product.id]}
              product={product.id}
              isActive={activeProducts.includes(product.id)}
            />
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={statuses}
          onChange={onStatusChange}
        />
        <FilterSelect
          label="Owner"
          value={ownerFilter}
          options={owners}
          onChange={onOwnerChange}
        />
        <FilterSelect
          label="Country"
          value={countryFilter}
          options={countries}
          onChange={onCountryChange}
        />
        <div className="rounded-xl border border-bny-astronaut bg-bny-surface px-4 py-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/55">
            <span>Probability</span>
            <span className="font-mono text-bny-teal">{minimumProbability}%+</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minimumProbability}
            onChange={(event) => onProbabilityChange(Number(event.target.value))}
            className="mt-3 w-full accent-bny-primary"
          />
        </div>
      </section>

      <section className="mt-6 grid gap-3">
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Pipeline Value"
          value={formatCompactCurrency(kpis.totalPipelineValue)}
          detail={formatCurrency(kpis.totalPipelineValue)}
        />
        <KpiCard
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          label="Active Opportunities"
          value={String(kpis.activeOpportunities)}
          detail={`${mappedCount} mapped opportunities`}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={viewMode === 'tam' ? 'Whitespace TAM' : 'High Probability Value'}
          value={formatCompactCurrency(
            viewMode === 'tam' ? kpis.whitespaceValue : kpis.highProbabilityValue
          )}
          detail={
            viewMode === 'tam'
              ? `${whitespaceCount} uncaptured TAM records`
              : `Probability above ${HIGH_PROBABILITY_THRESHOLD}%`
          }
        />
      </section>

      <section className="mt-6 rounded-xl border border-bny-astronaut bg-bny-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
          Map Status
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <StatusMetric label="Cities" value={String(cityGroups.length)} />
          <StatusMetric
            label={viewMode === 'tam' ? 'Whitespace' : 'Records'}
            value={
              viewMode === 'tam'
                ? tamLoading
                  ? 'Loading'
                  : String(whitespaceCount)
                : String(kpis.activeOpportunities)
            }
          />
        </div>
      </section>
    </div>
  );
}

function ProductMetricCard({
  product,
  metric,
  isActive,
}: {
  product: ProductId;
  metric: ProductMetric;
  isActive: boolean;
}) {
  const productConfig = PRODUCT_CONFIG_BY_ID[product];

  return (
    <div
      className={`rounded-xl border bg-bny-navy/35 p-4 transition ${
        isActive ? 'border-white/15 opacity-100' : 'border-white/10 opacity-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: productConfig.color }}
          />
          <div className="truncate text-sm font-semibold text-white">
            {productConfig.label}
          </div>
        </div>
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
          {isActive ? 'On' : 'Off'}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatusMetric
          label="Pipeline"
          value={formatCompactCurrency(metric.pipelineValue)}
        />
        <StatusMetric
          label="Oppty"
          value={String(metric.opportunityCount)}
        />
        <StatusMetric
          label="Whitespace"
          value={formatCompactCurrency(metric.whitespaceValue)}
        />
      </div>
    </div>
  );
}

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  const options: Array<{ value: ViewMode; label: string }> = [
    { value: 'pipeline', label: 'Active Pipeline' },
    { value: 'tam', label: 'Market Whitespace' },
  ];

  return (
    <section className="rounded-xl border border-bny-primary/35 bg-bny-surface p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
        View Mode
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-bny-navy/70 p-1">
        {options.map((option) => {
          const isActive = viewMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onViewModeChange(option.value)}
              className={`rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                isActive
                  ? 'bg-bny-primary text-white shadow-glow'
                  : 'text-white/55 hover:bg-white/10 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface CityViewProps {
  city: CityOpportunityGroup | null;
  whitespaceOpportunities: CapturedTamOpportunity[];
  viewMode: ViewMode;
  onBack: () => void;
  onOpportunitySelect: (opportunity: GeocodedPipelineOpportunity) => void;
}

function CityView({
  city,
  whitespaceOpportunities,
  viewMode,
  onBack,
  onOpportunitySelect,
}: CityViewProps) {
  const firstWhitespaceOpportunity = whitespaceOpportunities[0];
  const locationLabel =
    city?.label ??
    (firstWhitespaceOpportunity
      ? `${firstWhitespaceOpportunity['Opportunity City']}, ${firstWhitespaceOpportunity['Opportunity Country']}`
      : 'Selected Market');
  const pipelineOpportunities = city?.opportunities ?? [];
  const totalBidValue = city?.totalBidValue ?? 0;
  const showWhitespace = viewMode === 'tam';

  return (
    <div>
      <BackButton onClick={onBack}>Back to APAC</BackButton>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-bny-teal">
          <MapPin className="h-4 w-4" />
          Market View
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          {locationLabel}
        </h2>
        <p className="mt-3 text-sm text-white/70">
          {pipelineOpportunities.length} active opportunities
          {totalBidValue > 0 ? ` totaling ${formatCurrency(totalBidValue)}` : ''}
          {showWhitespace
            ? ` and ${whitespaceOpportunities.length} whitespace records.`
            : '.'}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <section>
          {showWhitespace && (
            <SectionHeading
              title="Active Pipeline"
              detail={`${pipelineOpportunities.length} opportunities`}
            />
          )}
          <div className="mt-3 space-y-3">
            {pipelineOpportunities.length === 0 ? (
              <EmptyCitySection message="No active pipeline opportunities in this market." />
            ) : (
              pipelineOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity['Oppty ID']}
                  opportunity={opportunity}
                  onSelect={onOpportunitySelect}
                />
              ))
            )}
          </div>
        </section>

        {showWhitespace && (
          <section>
            <SectionHeading
              title="Market Whitespace"
              detail={`${whitespaceOpportunities.length} uncaptured opportunities`}
            />
            <div className="mt-3 space-y-3">
              {whitespaceOpportunities.length === 0 ? (
                <EmptyCitySection message="No uncaptured TAM opportunities in this market." />
              ) : (
                whitespaceOpportunities.map((opportunity) => (
                  <WhitespaceCard
                    key={`${opportunity['Oppty ID']}-${opportunity.locationKey}`}
                    opportunity={opportunity}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function OpportunityCard({
  opportunity,
  onSelect,
}: {
  opportunity: GeocodedPipelineOpportunity;
  onSelect: (opportunity: GeocodedPipelineOpportunity) => void;
}) {
  const stageColors = getStageColors(opportunity.Status);
  const product = PRODUCT_CONFIG_BY_ID[opportunity.product];

  return (
    <button
      type="button"
      onClick={() => onSelect(opportunity)}
      className={`w-full rounded-xl border border-l-4 border-bny-astronaut ${stageColors.border} bg-bny-surface p-4 text-left transition hover:border-bny-primary hover:bg-bny-astronaut`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: product.color }}
            />
            <div className="truncate text-base font-semibold text-white">
              {opportunity.Opportunity || 'Untitled Opportunity'}
            </div>
          </div>
          <div className="mt-1 truncate text-sm text-white/60">
            {opportunity.Client} - {opportunity.Owner || 'Unassigned'}
          </div>
        </div>
        <div
          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${stageColors.badge}`}
        >
          {opportunity.Status || 'Unknown'}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatusMetric
          label="Bid"
          value={formatCompactCurrency(opportunity['Total Bid Value'])}
        />
        <StatusMetric label="Probability" value={`${opportunity.Probability}%`} />
        <StatusMetric label="Product" value={product.shortLabel} />
      </div>
    </button>
  );
}

interface SectionHeadingProps {
  title: string;
  detail: string;
}

function SectionHeading({ title, detail }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-white">
        {title}
      </h3>
      <span className="text-xs text-white/50">{detail}</span>
    </div>
  );
}

function EmptyCitySection({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-bny-surface/70 px-4 py-3 text-sm text-white/55">
      {message}
    </div>
  );
}

function WhitespaceCard({
  opportunity,
}: {
  opportunity: CapturedTamOpportunity;
}) {
  const product = PRODUCT_CONFIG_BY_ID[opportunity.product];

  return (
    <div
      className="w-full rounded-xl border border-l-4 border-bny-astronaut bg-bny-surface p-4 text-left shadow-lg shadow-black/10"
      style={{ borderLeftColor: product.color }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white">
            {opportunity.Client}
          </div>
          <div className="mt-1 truncate text-sm text-white/60">
            {opportunity['Opportunity City']},{' '}
            {opportunity['Opportunity Country']}
          </div>
        </div>
        <div
          className="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-bny-navy ring-1 ring-white/25"
          style={{ backgroundColor: product.color }}
        >
          {product.shortLabel}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatusMetric
          label="Estimated TAM"
          value={formatCompactCurrency(opportunity['Total Bid Value'])}
        />
        <StatusMetric label="Status" value="Whitespace" />
      </div>
    </div>
  );
}

interface OpportunityDetailViewProps {
  opportunity: GeocodedPipelineOpportunity;
  city: CityOpportunityGroup | null;
  onBack: () => void;
  onRegional: () => void;
}

function OpportunityDetailView({
  opportunity,
  city,
  onBack,
  onRegional,
}: OpportunityDetailViewProps) {
  const product = PRODUCT_CONFIG_BY_ID[opportunity.product];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <BackButton onClick={onBack}>{city ? 'Back to Market' : 'Back'}</BackButton>
        <button
          type="button"
          onClick={onRegional}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          Back to APAC
        </button>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-bny-teal">
          <Building2 className="h-4 w-4" />
          Opportunity Detail
        </div>
        <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
          {opportunity.Opportunity || 'Untitled Opportunity'}
        </h2>
        <p className="mt-3 text-sm text-white/70">{opportunity.Client}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <DetailMetric
          label="Product"
          value={product.label}
          featured
          color={product.color}
        />
        <DetailMetric
          label="Total Bid Value"
          value={formatCurrency(opportunity['Total Bid Value'])}
          featured
        />
        <DetailMetric
          label="Probability"
          value={`${opportunity.Probability}%`}
          featured
        />
        <DetailMetric label="Owner" value={opportunity.Owner || 'Unassigned'} />
        <DetailMetric label="Status" value={opportunity.Status || 'Unknown'} />
        <DetailMetric
          label="City"
          value={opportunity['Opportunity City'] || '-'}
        />
        <DetailMetric
          label="Country"
          value={opportunity['Opportunity Country'] || '-'}
        />
        <DetailMetric label="Oppty ID" value={opportunity['Oppty ID'] || '-'} />
      </div>

      <div className="mt-6 rounded-xl border border-bny-astronaut bg-bny-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
          Current Situation
        </div>
        <p className="mt-3 text-sm leading-6 text-white/75">
          {opportunity['Current Situation'] || 'No current situation provided.'}
        </p>
      </div>
    </div>
  );
}

interface BackButtonProps {
  children: ReactNode;
  onClick: () => void;
}

function BackButton({ children, onClick }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-bny-primary/40 px-4 py-2 text-sm font-semibold text-bny-teal transition hover:bg-bny-primary/15"
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </button>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label className="block rounded-xl border border-bny-astronaut bg-bny-surface px-4 py-3">
      <span className="text-xs uppercase tracking-[0.2em] text-white/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none"
      >
        <option value="All" className="bg-bny-navy">
          All
        </option>
        {options.map((option) => (
          <option key={option} value={option} className="bg-bny-navy">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}

function KpiCard({ icon, label, value, detail }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-bny-astronaut bg-bny-surface p-4 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between">
        <div className="rounded-xl border border-bny-primary/35 bg-bny-primary/15 p-3 text-bny-teal">
          {icon}
        </div>
        <div className="text-xs uppercase tracking-[0.24em] text-white/35">
          KPI
        </div>
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/55">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 font-mono text-xs text-bny-teal">{detail}</div>
    </div>
  );
}

interface StatusMetricProps {
  label: string;
  value: string;
}

function StatusMetric({ label, value }: StatusMetricProps) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-bny-navy/35 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-white">
        {value || '-'}
      </div>
    </div>
  );
}

interface DetailMetricProps {
  label: string;
  value: string;
  featured?: boolean;
  color?: string;
}

function DetailMetric({
  label,
  value,
  featured = false,
  color,
}: DetailMetricProps) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        featured
          ? 'border-bny-primary/40 bg-bny-primary/15'
          : 'border-bny-astronaut bg-bny-surface'
      }`}
      style={color ? { borderColor: color } : undefined}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
