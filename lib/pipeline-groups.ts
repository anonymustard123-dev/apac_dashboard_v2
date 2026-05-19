import {
  CityOpportunityGroup,
  GeocodedPipelineOpportunity,
  ProductId,
} from '@/types';

const PRODUCT_IDS: ProductId[] = ['dac', 'stablecoin', 'tokenizedFunds'];

const normalizeGroupKey = (city: string, country: string): string =>
  [city.trim(), country.trim()]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
    .replace(/\s+/g, ' ');

const emptyProductCounts = (): Record<ProductId, number> => ({
  dac: 0,
  stablecoin: 0,
  tokenizedFunds: 0,
});

export function groupOpportunitiesByCity(
  opportunities: GeocodedPipelineOpportunity[]
): CityOpportunityGroup[] {
  const groups = opportunities.reduce((acc, opportunity) => {
    const city = opportunity['Opportunity City'] || 'Unknown City';
    const country = opportunity['Opportunity Country'] || 'Unknown Country';
    const id = normalizeGroupKey(city, country);
    const group = acc.get(id) ?? {
      id,
      city,
      country,
      label: `${city}, ${country}`,
      latitude: opportunity.latitude,
      longitude: opportunity.longitude,
      opportunities: [],
      totalBidValue: 0,
      averageProbability: 0,
      productCounts: emptyProductCounts(),
    };

    group.opportunities.push(opportunity);
    group.totalBidValue += opportunity['Total Bid Value'];
    group.productCounts[opportunity.product] += 1;
    group.averageProbability =
      group.opportunities.reduce((sum, item) => sum + item.Probability, 0) /
      group.opportunities.length;
    acc.set(id, group);

    return acc;
  }, new Map<string, CityOpportunityGroup>());

  return Array.from(groups.values()).sort(
    (a, b) =>
      b.totalBidValue - a.totalBidValue ||
      PRODUCT_IDS.reduce(
        (sum, product) => sum + b.productCounts[product] - a.productCounts[product],
        0
      )
  );
}
