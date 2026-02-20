#!/usr/bin/env node

/**
 * Fetches US Census ACS 5-Year county-level population data by age/sex,
 * aggregates to Nielsen DMAs using a county-to-DMA crosswalk, and writes
 * raw age/sex cells per DMA so the app can compute any age × sex combination
 * on the fly.
 *
 * Usage:
 *   CENSUS_API_KEY=your_key node scripts/fetch-dma-demographics.js
 *
 * Or without a key (limited to 500 requests/day per IP):
 *   node scripts/fetch-dma-demographics.js
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CENSUS_API_KEY = process.env.CENSUS_API_KEY || "";
const ACS_YEAR = "2023"; // Most recent ACS 5-Year dataset
const BASE_URL = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5`;

// B01001: Sex by Age — variable codes for specific age/sex cells
const VARIABLES = [
  "B01001_001E", // Total population
  // Male age groups
  "B01001_003E", // Male Under 5
  "B01001_004E", // Male 5-9
  "B01001_005E", // Male 10-14
  "B01001_006E", // Male 15-17
  "B01001_007E", // Male 18-19
  "B01001_008E", // Male 20
  "B01001_009E", // Male 21
  "B01001_010E", // Male 22-24
  "B01001_011E", // Male 25-29
  "B01001_012E", // Male 30-34
  "B01001_013E", // Male 35-39
  "B01001_014E", // Male 40-44
  "B01001_015E", // Male 45-49
  "B01001_016E", // Male 50-54
  "B01001_017E", // Male 55-59
  "B01001_018E", // Male 60-61
  "B01001_019E", // Male 62-64
  "B01001_020E", // Male 65-66
  "B01001_021E", // Male 67-69
  "B01001_022E", // Male 70-74
  "B01001_023E", // Male 75-79
  "B01001_024E", // Male 80-84
  "B01001_025E", // Male 85+
  // Female age groups
  "B01001_027E", // Female Under 5
  "B01001_028E", // Female 5-9
  "B01001_029E", // Female 10-14
  "B01001_030E", // Female 15-17
  "B01001_031E", // Female 18-19
  "B01001_032E", // Female 20
  "B01001_033E", // Female 21
  "B01001_034E", // Female 22-24
  "B01001_035E", // Female 25-29
  "B01001_036E", // Female 30-34
  "B01001_037E", // Female 35-39
  "B01001_038E", // Female 40-44
  "B01001_039E", // Female 45-49
  "B01001_040E", // Female 50-54
  "B01001_041E", // Female 55-59
  "B01001_042E", // Female 60-61
  "B01001_043E", // Female 62-64
  "B01001_044E", // Female 65-66
  "B01001_045E", // Female 67-69
  "B01001_046E", // Female 70-74
  "B01001_047E", // Female 75-79
  "B01001_048E", // Female 80-84
  "B01001_049E", // Female 85+
  // Household variable from a different table
  "B11001_001E", // Total households
];

// ---------------------------------------------------------------------------
// Age cell definitions — each cell has an age floor, ceiling, and Census vars
// for male and female. These are the atomic building blocks the client uses
// to sum any arbitrary age × sex combination.
// ---------------------------------------------------------------------------

const AGE_CELLS = [
  { ageMin: 18, ageMax: 19, maleVar: "B01001_007E", femaleVar: "B01001_031E" },
  { ageMin: 20, ageMax: 20, maleVar: "B01001_008E", femaleVar: "B01001_032E" },
  { ageMin: 21, ageMax: 21, maleVar: "B01001_009E", femaleVar: "B01001_033E" },
  { ageMin: 22, ageMax: 24, maleVar: "B01001_010E", femaleVar: "B01001_034E" },
  { ageMin: 25, ageMax: 29, maleVar: "B01001_011E", femaleVar: "B01001_035E" },
  { ageMin: 30, ageMax: 34, maleVar: "B01001_012E", femaleVar: "B01001_036E" },
  { ageMin: 35, ageMax: 39, maleVar: "B01001_013E", femaleVar: "B01001_037E" },
  { ageMin: 40, ageMax: 44, maleVar: "B01001_014E", femaleVar: "B01001_038E" },
  { ageMin: 45, ageMax: 49, maleVar: "B01001_015E", femaleVar: "B01001_039E" },
  { ageMin: 50, ageMax: 54, maleVar: "B01001_016E", femaleVar: "B01001_040E" },
  { ageMin: 55, ageMax: 59, maleVar: "B01001_017E", femaleVar: "B01001_041E" },
  { ageMin: 60, ageMax: 64, maleVar: null,           femaleVar: null          }, // merged from 60-61 + 62-64
  { ageMin: 65, ageMax: 69, maleVar: null,           femaleVar: null          }, // merged from 65-66 + 67-69
  { ageMin: 70, ageMax: 74, maleVar: "B01001_022E", femaleVar: "B01001_046E" },
  { ageMin: 75, ageMax: 79, maleVar: "B01001_023E", femaleVar: "B01001_047E" },
  { ageMin: 80, ageMax: 84, maleVar: "B01001_024E", femaleVar: "B01001_048E" },
  { ageMin: 85, ageMax: 999, maleVar: "B01001_025E", femaleVar: "B01001_049E" },
];

// Census splits 60-64 into 60-61 and 62-64, and 65-69 into 65-66 and 67-69.
// We merge them into 60-64 and 65-69 cells for the output.
const MERGE_CELLS = {
  "60-64": {
    maleVars: ["B01001_018E", "B01001_019E"],
    femaleVars: ["B01001_042E", "B01001_043E"],
  },
  "65-69": {
    maleVars: ["B01001_020E", "B01001_021E"],
    femaleVars: ["B01001_044E", "B01001_045E"],
  },
};

function sumVars(row, vars) {
  return vars.reduce((sum, v) => sum + (parseInt(row[v], 10) || 0), 0);
}

// ---------------------------------------------------------------------------
// Census API fetch
// ---------------------------------------------------------------------------

async function fetchCensusData() {
  const varList = VARIABLES.join(",");
  let url = `${BASE_URL}?get=${varList}&for=county:*`;
  if (CENSUS_API_KEY) {
    url += `&key=${CENSUS_API_KEY}`;
  }

  console.log(`Fetching Census ACS ${ACS_YEAR} data...`);
  console.log(`URL: ${url.replace(CENSUS_API_KEY, "***")}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Census API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`Received ${data.length - 1} county rows`);

  const headers = data[0];
  const rows = data.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Crosswalk loading
// ---------------------------------------------------------------------------

function loadCrosswalk() {
  const csvPath = path.join(__dirname, "county-dma-crosswalk.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n");
  const header = parseCSVLine(lines[0]);
  const fipsIdx = header.indexOf("county_fips");
  const dmaCodeIdx = header.indexOf("dma_code");
  const dmaNameIdx = header.indexOf("dma_name");

  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const fips = cols[fipsIdx];
    const dmaCode = cols[dmaCodeIdx];
    const dmaName = cols[dmaNameIdx];
    if (fips && dmaCode && dmaCode !== "0") {
      map[fips] = { dmaCode, dmaName: titleCase(dmaName) };
    }
  }

  console.log(`Loaded crosswalk: ${Object.keys(map).length} counties → DMAs`);
  return map;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function titleCase(str) {
  return str
    .split(/(\s+|,\s*|-+)/)
    .map((word) => {
      if (/^[\s,\-]*$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Aggregation — raw age/sex cells per DMA
// ---------------------------------------------------------------------------

function aggregateToDMAs(censusRows, crosswalk) {
  // Each DMA accumulates: { male: number[], female: number[], households: number }
  // where the arrays are indexed by cell index matching AGE_CELLS order.
  const cellCount = AGE_CELLS.length; // 17 cells
  const dmaAccum = {};

  let matched = 0;
  let unmatched = 0;

  for (const row of censusRows) {
    const fips = row["state"] + row["county"];
    const mapping = crosswalk[fips];
    if (!mapping) {
      unmatched++;
      continue;
    }
    matched++;

    const { dmaCode, dmaName } = mapping;
    if (!dmaAccum[dmaCode]) {
      dmaAccum[dmaCode] = {
        dmaName,
        male: new Array(cellCount).fill(0),
        female: new Array(cellCount).fill(0),
        households: 0,
      };
    }

    const acc = dmaAccum[dmaCode];
    acc.households += parseInt(row["B11001_001E"], 10) || 0;

    for (let i = 0; i < cellCount; i++) {
      const cell = AGE_CELLS[i];

      if (cell.maleVar) {
        // Simple single-var cell
        acc.male[i] += parseInt(row[cell.maleVar], 10) || 0;
        acc.female[i] += parseInt(row[cell.femaleVar], 10) || 0;
      } else {
        // Merged cell (60-64 or 65-69)
        const mergeKey = `${cell.ageMin}-${cell.ageMax}`;
        const merge = MERGE_CELLS[mergeKey];
        acc.male[i] += sumVars(row, merge.maleVars);
        acc.female[i] += sumVars(row, merge.femaleVars);
      }
    }
  }

  console.log(`Matched ${matched} counties, ${unmatched} unmatched`);
  return dmaAccum;
}

// ---------------------------------------------------------------------------
// Output generation
// ---------------------------------------------------------------------------

function generateTypeScript(dmaAccum) {
  // Build DMA list sorted alphabetically with US National first
  const dmaEntries = Object.entries(dmaAccum)
    .map(([code, data]) => ({ code, name: data.dmaName }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const dmaList = [
    { code: "0", name: "US National" },
    ...dmaEntries,
  ];

  // Build cell metadata (age ranges for each cell index)
  const cellMeta = AGE_CELLS.map((c) => [c.ageMin, c.ageMax]);

  // Build the per-DMA raw data: { male: number[], female: number[], hh: number }
  // Also compute national totals by summing all DMAs
  const cellCount = AGE_CELLS.length;
  const nationalMale = new Array(cellCount).fill(0);
  const nationalFemale = new Array(cellCount).fill(0);
  let nationalHH = 0;

  const dmaCells = {};
  for (const [code, data] of Object.entries(dmaAccum)) {
    dmaCells[code] = { m: data.male, f: data.female, hh: data.households };
    for (let i = 0; i < cellCount; i++) {
      nationalMale[i] += data.male[i];
      nationalFemale[i] += data.female[i];
    }
    nationalHH += data.households;
  }
  dmaCells["0"] = { m: nationalMale, f: nationalFemale, hh: nationalHH };

  const totalDMAs = dmaList.length;

  let ts = `/**
 * DMA Audience Data — Auto-generated from US Census ACS ${ACS_YEAR} 5-Year Estimates
 * Generated: ${new Date().toISOString()}
 * Source: api.census.gov table B01001 (Sex by Age) + B11001 (Households)
 *
 * Contains raw age/sex cells per DMA so the app can compute any
 * age × sex combination dynamically (e.g., Males 25-34, Adults 18-49).
 *
 * DO NOT EDIT — regenerate with: node scripts/fetch-dma-demographics.js
 */

/** DMA list: code + display name, US National first. */
export const DMA_LIST: { code: string; name: string }[] = ${JSON.stringify(dmaList, null, 2)};

/**
 * Age cell boundaries: [ageMin, ageMax] for each cell index.
 * 85+ is represented as [85, 999].
 * Arrays in DMA_CELLS are indexed to match these.
 */
export const AGE_CELL_RANGES: [number, number][] = ${JSON.stringify(cellMeta)};

/**
 * Raw population cells per DMA.
 * m = male counts, f = female counts (indexed by AGE_CELL_RANGES),
 * hh = total households.
 */
export const DMA_CELLS: Record<string, { m: number[]; f: number[]; hh: number }> = ${JSON.stringify(dmaCells)};
`;

  console.log(`Generated ${totalDMAs} DMAs × ${cellCount} age cells = ${totalDMAs * cellCount * 2} values + households`);
  return ts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    const crosswalk = loadCrosswalk();
    const censusRows = await fetchCensusData();
    const dmaAccum = aggregateToDMAs(censusRows, crosswalk);
    const tsContent = generateTypeScript(dmaAccum);

    const generatedPath = path.join(
      __dirname, "..", "src", "lib", "data", "dmaAudienceData.generated.ts"
    );
    fs.writeFileSync(generatedPath, tsContent);
    console.log(`Written: ${generatedPath}`);

    const snapshotPath = path.join(
      __dirname, "..", "src", "lib", "data", "dmaAudienceData.snapshot.ts"
    );
    fs.writeFileSync(snapshotPath, tsContent);
    console.log(`Snapshot: ${snapshotPath}`);

    console.log("Done!");
  } catch (err) {
    console.error("Error:", err.message);

    const snapshotPath = path.join(
      __dirname, "..", "src", "lib", "data", "dmaAudienceData.snapshot.ts"
    );
    const generatedPath = path.join(
      __dirname, "..", "src", "lib", "data", "dmaAudienceData.generated.ts"
    );

    if (fs.existsSync(snapshotPath)) {
      console.log("Falling back to checked-in snapshot...");
      fs.copyFileSync(snapshotPath, generatedPath);
      console.log("Copied snapshot → generated. Build can proceed.");
    } else {
      console.error("No snapshot found. Build will fail.");
      process.exit(1);
    }
  }
}

main();
