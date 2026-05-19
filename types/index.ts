export type ProductId = 'dac' | 'stablecoin' | 'tokenizedFunds';

export interface ProductConfig {
  id: ProductId;
  label: string;
  shortLabel: string;
  color: string;
  glow: string;
  tamCsvPath: string;
}

export interface PipelineOpportunity {
  Client: string;
  Opportunity: string;
  Owner: string;
  'Total Bid Value': number;
  Probability: number;
  'Opportunity Country': string;
  'Opportunity City': string;
  'Current Situation': string;
  Status: string;
  'Oppty ID': string;
}

export interface ProductPipelineOpportunity extends PipelineOpportunity {
  product: ProductId;
}

export interface GeocodedPipelineOpportunity
  extends ProductPipelineOpportunity {
  latitude: number;
  longitude: number;
  locationKey: string;
}

export interface CityOpportunityGroup {
  id: string;
  city: string;
  country: string;
  label: string;
  latitude: number;
  longitude: number;
  opportunities: GeocodedPipelineOpportunity[];
  totalBidValue: number;
  averageProbability: number;
  productCounts: Record<ProductId, number>;
}

export type TamOpportunity = ProductPipelineOpportunity;

export interface GeocodedTamOpportunity extends TamOpportunity {
  latitude: number;
  longitude: number;
  locationKey: string;
}

export interface CapturedTamOpportunity extends GeocodedTamOpportunity {
  isCaptured: boolean;
}
