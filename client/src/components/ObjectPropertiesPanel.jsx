import React, { useEffect, useState } from 'react';

const DEFAULT_FORM = {
  mass: '',
  friction: '',
  restitution: '',
  color: '#38bdf8'
};

function formatNumber(value) {
  if (typeof value !== 'number') return '';
  return Number(value.toFixed(2)).toString();
}

export default function ObjectPropertiesPanel({ selectedBody, onUpdate }) {
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (!selectedBody) {
      setForm(DEFAULT_FORM);
      return;
    }

    setForm({
      mass: formatNumber(selectedBody.mass),
      friction: formatNumber(selectedBody.friction),
      restitution: formatNumber(selectedBody.restitution),
      color: selectedBody.color || DEFAULT_FORM.color
    });
  }, [selectedBody]);

  const updateNumber = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    const numeric = Number(value);
    if (!selectedBody || !Number.isFinite(numeric)) return;
    onUpdate(selectedBody.networkId, { [field]: numeric });
  };

  const updateColor = (value) => {
    setForm((current) => ({ ...current, color: value }));
    if (!selectedBody || !/^#[0-9a-fA-F]{6}$/.test(value)) return;
    onUpdate(selectedBody.networkId, { color: value });
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Object Properties
      </h3>

      {!selectedBody ? (
        <p className="text-xs text-gray-500">Select a body to edit it.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="uppercase tracking-wide">{selectedBody.type}</span>
            <span className="font-mono text-[10px] text-gray-500">
              {selectedBody.networkId.slice(-6)}
            </span>
          </div>

          <label className="block text-xs text-gray-400">
            Mass
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={form.mass}
              onChange={(e) => updateNumber('mass', e.target.value)}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                         text-sm text-white focus:border-lab-accent focus:outline-none"
            />
          </label>

          <label className="block text-xs text-gray-400">
            Friction
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={form.friction}
              onChange={(e) => updateNumber('friction', e.target.value)}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                         text-sm text-white focus:border-lab-accent focus:outline-none"
            />
          </label>

          <label className="block text-xs text-gray-400">
            Restitution
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={form.restitution}
              onChange={(e) => updateNumber('restitution', e.target.value)}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                         text-sm text-white focus:border-lab-accent focus:outline-none"
            />
          </label>

          <label className="block text-xs text-gray-400">
            Colour
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(form.color)
                    ? form.color
                    : DEFAULT_FORM.color
                }
                onChange={(e) => updateColor(e.target.value)}
                className="h-9 w-12 rounded border border-gray-700 bg-gray-900 p-1"
              />
              <input
                value={form.color}
                onChange={(e) => updateColor(e.target.value)}
                className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                           font-mono text-sm text-white focus:border-lab-accent focus:outline-none"
              />
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
