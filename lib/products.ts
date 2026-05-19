import { ProductConfig } from '@/types';

export const PRODUCT_CONFIGS: ProductConfig[] = [
  {
    id: 'dac',
    label: 'Digital Asset Custody',
    shortLabel: 'DAC',
    color: '#2D9BAD',
    glow: 'rgba(45, 155, 173, 0.7)',
    tamCsvPath: '/data/dac_tam.csv',
  },
  {
    id: 'stablecoin',
    label: 'Stablecoin Enablement',
    shortLabel: 'Stablecoin',
    color: '#FFBF00',
    glow: 'rgba(255, 191, 0, 0.7)',
    tamCsvPath: '/data/stablecoin_tam.csv',
  },
  {
    id: 'tokenizedFunds',
    label: 'Tokenized Funds',
    shortLabel: 'Funds',
    color: '#A78BFA',
    glow: 'rgba(167, 139, 250, 0.72)',
    tamCsvPath: '/data/tokenized_funds_tam.csv',
  },
];

export const PRODUCT_CONFIG_BY_ID = Object.fromEntries(
  PRODUCT_CONFIGS.map((product) => [product.id, product])
);
