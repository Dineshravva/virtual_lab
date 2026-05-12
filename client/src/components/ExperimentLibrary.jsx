import React, { useEffect, useState, useCallback } from 'react';
import { fetchExperiments } from '../services/api';

// Sidebar panel for saving and loading experiments to/from MongoDB.
export default function ExperimentLibrary({
  onSave,
  onLoad,
  onNotify,
  refreshToken
}) {
  const [experiments, setExperiments] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExperiments();
      setExperiments(data);
      setError('');
    } catch (err) {
      console.error('[library] failed to fetch experiments', err);
      setError('Could not reach server');
      if (onNotify) {
        onNotify('Could not reach the experiment server.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshToken]);

  const handleSave = async () => {
    const trimmed = name.trim();
    const showValidationError = (message) => {
      setError(message);
      if (onNotify) onNotify(message, 'error');
    };

    if (!trimmed) {
      showValidationError('Experiment name is required.');
      return;
    }

    const duplicate = experiments.some(
      (exp) => exp.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      showValidationError('An experiment with this name already exists.');
      return;
    }

    setBusy(true);
    try {
      await onSave(trimmed);
      setName('');
      setError('');
      await refresh();
    } catch (err) {
      console.error('[library] save failed', err);
      const message =
        err.response && err.response.data && err.response.data.error
          ? err.response.data.error
          : err.message || 'Save failed. Please try again.';
      setError(message);
      if (onNotify) {
        onNotify(message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Experiment Library
      </h3>

      <div className="flex gap-2 mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Experiment name"
          className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded
                     text-sm text-white focus:outline-none focus:border-lab-accent
                     placeholder-gray-500"
        />
        <button
          onClick={handleSave}
          disabled={busy || !name.trim()}
          className="px-3 py-1.5 bg-lab-accent hover:bg-sky-400 disabled:opacity-50
                     disabled:cursor-not-allowed text-black text-sm rounded font-semibold transition"
        >
          Save
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-2">{error}</p>
      )}

      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {loading && (
          <p className="text-xs text-gray-500">Loading experiments...</p>
        )}
        {!loading && experiments.length === 0 && !error && (
          <p className="text-xs text-gray-500">No experiments saved yet.</p>
        )}
        {experiments.map((exp) => (
          <div
            key={exp._id}
            className="flex justify-between items-center bg-gray-900 px-2 py-1.5 rounded text-xs border border-gray-800"
          >
            <div className="truncate">
              <div className="text-white truncate">{exp.name}</div>
              <div className="text-gray-500 text-[10px]">
                {exp.bodies ? exp.bodies.length : 0} bodies
              </div>
            </div>
            <button
              onClick={() => onLoad(exp)}
              className="text-lab-accent hover:underline ml-2"
            >
              Load
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
