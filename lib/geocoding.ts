import {
  GeocodedPipelineOpportunity,
  ProductPipelineOpportunity,
} from '@/types';

const CACHE_KEY = 'apac-digital-assets-geocode-cache-v1';
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const BATCH_SIZE = 5;

type Coordinate = {
  latitude: number;
  longitude: number;
};

type GeocodeCache = Record<string, Coordinate>;

const normalizeLocation = (city: string, country: string): string => {
  const parts = [city.trim(), country.trim()].filter(Boolean);
  return parts.join(', ').toLowerCase().replace(/\s+/g, ' ');
};

const readCache = (): GeocodeCache => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GeocodeCache) : {};
  } catch {
    return {};
  }
};

const writeCache = (cache: GeocodeCache) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

async function geocodeLocation(
  location: string,
  token: string
): Promise<Coordinate | null> {
  const url = new URL(`${MAPBOX_GEOCODING_URL}/${encodeURIComponent(location)}.json`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'place,locality,address,country,region');
  url.searchParams.set('proximity', '100,20');

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as {
    features?: Array<{ center?: [number, number] }>;
  };
  const center = result.features?.[0]?.center;

  if (!center) {
    return null;
  }

  return {
    longitude: center[0],
    latitude: center[1],
  };
}

export async function geocodeOpportunities(
  opportunities: ProductPipelineOpportunity[],
  token: string | undefined
): Promise<GeocodedPipelineOpportunity[]> {
  return geocodeRecordsByLocation(
    opportunities,
    token,
    (opportunity) => opportunity['Opportunity City'],
    (opportunity) => opportunity['Opportunity Country']
  );
}

export async function geocodeRecordsByLocation<T>(
  records: T[],
  token: string | undefined,
  getCity: (record: T) => string,
  getCountry: (record: T) => string
): Promise<Array<T & Coordinate & { locationKey: string }>> {
  if (!token) {
    return [];
  }

  const cache = readCache();
  const uniqueLocations = Array.from(
    new Set(
      records
        .map((record) => normalizeLocation(getCity(record), getCountry(record)))
        .filter(Boolean)
    )
  );

  const uncachedLocations = uniqueLocations.filter((location) => !cache[location]);

  for (const batch of chunk(uncachedLocations, BATCH_SIZE)) {
    const results = await Promise.all(
      batch.map(async (location) => ({
        location,
        coordinate: await geocodeLocation(location, token),
      }))
    );

    results.forEach(({ location, coordinate }) => {
      if (coordinate) {
        cache[location] = coordinate;
      }
    });
    writeCache(cache);
  }

  return records.flatMap((record) => {
    const locationKey = normalizeLocation(getCity(record), getCountry(record));
    const coordinate = cache[locationKey];

    if (!coordinate) {
      return [];
    }

    return {
      ...record,
      ...coordinate,
      locationKey,
    };
  });
}
