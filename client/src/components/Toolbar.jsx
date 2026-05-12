import React from 'react';
import Tooltip from './Tooltip';
import ConnectionStatus from './ConnectionStatus';

// Top toolbar with shape and simulation controls.
export default function Toolbar({
  onAddBox,
  onAddCircle,
  onAddPlane,
  onTogglePolygonTool,
  onFinishPolygon,
  onCancelPolygon,
  onPause,
  onPlay,
  onStep,
  onReset,
  onDeleteSelected,
  onUndo,
  onRedo,
  onToggleGrid,
  onToggleGravity,
  onSetSimulationSpeed,
  isPaused,
  showGrid,
  gravityEnabled,
  simulationSpeed,
  activeTool,
  polygonPointCount,
  canUndo,
  canRedo,
  selectedBody,
  roomName,
  connectionStatus
}) {
  const speedOptions = [1, 0.25, 0.1];
  const isPolygonTool = activeTool === 'polygon';

  return (
    <div className="bg-lab-panel border-b border-gray-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lab-accent font-bold text-lg tracking-wide">VIRTUAL-LAB</h2>
        <span className="text-gray-600 text-sm">|</span>
        <span className="text-gray-400 text-sm">
          Room: <span className="text-white font-medium">{roomName}</span>
        </span>
        <ConnectionStatus status={connectionStatus} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Tooltip text="Box: a rigid body with flat faces, useful for studying friction, torque, stacking, and collisions.">
          <button
            type="button"
            onClick={onAddBox}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md
                       text-sm border border-gray-700 transition"
          >
            + Box
          </button>
        </Tooltip>
        <Tooltip text="Circle: a round rigid body with smooth contact, useful for rolling motion and low-corner collision effects.">
          <button
            type="button"
            onClick={onAddCircle}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md
                       text-sm border border-gray-700 transition"
          >
            + Circle
          </button>
        </Tooltip>
        <Tooltip text="Polygon: a custom rigid body whose uneven shape changes contact points, rotation, and stability.">
          <button
            type="button"
            onClick={onTogglePolygonTool}
            aria-pressed={isPolygonTool}
            className={`px-3 py-1.5 text-white rounded-md text-sm border transition ${
              isPolygonTool
                ? 'bg-lime-700 hover:bg-lime-600 border-lime-500'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-700'
            }`}
          >
            Polygon
          </button>
        </Tooltip>
        {isPolygonTool && (
          <>
            <Tooltip text="Finish polygon: closes the selected points into one rigid body with its own mass and inertia.">
              <button
                type="button"
                onClick={onFinishPolygon}
                disabled={polygonPointCount < 3}
                className="px-3 py-1.5 bg-lime-700 hover:bg-lime-600 disabled:opacity-50
                           disabled:cursor-not-allowed text-white rounded-md text-sm transition"
              >
                Finish
              </button>
            </Tooltip>
            <Tooltip text="Cancel polygon: clears the draft points without adding energy or bodies to the scene.">
              <button
                type="button"
                onClick={onCancelPolygon}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md
                           text-sm border border-gray-700 transition"
              >
                Cancel
              </button>
            </Tooltip>
          </>
        )}
        <Tooltip text="Plane: a static rigid surface that acts as a floor, ramp, or wall. Other objects collide against it realistically.">
          <button
            type="button"
            onClick={onAddPlane}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md
                       text-sm border border-gray-700 transition"
          >
            + Plane
          </button>
        </Tooltip>
        <Tooltip text="Pause: freezes time so positions, velocities, and energy can be inspected without motion continuing.">
          <button
            type="button"
            onClick={onPause}
            disabled={isPaused}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50
                       disabled:cursor-not-allowed text-white rounded-md text-sm transition"
          >
            Pause
          </button>
        </Tooltip>
        <Tooltip text="Play: lets gravity, constraints, collisions, and stored velocities continue evolving the system.">
          <button
            type="button"
            onClick={onPlay}
            disabled={!isPaused}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50
                       disabled:cursor-not-allowed text-white rounded-md text-sm transition"
          >
            Play
          </button>
        </Tooltip>
        <Tooltip text="Step: advances one small time interval, ideal for analysing cause and effect frame by frame.">
          <button
            type="button"
            onClick={onStep}
            disabled={!isPaused}
            className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50
                       disabled:cursor-not-allowed text-white rounded-md text-sm transition"
          >
            Step
          </button>
        </Tooltip>
        <Tooltip text="Undo: returns to the previous scene state, helping compare how one physical change affected the setup.">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white rounded-md text-sm
                       border border-gray-700 transition"
          >
            Undo
          </button>
        </Tooltip>
        <Tooltip text="Redo: reapplies the next scene state after an undo, restoring the experimental change.">
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white rounded-md text-sm
                       border border-gray-700 transition"
          >
            Redo
          </button>
        </Tooltip>
        <Tooltip text="Grid: overlays metre rulers so distance, height, and displacement can be measured visually.">
          <button
            type="button"
            onClick={onToggleGrid}
            aria-pressed={showGrid}
            className={`px-3 py-1.5 text-white rounded-md text-sm border transition ${
              showGrid
                ? 'bg-sky-700 hover:bg-sky-600 border-sky-500'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-700'
            }`}
          >
            Grid
          </button>
        </Tooltip>
        <Tooltip text="No Gravity: removes downward acceleration while keeping collisions, constraints, damping, and existing velocities unchanged.">
          <button
            type="button"
            onClick={onToggleGravity}
            aria-pressed={!gravityEnabled}
            className={`px-3 py-1.5 text-white rounded-md text-sm border transition ${
              !gravityEnabled
                ? 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-700'
            }`}
          >
            No Gravity
          </button>
        </Tooltip>
        <div className="flex rounded-md border border-gray-700" aria-label="Simulation speed">
          {speedOptions.map((speed) => {
            const isActive = simulationSpeed === speed;
            return (
              <Tooltip
                key={speed}
                text={
                  speed === 1
                    ? 'Normal speed: runs the engine at full time scale.'
                    : `${speed}x slow motion: reduces time scale so fast forces and collisions are easier to observe.`
                }
              >
                <button
                  type="button"
                  onClick={() => onSetSimulationSpeed(speed)}
                  aria-pressed={isActive}
                  className={`px-2.5 py-1.5 text-sm transition first:rounded-l-md last:rounded-r-md ${
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                  }`}
                >
                  {speed}x
                </button>
              </Tooltip>
            );
          })}
        </div>
        <Tooltip text="Delete: removes the selected body and its constraints, changing the system's forces and contacts.">
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selectedBody}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white rounded-md text-sm
                       border border-gray-700 transition"
            aria-label="Delete selected body"
          >
            X
          </button>
        </Tooltip>
        <Tooltip text="Reset: clears the whole experiment so you can build a fresh physical system.">
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md
                       text-sm transition"
          >
            Reset
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
