import React from 'react';

export default function DataExportPanel({ onExportJson, onExportCsv, hasChartData }) {
  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Data Export
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onExportJson}
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100
                     transition hover:border-lab-accent hover:bg-sky-950"
        >
          Scene JSON
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          disabled={!hasChartData}
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100
                     transition hover:border-lab-accent hover:bg-sky-950
                     disabled:cursor-not-allowed disabled:opacity-40"
        >
          Chart CSV
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        JSON includes the current scene state. CSV includes the dashboard time,
        velocity, and kinetic-energy samples.
      </p>
    </div>
  );
}
