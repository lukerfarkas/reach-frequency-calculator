# Reach & Frequency Calculator

A production-ready web app for media planners to calculate reach, frequency, GRPs, and effective 3+ reach across media tactics, with cross-tactic deduplication.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run Tests

```bash
npm run test:run     # single run
npm run test         # watch mode
```

### Build for Production

```bash
npm run build
npm start
```

## Features

- **Per-tactic calculations**: GRPs, Reach %, Reach #, Average Frequency, Effective 3+ Reach
- **Flexible input**: Provide any combination of Cost+CPM, Gross Impressions, GRPs, Reach%+Frequency, or Reach% only. Missing values are derived automatically.
- **Combined reach**: Deduplicates reach across multiple tactics using the sequential remainder method
- **Plan summary**: Combined Reach, Total GRPs, Average Frequency, Effective 3+ Reach at the plan level
- **Guardrails**: Blocks combining tactics with different geos or audience sizes
- **Show Math**: Toggle to see all formulas and intermediate calculation steps
- **Export/Import**: Save and load plans as JSON files
- **Demo data**: 3 seed tactics to explore immediately

## Formulas

### Basic Conversions

| Formula | Expression |
|---------|-----------|
| Gross Impressions | (Cost / CPM) x 1,000 |
| GRPs | (Gross Impressions / Target Population) x 100 |
| GRPs | Reach% x Frequency |
| Average Frequency | GRPs / Reach% |
| Reach # | (Reach% / 100) x Audience Size |

### Effective 3+ Reach (Poisson Approximation)

```
lambda = GRPs / 100
P(0) = e^(-lambda)
P(1) = lambda * e^(-lambda)
P(2) = (lambda^2 / 2) * e^(-lambda)
P(3+) = 1 - P(0) - P(1) - P(2)
Effective 3+ Reach% = P(3+) * 100
```

**Example**: GRPs = 300, lambda = 3, P(3+) = 57.68%

### Combined Reach (Sequential Remainder Method)

Sort tactics by Reach% descending, then:

```
runningTotal = highestReach%
for each subsequent tactic:
  remainder = 100 - runningTotal
  incremental = remainder * (nextReach% / 100)
  runningTotal += incremental
```

Mathematically equivalent to: `Combined Reach% = 100 * (1 - Product(1 - ri/100))`

**Example**: 60% + 30% = 72% combined reach

### Plan-Level Metrics

- **Total GRPs** = sum of all tactic GRPs
- **Combined Avg Frequency** = Total GRPs / Combined Reach%
- **Combined Effective 3+** = Poisson approximation using Total GRPs

## Input Sets

You can provide any of these input combinations per tactic:

| Set | Inputs | What Gets Computed |
|-----|--------|--------------------|
| A | GRPs | Impressions (needs Reach% or Frequency for full resolution) |
| B | Gross Impressions | GRPs, then same as A |
| C | Cost + CPM | Impressions, GRPs, then same as A |
| D | Reach% + Frequency | GRPs, Impressions, Effective 3+ (fully resolved) |
| E | Reach% only | Reach # only (insufficient for GRPs/Frequency) |

## Guardrails

1. **Geo mismatch**: Combining tactics with different `geoName` values is blocked with a clear error
2. **Audience size mismatch**: Combining tactics with different `audienceSize` values is blocked
3. **Input validation**: Negative costs, CPM <= 0, reach > 100%, negative impressions are all rejected
4. **Impossible results**: Computed reach > 100% triggers an error

## Limitations & Assumptions

- **Poisson approximation**: Effective 3+ reach uses a Poisson distribution, which assumes random ad exposure. Real-world delivery patterns may differ.
- **No reach curves**: This tool does not use proprietary reach curves. Reach% must be provided as an input or derived from Reach% + Frequency. GRPs alone cannot be decomposed into Reach and Frequency without at least one of them being specified.
- **Independence assumption**: The sequential remainder method for combining reach assumes statistical independence between tactics. In practice, audience overlap patterns may differ.
- **Combined Avg Frequency**: Defined as Total GRPs / Combined Reach%, which is a rough approximation assuming comparable GRP distributions across tactics within the same geo/audience.
- **No database**: State is stored in browser memory only. Use Export/Import JSON to persist plans.

## Project Structure

```
src/
  lib/
    math/
      calculations.ts   # Pure calculation functions
      resolver.ts        # Input resolution logic
      index.ts
    schemas.ts           # Zod validation schemas
    seedData.ts          # Demo data (3 tactics)
    formatters.ts        # Number formatting utilities
  components/
    TacticFormRow.tsx     # Input row for the tactic table
    TacticResultCard.tsx  # Per-tactic results display
    PlanSummaryPanel.tsx  # Plan-level combined metrics
    CombinedReachSteps.tsx # Sequential remainder breakdown
    ShowMathPanel.tsx     # Collapsible formula reference
  app/
    layout.tsx
    page.tsx             # Main single-page application
    globals.css
  __tests__/
    calculations.test.ts # 28 tests for pure math
    resolver.test.ts     # 8 tests for input resolution
    schemas.test.ts      # 15 tests for validation
```

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Zod for validation
- Vitest for unit tests (51 tests)
