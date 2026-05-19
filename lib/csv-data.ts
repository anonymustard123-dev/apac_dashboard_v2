import Papa from 'papaparse';
import {
  PipelineOpportunity,
  ProductId,
  ProductPipelineOpportunity,
  TamOpportunity,
} from '@/types';

type CsvRow = Record<keyof PipelineOpportunity, string | number | undefined>;

const parseNumber = (value: string | number | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const normalized = value.replace(/[$,%\s,]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asText = (value: string | number | undefined): string =>
  typeof value === 'number' ? String(value) : value?.trim() ?? '';

const toOpportunity = (row: CsvRow): PipelineOpportunity => ({
  Client: asText(row.Client),
  Opportunity: asText(row.Opportunity),
  Owner: asText(row.Owner),
  'Total Bid Value': parseNumber(row['Total Bid Value']),
  Probability: parseNumber(row.Probability),
  'Opportunity Country': asText(row['Opportunity Country']),
  'Opportunity City': asText(row['Opportunity City']),
  'Current Situation': asText(row['Current Situation']),
  Status: asText(row.Status),
  'Oppty ID': asText(row['Oppty ID']),
});

const parseCsv = (csv: string): PipelineOpportunity[] => {
  const parsed = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message);
  }

  return parsed.data
    .map(toOpportunity)
    .filter((opportunity) => opportunity.Client || opportunity.Opportunity);
};

export function parsePipelineCsvFile(
  file: File,
  product: ProductId
): Promise<ProductPipelineOpportunity[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }

        resolve(
          results.data
            .map(toOpportunity)
            .filter((opportunity) => opportunity.Client || opportunity.Opportunity)
            .map((opportunity) => ({ ...opportunity, product }))
        );
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export async function fetchTamCsv(
  csvPath: string,
  product: ProductId
): Promise<TamOpportunity[]> {
  const response = await fetch(encodeURI(csvPath), {
    cache: 'force-cache',
  });

  if (!response.ok) {
    return [];
  }

  const csv = await response.text();
  return parseCsv(csv).map((opportunity) => ({ ...opportunity, product }));
}
