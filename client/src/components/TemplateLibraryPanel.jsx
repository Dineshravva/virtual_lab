import React, { useMemo, useState } from 'react';
import { experimentTemplates } from '../utils/learningContent';

export default function TemplateLibraryPanel({ onLoadTemplate }) {
  const topics = useMemo(() => {
    return [...new Set(experimentTemplates.map((template) => template.topic))];
  }, []);
  const [activeTopic, setActiveTopic] = useState(topics[0]);

  const visibleTemplates = experimentTemplates.filter(
    (template) => template.topic === activeTopic
  );

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Template Library
      </h3>

      <div className="mb-3 flex flex-wrap gap-1">
        {topics.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => setActiveTopic(topic)}
            className={`rounded border px-2 py-1 text-xs transition ${
              activeTopic === topic
                ? 'border-lab-accent bg-sky-950 text-white'
                : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600'
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleTemplates.map((template) => (
          <div
            key={template.id}
            className="rounded border border-gray-800 bg-gray-900 p-3"
          >
            <div className="text-sm font-semibold text-white">{template.name}</div>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              {template.description}
            </p>
            <button
              type="button"
              onClick={() => onLoadTemplate(template)}
              className="mt-2 rounded border border-gray-700 px-2 py-1.5 text-xs text-gray-200
                         transition hover:border-lab-accent hover:bg-sky-950"
            >
              Load Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
