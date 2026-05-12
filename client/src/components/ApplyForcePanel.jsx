import React, { useEffect, useState, useCallback } from 'react';

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
const MAX_DURATION = 30;      // max continuous duration in seconds
const MIN_DURATION = 0.1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Application modes for force and velocity
const FORCE_APPLY_MODES = [
  { id: 'impulse', label: 'Impulse', desc: 'Instant one-time push' },
  { id: 'constant', label: 'Constant', desc: 'Continuous force for a duration' },
  { id: 'variable', label: 'Variable', desc: 'Force ramps up then down' }
];
const VELOCITY_APPLY_MODES = [
  { id: 'instant', label: 'Instant', desc: 'Set velocity once' },
  { id: 'continuous', label: 'Continuous', desc: 'Maintain velocity steadily' },
  { id: 'timed', label: 'Timed', desc: 'Gradually change over time' }
];

export default function ApplyForcePanel({ selectedBody, onPreviewChange, onApply, onStopContinuous, activeForceId }) {
  const [mode, setMode] = useState('velocity');
  const [magnitude, setMagnitude] = useState(10);
  const [angle, setAngle] = useState(90); // start pointing up
  const [applyMode, setApplyMode] = useState('impulse'); // force: impulse | constant | variable
  const [duration, setDuration] = useState(3);
  const [continuous, setContinuous] = useState(false);
  const [rampUp, setRampUp] = useState(0.5); // fraction of duration for ramp-up (variable mode)

  // Reset apply mode when switching between force/velocity
  useEffect(() => {
    if (mode === 'force') {
      setApplyMode('impulse');
    } else {
      setApplyMode('instant');
    }
  }, [mode]);

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
  const safeDuration = clamp(Number(duration) || 1, MIN_DURATION, MAX_DURATION);

  const isForce = mode === 'force';
  const currentModes = isForce ? FORCE_APPLY_MODES : VELOCITY_APPLY_MODES;
  const needsDuration = isForce
    ? (applyMode === 'constant' || applyMode === 'variable')
    : (applyMode === 'continuous' || applyMode === 'timed');
  const isRunning = !!activeForceId;

  const handleApply = () => {
    onApply({
      networkId: selectedBody.networkId,
      mode,
      magnitude: safeMagnitude,
      angle: safeAngle,
      applyMode,
      duration: needsDuration ? safeDuration : 0,
      continuous: needsDuration ? continuous : false,
      rampUp: applyMode === 'variable' ? clamp(rampUp, 0.1, 0.9) : 0.5
    });
  };

  const handleStop = () => {
    if (onStopContinuous) onStopContinuous();
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

      {/* Force / Velocity Toggle */}
      <div className="mb-3 flex rounded border border-gray-700 overflow-hidden">
        {['velocity', 'force'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            aria-pressed={mode === option}
            disabled={isRunning}
            className={`flex-1 px-2 py-1.5 text-xs uppercase tracking-wide transition ${
              mode === option
                ? 'bg-indigo-700 text-white'
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Application Mode Selector */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
          Application Mode
        </div>
        <div className="flex rounded border border-gray-700 overflow-hidden">
          {currentModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setApplyMode(m.id)}
              disabled={isRunning}
              title={m.desc}
              className={`flex-1 px-1.5 py-1.5 text-[10px] uppercase tracking-wide transition ${
                applyMode === m.id
                  ? 'bg-emerald-700 text-white'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-gray-500 leading-relaxed">
          {currentModes.find((m) => m.id === applyMode)?.desc}
        </p>
      </div>

      <div className="space-y-3">
        {/* Magnitude */}
        <label className="block text-xs text-gray-400">
          Magnitude {isForce ? '(N)' : '(m/s)'}
          <input
            type="number"
            min={MIN_MAGNITUDE}
            step={isForce ? '1' : '0.5'}
            max={isForce ? MAX_FORCE_DISPLAY : MAX_VELOCITY}
            value={magnitude}
            onChange={(e) => setMagnitude(e.target.value)}
            disabled={isRunning}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                       text-sm text-white focus:border-lab-accent focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {/* Angle Control */}
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
                stroke={isRunning ? '#10b981' : '#38bdf8'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={arrowEndX} cy={arrowEndY} r="3" fill={isRunning ? '#10b981' : '#38bdf8'} />
            </svg>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={safeAngle}
              onChange={(e) => setAngle(e.target.value)}
              disabled={isRunning}
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
            disabled={isRunning}
            className="mt-2 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                       text-sm text-white focus:border-lab-accent focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Duration & Continuous Toggle — only for non-impulse modes */}
        {needsDuration && (
          <div className="rounded border border-gray-800 bg-gray-900/50 p-3 space-y-2">
            <label className="block text-xs text-gray-400">
              Duration (seconds)
              <input
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                step="0.1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={isRunning || continuous}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                           text-sm text-white focus:border-lab-accent focus:outline-none
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
                disabled={isRunning}
                className="rounded border-gray-600 bg-gray-800 text-emerald-500
                           focus:ring-emerald-500 focus:ring-offset-0 accent-emerald-500"
              />
              Continuous (no time limit)
            </label>

            {applyMode === 'variable' && (
              <label className="block text-xs text-gray-400">
                Ramp-Up ({Math.round(rampUp * 100)}% of duration)
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={rampUp}
                  onChange={(e) => setRampUp(Number(e.target.value))}
                  disabled={isRunning}
                  className="mt-1 w-full accent-amber-400"
                  aria-label="Ramp-up fraction"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>Quick ramp</span>
                  <span>Slow ramp</span>
                </div>
              </label>
            )}
          </div>
        )}

        {/* Apply / Stop Buttons */}
        {isRunning ? (
          <button
            type="button"
            onClick={handleStop}
            className="w-full rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white
                       transition hover:bg-red-500 flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop {isForce ? 'Force' : 'Velocity'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={safeMagnitude <= 0}
            className="w-full rounded bg-lab-accent px-3 py-2 text-sm font-semibold text-black
                       transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply {isForce ? 'Force' : 'Velocity'}
            {needsDuration && !continuous && ` (${safeDuration}s)`}
            {needsDuration && continuous && ' (∞)'}
          </button>
        )}

        {/* Active indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 rounded border border-emerald-800 bg-emerald-950/50 px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-300 font-medium">
              {isForce ? 'Force' : 'Velocity'} active
            </span>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-gray-500">
          Hinged blocks ignore translation (constraint pins them in place); pendulum
          blocks receive only the tangential component; free, spring, rod, and string blocks
          take the full vector.
        </p>
      </div>
    </div>
  );
}
