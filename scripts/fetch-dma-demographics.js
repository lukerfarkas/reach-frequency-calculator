#!/usr/bin/env node

/**
 * Fetches US Census ACS 5-Year county-level population data by age/sex,
 * aggregates to Nielsen DMAs using a county-to-DMA crosswalk, and writes
 * the result as a TypeScript data file for the Reach & Frequency Calculator.
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
// See: https://api.census.gov/data/2023/acs/acs5/variables.html
// B01001_001E = Total population
// Male cells: B01001_003E..B01001_025E
// Female cells: B01001_027E..B01001_049E

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
// Demographic break definitions
// ---------------------------------------------------------------------------

/**
 * Each demo is a function that takes a county's Census row object and returns
 * the population count for that demographic break.
 */
function sumVars(row, vars) {
  return vars.reduce((sum, v) => sum + (parseInt(row[v], 10) || 0), 0);
}

// Male 18+ variable codes
const MALE_18_19 = ["B01001_007E"];
const MALE_20 = ["B01001_008E"];
const MALE_21 = ["B01001_009E"];
const MALE_22_24 = ["B01001_010E"];
const MALE_25_29 = ["B01001_011E"];
const MALE_30_34 = ["B01001_012E"];
const MALE_35_39 = ["B01001_013E"];
const MALE_40_44 = ["B01001_014E"];
const MALE_45_49 = ["B01001_015E"];
const MALE_50_54 = ["B01001_016E"];
const MALE_55_59 = ["B01001_017E"];
const MALE_60_61 = ["B01001_018E"];
const MALE_62_64 = ["B01001_019E"];
const MALE_65_66 = ["B01001_020E"];
const MALE_67_69 = ["B01001_021E"];
const MALE_70_74 = ["B01001_022E"];
const MALE_75_79 = ["B01001_023E"];
const MALE_80_84 = ["B01001_024E"];
const MALE_85_PLUS = ["B01001_025E"];

const FEMALE_18_19 = ["B01001_031E"];
const FEMALE_20 = ["B01001_032E"];
const FEMALE_21 = ["B01001_033E"];
const FEMALE_22_24 = ["B01001_034E"];
const FEMALE_25_29 = ["B01001_035E"];
const FEMALE_30_34 = ["B01001_036E"];
const FEMALE_35_39 = ["B01001_037E"];
const FEMALE_40_44 = ["B01001_038E"];
const FEMALE_45_49 = ["B01001_039E"];
const FEMALE_50_54 = ["B01001_040E"];
const FEMALE_55_59 = ["B01001_041E"];
const FEMALE_60_61 = ["B01001_042E"];
const FEMALE_62_64 = ["B01001_043E"];
const FEMALE_65_66 = ["B01001_044E"];
const FEMALE_67_69 = ["B01001_045E"];
const FEMALE_70_74 = ["B01001_046E"];
const FEMALE_75_79 = ["B01001_047E"];
const FEMALE_80_84 = ["B01001_048E"];
const FEMALE_85_PLUS = ["B01001_049E"];

const MALE_18_PLUS = [
  ...MALE_18_19, ...MALE_20, ...MALE_21, ...MALE_22_24,
  ...MALE_25_29, ...MALE_30_34, ...MALE_35_39, ...MALE_40_44,
  ...MALE_45_49, ...MALE_50_54, ...MALE_55_59, ...MALE_60_61,
  ...MALE_62_64, ...MALE_65_66, ...MALE_67_69, ...MALE_70_74,
  ...MALE_75_79, ...MALE_80_84, ...MALE_85_PLUS,
];

const FEMALE_18_PLUS = [
  ...FEMALE_18_19, ...FEMALE_20, ...FEMALE_21, ...FEMALE_22_24,
  ...FEMALE_25_29, ...FEMALE_30_34, ...FEMALE_35_39, ...FEMALE_40_44,
  ...FEMALE_45_49, ...FEMALE_50_54, ...FEMALE_55_59, ...FEMALE_60_61,
  ...FEMALE_62_64, ...FEMALE_65_66, ...FEMALE_67_69, ...FEMALE_70_74,
  ...FEMALE_75_79, ...FEMALE_80_84, ...FEMALE_85_PLUS,
];

// Age range helper: male vars + female vars for an age range
function ageRange(maleVars, femaleVars) {
  return [...maleVars, ...femaleVars];
}

const ADULTS_18_PLUS = ageRange(MALE_18_PLUS, FEMALE_18_PLUS);

const MALE_18_24 = [...MALE_18_19, ...MALE_20, ...MALE_21, ...MALE_22_24];
const FEMALE_18_24 = [...FEMALE_18_19, ...FEMALE_20, ...FEMALE_21, ...FEMALE_22_24];
const MALE_18_34 = [...MALE_18_24, ...MALE_25_29, ...MALE_30_34];
const FEMALE_18_34 = [...FEMALE_18_24, ...FEMALE_25_29, ...FEMALE_30_34];
const MALE_18_49 = [...MALE_18_34, ...MALE_35_39, ...MALE_40_44, ...MALE_45_49];
const FEMALE_18_49 = [...FEMALE_18_34, ...FEMALE_35_39, ...FEMALE_40_44, ...FEMALE_45_49];
const MALE_25_54 = [...MALE_25_29, ...MALE_30_34, ...MALE_35_39, ...MALE_40_44, ...MALE_45_49, ...MALE_50_54];
const FEMALE_25_54 = [...FEMALE_25_29, ...FEMALE_30_34, ...FEMALE_35_39, ...FEMALE_40_44, ...FEMALE_45_49, ...FEMALE_50_54];
const MALE_35_54 = [...MALE_35_39, ...MALE_40_44, ...MALE_45_49, ...MALE_50_54];
const FEMALE_35_54 = [...FEMALE_35_39, ...FEMALE_40_44, ...FEMALE_45_49, ...FEMALE_50_54];
const MALE_35_64 = [...MALE_35_54, ...MALE_55_59, ...MALE_60_61, ...MALE_62_64];
const FEMALE_35_64 = [...FEMALE_35_54, ...FEMALE_55_59, ...FEMALE_60_61, ...FEMALE_62_64];
const MALE_55_PLUS = [...MALE_55_59, ...MALE_60_61, ...MALE_62_64, ...MALE_65_66, ...MALE_67_69, ...MALE_70_74, ...MALE_75_79, ...MALE_80_84, ...MALE_85_PLUS];
const FEMALE_55_PLUS = [...FEMALE_55_59, ...FEMALE_60_61, ...FEMALE_62_64, ...FEMALE_65_66, ...FEMALE_67_69, ...FEMALE_70_74, ...FEMALE_75_79, ...FEMALE_80_84, ...FEMALE_85_PLUS];

const DEMO_DEFINITIONS = [
  { id: "a18plus", label: "Adults 18+", vars: ADULTS_18_PLUS },
  { id: "a18_49", label: "Adults 18-49", vars: ageRange(MALE_18_49, FEMALE_18_49) },
  { id: "a25_54", label: "Adults 25-54", vars: ageRange(MALE_25_54, FEMALE_25_54) },
  { id: "a18_34", label: "Adults 18-34", vars: ageRange(MALE_18_34, FEMALE_18_34) },
  { id: "a35_54", label: "Adults 35-54", vars: ageRange(MALE_35_54, FEMALE_35_54) },
  { id: "a35_64", label: "Adults 35-64", vars: ageRange(MALE_35_64, FEMALE_35_64) },
  { id: "a55plus", label: "Adults 55+", vars: ageRange(MALE_55_PLUS, FEMALE_55_PLUS) },
  { id: "m18_49", label: "Males 18-49", vars: MALE_18_49 },
  { id: "m25_54", label: "Males 25-54", vars: MALE_25_54 },
  { id: "f18_49", label: "Females 18-49", vars: FEMALE_18_49 },
  { id: "f25_54", label: "Females 25-54", vars: FEMALE_25_54 },
  { id: "hh", label: "Households", vars: ["B11001_001E"] },
];

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

  // data[0] is header, data[1..] are rows
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

  const map = {}; // fips → { dmaCode, dmaName }
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const fips = cols[fipsIdx];
    const dmaCode = cols[dmaCodeIdx];
    const dmaName = cols[dmaNameIdx];
    if (fips && dmaCode && dmaCode !== "0") {
      // Skip dma_code=0 (non-DMA remote Alaska counties)
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
// Aggregation
// ---------------------------------------------------------------------------

function aggregateToDMAs(censusRows, crosswalk) {
  // Initialize DMA accumulators
  const dmaAccum = {}; // dmaCode → { dmaName, demos: { demoId → count } }

  let matched = 0;
  let unmatched = 0;

  for (const row of censusRows) {
    const fips = row["state"] + row["county"]; // Census returns state + county separately
    const mapping = crosswalk[fips];
    if (!mapping) {
      unmatched++;
      continue;
    }
    matched++;

    const { dmaCode, dmaName } = mapping;
    if (!dmaAccum[dmaCode]) {
      dmaAccum[dmaCode] = { dmaName, demos: {} };
      for (const demo of DEMO_DEFINITIONS) {
        dmaAccum[dmaCode].demos[demo.id] = 0;
      }
    }

    for (const demo of DEMO_DEFINITIONS) {
      dmaAccum[dmaCode].demos[demo.id] += sumVars(row, demo.vars);
    }
  }

  console.log(`Matched ${matched} counties, ${unmatched} unmatched`);

  // Compute national totals
  const nationalDemos = {};
  for (const demo of DEMO_DEFINITIONS) {
    nationalDemos[demo.id] = 0;
  }
  for (const dma of Object.values(dmaAccum)) {
    for (const demo of DEMO_DEFINITIONS) {
      nationalDemos[demo.id] += dma.demos[demo.id];
    }
  }

  return { dmaAccum, nationalDemos };
}

// ---------------------------------------------------------------------------
// Output generation
// ---------------------------------------------------------------------------

function generateTypeScript(dmaAccum, nationalDemos) {
  // Build DMA list sorted alphabetically with US National first
  const dmaEntries = Object.entries(dmaAccum)
    .map(([code, data]) => ({ code, name: data.dmaName }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const dmaList = [
    { code: "0", name: "US National" },
    ...dmaEntries,
  ];

  const demoList = DEMO_DEFINITIONS.map((d) => ({
    id: d.id,
    label: d.label,
  }));

  // Build audience size map
  const audienceMap = {};

  // National
  for (const demo of DEMO_DEFINITIONS) {
    audienceMap[`0|${demo.id}`] = nationalDemos[demo.id];
  }

  // Per DMA
  for (const [code, data] of Object.entries(dmaAccum)) {
    for (const demo of DEMO_DEFINITIONS) {
      audienceMap[`${code}|${demo.id}`] = data.demos[demo.id];
    }
  }

  const totalEntries = Object.keys(audienceMap).length;
  const totalDMAs = dmaList.length;

  let ts = `/**
 * DMA Audience Data — Auto-generated from US Census ACS ${ACS_YEAR} 5-Year Estimates
 * Generated: ${new Date().toISOString()}
 * Source: api.census.gov table B01001 (Sex by Age) + B11001 (Households)
 *
 * DO NOT EDIT — regenerate with: node scripts/fetch-dma-demographics.js
 */

export const DMA_LIST: { code: string; name: string }[] = ${JSON.stringify(dmaList, null, 2)};

export const DEMO_LIST: { id: string; label: string }[] = ${JSON.stringify(demoList, null, 2)};

export const AUDIENCE_SIZE_MAP: Record<string, number> = ${JSON.stringify(audienceMap, null, 2)};

export function lookupAudienceSize(dmaCode: string, demoId: string): number | null {
  return AUDIENCE_SIZE_MAP[\`\${dmaCode}|\${demoId}\`] ?? null;
}
`;

  console.log(`Generated ${totalDMAs} DMAs × ${DEMO_DEFINITIONS.length} demos = ${totalEntries} entries`);
  return ts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    const crosswalk = loadCrosswalk();
    const censusRows = await fetchCensusData();
    const { dmaAccum, nationalDemos } = aggregateToDMAs(censusRows, crosswalk);
    const tsContent = generateTypeScript(dmaAccum, nationalDemos);

    // Write generated file
    const generatedPath = path.join(
      __dirname,
      "..",
      "src",
      "lib",
      "data",
      "dmaAudienceData.generated.ts"
    );
    fs.writeFileSync(generatedPath, tsContent);
    console.log(`Written: ${generatedPath}`);

    // Also write snapshot (checked into git)
    const snapshotPath = path.join(
      __dirname,
      "..",
      "src",
      "lib",
      "data",
      "dmaAudienceData.snapshot.ts"
    );
    fs.writeFileSync(snapshotPath, tsContent);
    console.log(`Snapshot: ${snapshotPath}`);

    console.log("Done!");
  } catch (err) {
    console.error("Error:", err.message);

    // If the API fails, check if snapshot exists and copy to generated
    const snapshotPath = path.join(
      __dirname,
      "..",
      "src",
      "lib",
      "data",
      "dmaAudienceData.snapshot.ts"
    );
    const generatedPath = path.join(
      __dirname,
      "..",
      "src",
      "lib",
      "data",
      "dmaAudienceData.generated.ts"
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
