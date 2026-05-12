import React, { useCallback, useEffect, useState } from 'react';

/**
 * Sidebar panel for controlling selected plane properties:
 *   - Angle (0°–90°) via slider + number input
 *   - Length (60–600 px) via slider + number input
 *   - Lock / Unlock toggle button
 *
 * Only visible when a plane body is selected.
 */
export default function PlaneControlsPanel({
  selectedBody,
  canvasRef
}) {
  const [angle, setAngle] = useState(0);
  const [length, setLength] = useState(200);
  const [locked, setLocked] = useState(false);

  // Sync local state when a plane is selected or its info changes
  useEffect(() => {
    if (
      !selectedBody ||
      selectedBody.type !== 'plane' ||
      !canvasRef.current
    ) {
      return;
    }
    const info = canvasRef.current.getPlaneInfo(selectedBody.networkId);
    if (info) {
      setAngle(info.angle);
      setLength(info.length);
      setLocked(info.locked);
    }
  }, [selectedBody, canvasRef]);

  const handleAngleChange = useCallback((value) => {
    const v = Math.max(0, Math.min(90, Number(value) || 0));
    setAngle(v);
    if (canvasRef.current && selectedBody) {
      canvasRef.current.updatePlaneAngle(selectedBody.networkId, v);
    }
  }, [canvasRef, selectedBody]);

  const handleLengthChange = useCallback((value) => {
    const v = Math.max(60, Math.min(600, Number(value) || 200));
    setLength(v);
    if (canvasRef.current && selectedBody) {
      canvasRef.current.updatePlaneLength(selectedBody.networkId, v);
    }
  }, [canvasRef, selectedBody]);

  const handleLock = useCallback(() => {
    if (!canvasRef.current || !selectedBody) return;
    canvasRef.current.lockPlane(selectedBody.networkId);
    setLocked(true);
  }, [canvasRef, selectedBody]);

  const handleUnlock = useCallback(() => {
    if (!canvasRef.current || !selectedBody) return;
    canvasRef.current.unlockPlane(selectedBody.networkId);
    setLocked(false);
  }, [canvasRef, selectedBody]);

  // Only render for plane bodies
  if (!selectedBody || selectedBody.type !== 'plane') {
    return null;
  }

  return (
    <div className="plane-controls-panel">
      <h3 className="plane-controls-title">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.7 }}
        >
          <line x1="2" y1="20" x2="22" y2="20" />
          <line x1="2" y1="20" x2="16" y2="6" />
        </svg>
        Plane Controls
        {locked && (
          <span className="plane-lock-badge">🔒 Locked</span>
        )}
      </h3>

      <div className="plane-controls-body">
        {/* Angle Control */}
        <div className="plane-control-group">
          <label className="plane-control-label">
            Angle
            <span className="plane-control-value">{angle.toFixed(0)}°</span>
          </label>
          <div className="plane-control-row">
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={angle}
              disabled={locked}
              onChange={(e) => handleAngleChange(e.target.value)}
              className="plane-slider"
            />
            <input
              type="number"
              min="0"
              max="90"
              step="1"
              value={angle}
              disabled={locked}
              onChange={(e) => handleAngleChange(e.target.value)}
              className="plane-number-input"
            />
          </div>
          <div className="plane-preset-row">
            {[0, 15, 30, 45, 60, 90].map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={locked}
                onClick={() => handleAngleChange(preset)}
                className={`plane-preset-btn ${angle === preset ? 'plane-preset-btn--active' : ''}`}
              >
                {preset}°
              </button>
            ))}
          </div>
        </div>

        {/* Length Control */}
        <div className="plane-control-group">
          <label className="plane-control-label">
            Length
            <span className="plane-control-value">{length.toFixed(0)} px</span>
          </label>
          <div className="plane-control-row">
            <input
              type="range"
              min="60"
              max="600"
              step="10"
              value={length}
              disabled={locked}
              onChange={(e) => handleLengthChange(e.target.value)}
              className="plane-slider"
            />
            <input
              type="number"
              min="60"
              max="600"
              step="10"
              value={length}
              disabled={locked}
              onChange={(e) => handleLengthChange(e.target.value)}
              className="plane-number-input"
            />
          </div>
        </div>

        {/* Lock / Unlock */}
        <div className="plane-control-group">
          {locked ? (
            <button
              type="button"
              onClick={handleUnlock}
              className="plane-lock-btn plane-lock-btn--unlock"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
              Unlock Plane
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLock}
              className="plane-lock-btn plane-lock-btn--lock"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Lock Plane
            </button>
          )}
          <p className="plane-control-hint">
            {locked
              ? 'Plane is fixed. Unlock to reposition, rotate, or resize.'
              : 'Lock the plane to prevent accidental changes during simulation.'}
          </p>
        </div>
      </div>
    </div>
  );
}
