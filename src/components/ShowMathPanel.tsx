"use client";

import { useState } from "react";

export default function ShowMathPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-unlock-light-gray bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-unlock-dark-gray hover:bg-gray-50 transition-colors"
      >
        <span>Show Math &amp; Formulas</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.063a.75.75 0 111.1 1.02l-4.25 4.65a.75.75 0 01-1.1 0l-4.25-4.65a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="border-t border-unlock-light-gray px-4 py-4 text-sm text-unlock-dark-gray space-y-4">
          <section>
            <h4 className="font-semibold mb-1 text-unlock-black">Basic Conversions</h4>
            <ul className="list-disc list-inside space-y-1 text-unlock-medium-gray font-mono text-xs">
              <li>Gross Impressions = (Cost / CPM) × 1,000</li>
              <li>GRPs = (Gross Impressions / Target Population) × 100</li>
              <li>GRPs = Reach% × Frequency</li>
              <li>Average Frequency = GRPs / Reach%</li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold mb-1 text-unlock-black">Effective 3+ Reach (Poisson Approximation)</h4>
            <ul className="list-disc list-inside space-y-1 text-unlock-medium-gray font-mono text-xs">
              <li>λ = GRPs / 100</li>
              <li>P(0) = e<sup>−λ</sup></li>
              <li>P(1) = λ × e<sup>−λ</sup></li>
              <li>P(2) = (λ² / 2) × e<sup>−λ</sup></li>
              <li>P(3+) = 1 − P(0) − P(1) − P(2)</li>
              <li>Effective 3+% = P(3+) × 100</li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold mb-1 text-unlock-black">Combined Reach (Sequential Remainder Method)</h4>
            <ul className="list-disc list-inside space-y-1 text-unlock-medium-gray font-mono text-xs">
              <li>Sort tactics by Reach% descending</li>
              <li>Start: runningTotal = highestReach%</li>
              <li>For each next tactic:</li>
              <li className="ml-4">remainder = 100 − runningTotal</li>
              <li className="ml-4">incremental = remainder × (nextReach% / 100)</li>
              <li className="ml-4">runningTotal += incremental</li>
            </ul>
            <p className="mt-1 text-xs text-unlock-medium-gray">
              Equivalent to: combinedReach% = 100 × (1 − Π(1 − r<sub>i</sub>/100))
            </p>
          </section>

          <section>
            <h4 className="font-semibold mb-1 text-unlock-black">Plan-Level Metrics</h4>
            <ul className="list-disc list-inside space-y-1 text-unlock-medium-gray font-mono text-xs">
              <li>Total GRPs = Σ(tactic GRPs)</li>
              <li>Combined Avg Frequency = Total GRPs / Combined Reach%</li>
              <li>Combined Eff. 3+ uses Poisson on Total GRPs</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
