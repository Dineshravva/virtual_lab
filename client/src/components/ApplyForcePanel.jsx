import React, { useEffect, useState } from 'react';

// Convert (magnitude, angleDeg) to canvas-space (x, y).
// Angle convention: 0 deg = right, 90 deg = up, 180 deg = left, 270 deg = down.
// Canvas y is inverted (down is positive y), so vy flips sign.
export function angleToCanvasVector(magnitude, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: magnitude * Math.cos(rad),
    y: -magnitude * Math.sin(rad)
  };
}

const MIN_MAGNITUDE = 0;
const MAX_FORCE = 0.2;        // Matter forces are tiny — applyForce expects values like 0.001..0.1
const MAX_VELOCITY = 30;      // px / step — anything past 30 is teleport-fast
const MAX_FORCE_DISPLAY = 200; // we let the user enter Newtons; convert internally

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function ApplyForcePanel({ selectedBody, onPreviewChange, onApply }) {
  const [mode, setMode] = useState('velocity');
  const [magnitude, setMagnitude] = useState(10);
  const [angle, setAngle] = useState(90); // start pointing up

  // Push preview to the canvas whenever any field changes (or selection changes)
  useEffect(() => {
    if (!selectedBody) {
      onPreviewChange(null);
      return;
    }
    onPreviewChange({
      networkId: selectedBody.networkId,
      mode,
      magnitude: Number(magnitude) || 0,
      angle: Number(angle) || 0
    });
  }, [selectedBody, mode, magnitude, angle, onPreviewChange]);

  // Hide the preview when the panel unmounts (e.g. user navigates away).
  useEffect(() => {
    return () => onPreviewChange(null);
  }, [onPreviewChange]);

  if (!selectedBody) {
    return (
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-lab-accent mb-2 uppercase tracking-wide">
          Apply Force / Velocity
        </h3>
        <p className="text-xs text-gray-500">Select a body to apply a force or velocity.</p>
      </div>
    );
  }

  const safeMagnitude = clamp(
    Number(magnitude) || 0,
    MIN_MAGNITUDE,
    mode === 'force' ? MAX_FORCE_DISPLAY : MAX_VELOCITY
  );
  const safeAngle = ((Number(angle) || 0) % 360 + 360) % 360;

  const handleApply = () => {
    onApply({
      networkId: selectedBody.networkId,
      mode,
      magnitude: safeMagnitude,
      angle: safeAngle
    });
  };

  // SVG dial: 0deg points right; we want the arrow to follow standard
  // math convention (90 = up). Canvas SVG y grows downward so we flip.
  const rad = (safeAngle * Math.PI) / 180;
  const dialRadius = 28;
  const arrowEndX = 36 + dialRadius * Math.cos(rad);
  const arrowEndY = 36 - dialRadius * Math.sin(rad);

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Apply Force / Velocity
      </h3>

      <div className="mb-3 flex rounded border border-gray-700 overflow-hidden">
        {['velocity', 'force'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            aria-pressed={mode === option}
            className={`flex-1 px-2 py-1.5 text-xs uppercase tracking-wide transition ${
              mode === option
                ? 'bg-indigo-700 text-white'
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <label className="block text-xs text-gray-400">
          Magnitude {mode === 'force' ? '(N)' : '(m/s)'}
          <input
            type="number"
            min={MIN_MAGNITUDE}
            step={mode === 'force' ? '1' : '0.5'}
            max={mode === 'force' ? MAX_FORCE_DISPLAY : MAX_VELOCITY}
            value={magnitude}
            onChange={(e) => setMagnitude(e.target.value)}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                       text-sm text-white focus:border-lab-accent focus:outline-none"
          />
        </label>

        <div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Angle (deg)</span>
            <span className="font-mono text-gray-300">{safeAngle.toFixed(0)}&deg;</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <svg width="72" height="72" className="rounded border border-gray-700 bg-gray-900">
              <circle cx="36" cy="36" r={dialRadius} fill="none" stroke="#374151" strokeWidth="1" />
              <line x1="6" y1="36" x2="66" y2="36" stroke="#1f2937" strokeWidth="1" />
              <line x1="36" y1="6" x2="36" y2="66" stroke="#1f2937" strokeWidth="1" />
              <line
                x1="36"
                y1="36"
                x2={arrowEndX}
                y2={arrowEndY}
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={arrowEndX} cy={arrowEndY} r="3" fill="#38bdf8" />
            </svg>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={safeAngle}
              onChange={(e) => setAngle(e.target.value)}
              className="flex-1 accent-sky-400"
              aria-label="Angle in degrees"
            />
          </div>
          <input
            type="number"
            min="0"
            max="360"
            step="1"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            className="mt-2 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                       text-sm text-white focus:border-lab-accent focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleApply}
          disabled={safeMagnitude <= 0}
          className="w-full rounded bg-lab-accent px-3 py-2 text-sm font-semibold text-black
                     transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply {mode === 'force' ? 'Force' : 'Velocity'}
        </button>

        <p className="text-[11px] leading-relaxed text-gray-500">
          Hinged blocks ignore translation (constraint pins them in place); pendulum
          blocks receive only the tangential component; free, spring, rod, and string blocks
          take the full vector.
        </p>
      </div>
    </div>
  );
}
