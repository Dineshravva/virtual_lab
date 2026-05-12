import React from 'react';
import Tooltip from './Tooltip';

// Sidebar panel that lets users add constraints between bodies.
export default function ConstraintPanel({
  constraints = [],
  activeTool,
  onAddConstraint,
  onRemoveConstraint
}) {
  const shortId = (id) => (id ? id.slice(-6) : 'new');
  const isPivotMode = activeTool === 'pivot';
  const labelForType = (type) => {
    if (type === 'rope') return 'rod';
    return type;
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-2 uppercase tracking-wide">
        Constraints
      </h3>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        Rod, String, and Spring connect the two most recent bodies. Pivot asks for a body first.
      </p>
      {isPivotMode && (
        <p className="mb-3 rounded border border-amber-500/40 bg-amber-950/30 px-2 py-1.5 text-xs text-amber-100">
          Select a body on the canvas for the pivot.
        </p>
      )}
      <div className="grid grid-cols-4 gap-2">
        <Tooltip text="Rod: keeps two bodies at a fixed distance, resisting both stretching and compression.">
          <button
            type="button"
            onClick={() => onAddConstraint('rod')}
            className="w-full px-2 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded
                       text-xs border border-gray-700 transition"
          >
            Rod
          </button>
        </Tooltip>
        <Tooltip text="String: goes slack when compressed and pulls only when stretched to its length.">
          <button
            type="button"
            onClick={() => onAddConstraint('string')}
            className="w-full px-2 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded
                       text-xs border border-gray-700 transition"
          >
            String
          </button>
        </Tooltip>
        <Tooltip text="Spring: applies a restoring force proportional to stretch, producing oscillation around equilibrium.">
          <button
            type="button"
            onClick={() => onAddConstraint('spring')}
            className="w-full px-2 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded
                       text-xs border border-gray-700 transition"
          >
            Spring
          </button>
        </Tooltip>
        <Tooltip text="Pivot: fixes one point of a body in space, allowing rotation like a hinge or pendulum support.">
          <button
            type="button"
            onClick={() => onAddConstraint('pivot')}
            className={`w-full px-2 py-2 text-white rounded text-xs border transition ${
              isPivotMode
                ? 'border-amber-400 bg-amber-700 hover:bg-amber-600'
                : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Pivot
          </button>
        </Tooltip>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Active
          </h4>
          <span className="text-[10px] text-gray-500">{constraints.length}</span>
        </div>

        {constraints.length === 0 ? (
          <p className="text-xs text-gray-500">No constraints yet.</p>
        ) : (
          <div className="space-y-1">
            {constraints.map((constraint) => (
              <div
                key={constraint.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-800
                           bg-gray-900 px-2 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium capitalize text-white">
                    {labelForType(constraint.type)}
                  </div>
                  <div className="truncate font-mono text-[10px] text-gray-500">
                    {constraint.type === 'pivot'
                      ? shortId(constraint.bodyA)
                      : `${shortId(constraint.bodyA)} -> ${shortId(constraint.bodyB)}`}
                  </div>
                </div>
                <Tooltip text="Delete constraint: removes the force relationship so the connected body or bodies move freely again.">
                  <button
                    type="button"
                    onClick={() => onRemoveConstraint(constraint.id)}
                    className="rounded border border-gray-700 px-2 py-1 text-gray-200 transition
                               hover:border-red-500 hover:bg-red-950 hover:text-red-200"
                    aria-label={`Delete ${labelForType(constraint.type)} constraint`}
                  >
                    X
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
