# APAC Digital Assets Dashboard

An APAC-focused geographic dashboard for BNY digital assets pipeline and market whitespace across three product lines:

- Digital Asset Custody
- Stablecoin Enablement
- Tokenized Funds

The app follows the same client-side CSV upload approach as the existing stablecoin dashboard. Uploaded pipeline data stays in the browser session, while dummy TAM CSVs are loaded from `public/data`.

## CSV Structure

Each product pipeline CSV and each TAM/whitespace CSV uses this exact header:

```text
Client,Opportunity,Owner,Total Bid Value,Probability,Opportunity Country,Opportunity City,Current Situation,Status,Oppty ID
```

Dummy pipeline files:

- `public/data/dac_pipeline.csv`
- `public/data/stablecoin_pipeline.csv`
- `public/data/tokenized_funds_pipeline.csv`

Dummy TAM files:

- `public/data/dac_tam.csv`
- `public/data/stablecoin_tam.csv`
- `public/data/tokenized_funds_tam.csv`

## Setup

Add your Mapbox token to `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here
```

Install dependencies and run locally:

```bash
npm install
npm run dev
```
