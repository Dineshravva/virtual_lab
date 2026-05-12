import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  pxToMetres,
  computeObjectToObjectTarget,
  computePlaneDistanceTarget,
  validateBounds,
  wouldOverlap,
  repositionBody,
  getBodyCOM,
  signedPerpendicularDistance,
  getBodyBoundingRadius
} from '../utils/distanceUtils';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

/**
 * Sidebar panel implementing the Relative Distance Positioning Tool.
 *
 * Workflow:
 *   1. User activates the tool
 *   2. Clicks first object (reference — stays fixed)
 *   3. Clicks second object (target — gets repositioned)
 *   4. Enters dx / dy (object-to-object) or perpendicular distance (plane)
 *   5. Clicks "Apply" to reposition
 *
 * The panel communicates with PhysicsCanvas via canvasRef imperative methods.
 */
export default function DistancePositionPanel({
  canvasRef,
  bodies,
  selectedBody,
  onNotify,
  activeTool,
  onActiveToolChange
}) {
  // Selection state
  const [refBodyId, setRefBodyId] = useState(null);
  const [targetBodyId, setTargetBodyId] = useState(null);
  const [selectionStep, setSelectionStep] = useState('idle'); // idle | pickRef | pickTarget | ready

  // Distance inputs
  const [mode, setMode] = useState('object'); // 'object' | 'plane'
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [perpDist, setPerpDist] = useState(1);

  // Feedback
  const [lastResult, setLastResult] = useState(null);
  const prevSelectedRef = useRef(null);

  const isActive = activeTool === 'distance';

  // Auto-detect mode based on reference body type
  const refBody = bodies.find(b => b.networkId === refBodyId) || null;
  const targetBody = bodies.find(b => b.networkId === targetBodyId) || null;
  const isPlaneRef = refBody && refBody.shapeType === 'plane';

  // When the tool is active and user clicks a body, capture it as ref or target
  useEffect(() => {
    if (!isActive || !selectedBody) return;
    const nid = selectedBody.networkId;
    if (!nid || nid === prevSelectedRef.current) return;
    prevSelectedRef.current = nid;

    if (selectionStep === 'pickRef') {
      setRefBodyId(nid);
      setSelectionStep('pickTarget');

      // Auto-detect plane mode
      const body = bodies.find(b => b.networkId === nid);
      if (body && body.shapeType === 'plane') {
        setMode('plane');
      } else {
        setMode('object');
      }

      // Update guide overlay
      if (canvasRef.current && canvasRef.current.setDistanceGuide) {
        canvasRef.current.setDistanceGuide({ refId: nid, targetId: null });
      }
    } else if (selectionStep === 'pickTarget') {
      if (nid === refBodyId) return; // can't pick same body
      setTargetBodyId(nid);
      setSelectionStep('ready');

      // Show current distance as default
      if (canvasRef.current) {
        const ref = canvasRef.current.getBodyById
          ? canvasRef.current.getBodyById(refBodyId)
          : null;
        const tgt = canvasRef.current.getBodyById
          ? canvasRef.current.getBodyById(nid)
          : null;

        if (ref && tgt) {
          if (ref.shapeType === 'plane') {
            const dist = signedPerpendicularDistance(
              getBodyCOM(tgt), ref
            );
            const bodyR = getBodyBoundingRadius(tgt);
            setPerpDist(Math.max(0, pxToMetres(Math.abs(dist) - bodyR - 6)));
          } else {
            setDx(Number(pxToMetres(tgt.position.x - ref.position.x).toFixed(2)));
            setDy(Number(pxToMetres(tgt.position.y - ref.position.y).toFixed(2)));
          }
        }

        if (canvasRef.current.setDistanceGuide) {
          canvasRef.current.setDistanceGuide({ refId: refBodyId, targetId: nid });
        }
      }
    }
  }, [isActive, selectedBody, selectionStep, refBodyId, bodies, canvasRef]);

  // Clear guide when tool deactivates
  useEffect(() => {
    if (!isActive && canvasRef.current && canvasRef.current.setDistanceGuide) {
      canvasRef.current.setDistanceGuide(null);
    }
  }, [isActive, canvasRef]);

  const handleActivate = useCallback(() => {
    if (isActive) {
      // Deactivate
      onActiveToolChange('select');
      resetState();
      return;
    }
    onActiveToolChange('distance');
    setSelectionStep('pickRef');
    setRefBodyId(null);
    setTargetBodyId(null);
    setLastResult(null);
    prevSelectedRef.current = null;
  }, [isActive, onActiveToolChange]);

  const resetState = useCallback(() => {
    setRefBodyId(null);
    setTargetBodyId(null);
    setSelectionStep('idle');
    setLastResult(null);
    prevSelectedRef.current = null;
    if (canvasRef.current && canvasRef.current.setDistanceGuide) {
      canvasRef.current.setDistanceGuide(null);
    }
  }, [canvasRef]);

  const handleRestart = useCallback(() => {
    setSelectionStep('pickRef');
    setRefBodyId(null);
    setTargetBodyId(null);
    setLastResult(null);
    prevSelectedRef.current = null;
    if (canvasRef.current && canvasRef.current.setDistanceGuide) {
      canvasRef.current.setDistanceGuide(null);
    }
  }, [canvasRef]);

  const handleApply = useCallback(() => {
    if (!canvasRef.current) return;
    const ref = canvasRef.current.getBodyById
      ? canvasRef.current.getBodyById(refBodyId)
      : null;
    const tgt = canvasRef.current.getBodyById
      ? canvasRef.current.getBodyById(targetBodyId)
      : null;

    if (!ref || !tgt) {
      setLastResult({ ok: false, msg: 'One or both objects no longer exist.' });
      return;
    }

    if (tgt.shapeType === 'plane' && tgt.planeLocked) {
      setLastResult({ ok: false, msg: 'Target plane is locked. Unlock it first.' });
      return;
    }

    let target;
    if (mode === 'plane' || ref.shapeType === 'plane') {
      target = computePlaneDistanceTarget(ref, tgt, Number(perpDist) || 0);
    } else {
      target = computeObjectToObjectTarget(ref, Number(dx) || 0, Number(dy) || 0);
    }

    if (!target) {
      setLastResult({ ok: false, msg: 'Failed to compute target position.' });
      return;
    }

    // Boundary validation
    const bounds = validateBounds(target, tgt, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Overlap check
    const overlap = wouldOverlap(bounds.position, tgt, ref);

    // Apply position
    repositionBody(tgt, bounds.position);

    // Notify canvas to re-render
    if (canvasRef.current.notifyBodiesChanged) {
      canvasRef.current.notifyBodiesChanged();
    }

    // Update guide
    if (canvasRef.current.setDistanceGuide) {
      canvasRef.current.setDistanceGuide({ refId: refBodyId, targetId: targetBodyId });
    }

    // Feedback
    const warnings = [];
    if (!bounds.valid) warnings.push(bounds.reason);
    if (overlap) warnings.push('Objects may overlap — consider increasing distance.');

    if (warnings.length) {
      setLastResult({ ok: true, msg: `Positioned. ⚠ ${warnings.join(' ')}` });
      if (onNotify) onNotify(warnings.join(' '), 'error');
    } else {
      const modeName = (mode === 'plane' || ref.shapeType === 'plane')
        ? `${Number(perpDist).toFixed(1)} m from plane`
        : `dx=${Number(dx).toFixed(1)} m, dy=${Number(dy).toFixed(1)} m`;
      setLastResult({ ok: true, msg: `Placed at ${modeName}` });
      if (onNotify) onNotify(`Object repositioned: ${modeName}`, 'success');
    }
  }, [canvasRef, refBodyId, targetBodyId, mode, dx, dy, perpDist, onNotify]);

  // Helper labels
  const getStepLabel = () => {
    switch (selectionStep) {
      case 'pickRef': return 'Click the REFERENCE object (stays fixed)';
      case 'pickTarget': return 'Click the TARGET object (will be moved)';
      case 'ready': return 'Set distance values and click Apply';
      default: return 'Activate the tool to begin';
    }
  };

  const refLabel = refBody
    ? `${refBody.shapeType || 'object'}${isPlaneRef ? ' (plane)' : ''}`
    : '—';
  const targetLabel = targetBody
    ? `${targetBody.shapeType || 'object'}`
    : '—';

  return (
    <div className="dist-panel">
      <h3 className="dist-panel-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        Distance Position
      </h3>

      {/* Activate / Deactivate */}
      <button
        type="button"
        onClick={handleActivate}
        className={`dist-activate-btn ${isActive ? 'dist-activate-btn--active' : ''}`}
      >
        {isActive ? '✕ Deactivate Tool' : '⇔ Activate Distance Tool'}
      </button>

      {isActive && (
        <div className="dist-panel-body">
          {/* Step indicator */}
          <div className="dist-step-indicator">
            <div className={`dist-step ${selectionStep === 'pickRef' ? 'dist-step--current' : (refBodyId ? 'dist-step--done' : '')}`}>
              <span className="dist-step-num">1</span>
              <span>Reference</span>
            </div>
            <div className="dist-step-arrow">→</div>
            <div className={`dist-step ${selectionStep === 'pickTarget' ? 'dist-step--current' : (targetBodyId ? 'dist-step--done' : '')}`}>
              <span className="dist-step-num">2</span>
              <span>Target</span>
            </div>
            <div className="dist-step-arrow">→</div>
            <div className={`dist-step ${selectionStep === 'ready' ? 'dist-step--current' : ''}`}>
              <span className="dist-step-num">3</span>
              <span>Apply</span>
            </div>
          </div>

          <p className="dist-instruction">{getStepLabel()}</p>

          {/* Selected objects summary */}
          {refBodyId && (
            <div className="dist-selection-row">
              <span className="dist-sel-label">Ref:</span>
              <span className="dist-sel-value dist-sel-ref">{refLabel}</span>
              {targetBodyId && (
                <>
                  <span className="dist-sel-label">Target:</span>
                  <span className="dist-sel-value dist-sel-tgt">{targetLabel}</span>
                </>
              )}
            </div>
          )}

          {/* Distance inputs — only show when both objects selected */}
          {selectionStep === 'ready' && (
            <div className="dist-inputs">
              {/* Mode toggle (auto-set but overridable) */}
              {!isPlaneRef && (
                <div className="dist-mode-toggle">
                  <button
                    type="button"
                    onClick={() => setMode('object')}
                    className={`dist-mode-btn ${mode === 'object' ? 'dist-mode-btn--active' : ''}`}
                  >
                    COM ↔ COM
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('plane')}
                    className={`dist-mode-btn ${mode === 'plane' ? 'dist-mode-btn--active' : ''}`}
                    disabled={!isPlaneRef}
                    title={isPlaneRef ? '' : 'Select a plane as reference to use this mode'}
                  >
                    ⊥ Plane
                  </button>
                </div>
              )}

              {(mode === 'object' && !isPlaneRef) ? (
                <>
                  <div className="dist-input-group">
                    <label className="dist-input-label">
                      Horizontal (dx)
                      <span className="dist-input-unit">metres</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={dx}
                      onChange={(e) => setDx(e.target.value)}
                      className="dist-input"
                      placeholder="0"
                    />
                    <p className="dist-input-hint">
                      Positive = right, Negative = left
                    </p>
                  </div>
                  <div className="dist-input-group">
                    <label className="dist-input-label">
                      Vertical (dy)
                      <span className="dist-input-unit">metres</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={dy}
                      onChange={(e) => setDy(e.target.value)}
                      className="dist-input"
                      placeholder="0"
                    />
                    <p className="dist-input-hint">
                      Positive = down, Negative = up
                    </p>
                  </div>
                </>
              ) : (
                <div className="dist-input-group">
                  <label className="dist-input-label">
                    Perpendicular Distance
                    <span className="dist-input-unit">metres</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={perpDist}
                    onChange={(e) => setPerpDist(e.target.value)}
                    className="dist-input"
                    placeholder="1"
                  />
                  <p className="dist-input-hint">
                    Shortest distance from plane surface to object COM
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleApply}
                className="dist-apply-btn"
              >
                ✓ Apply Position
              </button>
            </div>
          )}

          {/* Result feedback */}
          {lastResult && (
            <div className={`dist-result ${lastResult.ok ? 'dist-result--ok' : 'dist-result--err'}`}>
              {lastResult.msg}
            </div>
          )}

          {/* Restart */}
          {selectionStep !== 'pickRef' && (
            <button
              type="button"
              onClick={handleRestart}
              className="dist-restart-btn"
            >
              ↺ Start Over
            </button>
          )}
        </div>
      )}
    </div>
  );
}
