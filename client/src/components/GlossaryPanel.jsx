import React, { useMemo, useState } from 'react';
import { glossaryTerms } from '../utils/learningContent';

export default function GlossaryPanel() {
  const [query, setQuery] = useState('');

  const filteredTerms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return glossaryTerms;
    return glossaryTerms.filter((item) => {
      return (
        item.term.toLowerCase().includes(normalized) ||
        item.definition.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Glossary
      </h3>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search terms"
        className="mb-3 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                   text-sm text-white placeholder-gray-500 focus:border-lab-accent focus:outline-none"
      />

      <div className="space-y-2">
        {filteredTerms.map((item) => (
          <details
            key={item.term}
            className="rounded border border-gray-800 bg-gray-900 p-2"
          >
            <summary className="cursor-pointer text-sm font-medium text-white">
              {item.term}
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              {item.definition}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
