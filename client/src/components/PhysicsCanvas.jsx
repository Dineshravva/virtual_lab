import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react';
import Matter from 'matter-js';
import usePhysicsEngine from '../hooks/usePhysicsEngine';
import {
  createBox,
  createCircle,
  createPolygon,
  serializeBody,
  deserializeBody
} from '../utils/physicsHelpers';
import { smoothMoveBody, smoothRotate } from '../utils/interpolation';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const DEFAULT_GRAVITY_Y = 1;
const MIN_ARROW_SPEED = 0.08;
const MAX_ARROW_LENGTH = 72;
const TRAIL_LENGTH = 30;
const TRAIL_MIN_DISTANCE = 1.5;
const HEAT_REFERENCE_ENERGY = 260;
const GRID_STEP_PIXELS = 50;
const GRID_METRES_PER_STEP = 1;
const COLLISION_FLASH_MS = 360;
const MAX_COLLISION_FLASHES = 24;
const MIN_BODY_MASS = 0.1;
const MAX_BODY_MASS = 100;
const MIN_SURFACE_VALUE = 0;
const MAX_SURFACE_VALUE = 1;
const POLYGON_POINT_RADIUS = 4;
const PIVOT_HANDLE_RADIUS = 9;
const DEFAULT_PIVOT_OFFSET = 120;
const CONSTRAINT_TOLERANCE = 0.001;
const MAX_HISTORY_ENTRIES = 50;

const newNetworkId = () =>
  `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const newConstraintId = () =>
  `constraint-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeConstraintType(type) {
  return type === 'rope' ? 'rod' : type;
}

function distanceBetween(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bodyDistance(a, b) {
  if (!a || !b) return 0;
  return distanceBetween(a.position, b.position);
}

function bodyInverseMass(body) {
  if (!body || body.isStatic) return 0;
  if (typeof body.inverseMass === 'number' && body.inverseMass > 0) {
    return body.inverseMass;
  }
  return body.mass > 0 ? 1 / body.mass : 0;
}

function distributeByInverseMass(a, b) {
  const inverseA = bodyInverseMass(a);
  const inverseB = bodyInverseMass(b);
  const total = inverseA + inverseB;

  if (total <= 0) {
    return { shareA: 0, shareB: 0 };
  }

  return {
    shareA: inverseA / total,
    shareB: inverseB / total
  };
}

function getBodySummary(body) {
  if (!body) return null;
  return {
    networkId: body.networkId,
    type: body.shapeType || (body.circleRadius ? 'circle' : 'box'),
    mass: Number(body.mass.toFixed(2)),
    friction: Number(body.friction.toFixed(2)),
    restitution: Number(body.restitution.toFixed(2)),
    color: body.baseFillStyle || body.render.fillStyle || '#38bdf8'
  };
}

function applyBodyPropertyPatch(body, patch) {
  if (!body || !patch) return null;
  const applied = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'mass')) {
    const mass = clampNumber(patch.mass, MIN_BODY_MASS, MAX_BODY_MASS);
    Matter.Body.setMass(body, mass);
    applied.mass = mass;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'friction')) {
    const friction = clampNumber(
      patch.friction,
      MIN_SURFACE_VALUE,
      MAX_SURFACE_VALUE
    );
    body.friction = friction;
    applied.friction = friction;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'restitution')) {
    const restitution = clampNumber(
      patch.restitution,
      MIN_SURFACE_VALUE,
      MAX_SURFACE_VALUE
    );
    body.restitution = restitution;
    applied.restitution = restitution;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'color') && patch.color) {
    body.baseFillStyle = patch.color;
    body.render.fillStyle = patch.color;
    applied.color = patch.color;
  }

  return applied;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return { r: 56, g: 189, b: 248 };
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixRgb(a, b, amount) {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount
  };
}

function getKineticHeatColor(body) {
  const speed = Math.hypot(body.velocity.x, body.velocity.y);
  const kineticEnergy = 0.5 * body.mass * speed * speed;
  const heat = Math.min(
    1,
    Math.log1p(kineticEnergy) / Math.log1p(HEAT_REFERENCE_ENERGY)
  );
  const base = hexToRgb(body.baseFillStyle || body.render.fillStyle || '#38bdf8');
  const warm = heat < 0.55
    ? mixRgb(base, { r: 250, g: 204, b: 21 }, heat / 0.55)
    : mixRgb(
        { r: 250, g: 204, b: 21 },
        { r: 239, g: 68, b: 68 },
        (heat - 0.55) / 0.45
      );

  return rgbToHex(mixRgb(base, warm, Math.min(1, heat * 0.95)));
}

function drawVelocityArrow(ctx, body) {
  if (body.isStatic) return;

  const vx = body.velocity.x;
  const vy = body.velocity.y;
  const speed = Math.hypot(vx, vy);
  if (speed < MIN_ARROW_SPEED) return;

  const startX = body.position.x;
  const startY = body.position.y;
  const length = Math.min(MAX_ARROW_LENGTH, 12 + speed * 9);
  const unitX = vx / speed;
  const unitY = vy / speed;
  const endX = startX + unitX * length;
  const endY = startY + unitY * length;
  const headLength = 9;
  const angle = Math.atan2(unitY, unitX);

  ctx.save();
  ctx.strokeStyle = '#f8fafc';
  ctx.fillStyle = '#f8fafc';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(15, 23, 42, 0.9)';
  ctx.shadowBlur = 5;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLength * Math.cos(angle - Math.PI / 6),
    endY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    endX - headLength * Math.cos(angle + Math.PI / 6),
    endY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTrajectoryTrail(ctx, trail, color) {
  if (!trail || trail.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < trail.length; i += 1) {
    const alpha = i / trail.length;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.08 + alpha * 0.34;
    ctx.lineWidth = 1 + alpha * 3;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawGridOverlay(ctx, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.lineWidth = 1;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  for (let x = 0; x <= width; x += GRID_STEP_PIXELS) {
    ctx.strokeStyle = x === 0
      ? 'rgba(203, 213, 225, 0.42)'
      : 'rgba(148, 163, 184, 0.16)';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += GRID_STEP_PIXELS) {
    ctx.strokeStyle = y === height
      ? 'rgba(203, 213, 225, 0.42)'
      : 'rgba(148, 163, 184, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.textAlign = 'center';
  for (let x = GRID_STEP_PIXELS; x < width; x += GRID_STEP_PIXELS) {
    const metres = (x / GRID_STEP_PIXELS) * GRID_METRES_PER_STEP;
    ctx.fillText(`${metres} m`, x, height - 12);
  }

  ctx.textAlign = 'left';
  for (let y = height - GRID_STEP_PIXELS; y > 0; y -= GRID_STEP_PIXELS) {
    const metres = ((height - y) / GRID_STEP_PIXELS) * GRID_METRES_PER_STEP;
    ctx.fillText(`${metres} m`, 8, y);
  }

  ctx.fillText('0 m', 8, height - 12);
  ctx.restore();
}

function getCollisionPoint(pair) {
  const supports = pair.collision && pair.collision.supports;
  if (supports && supports.length) {
    const total = supports.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 }
    );
    return {
      x: total.x / supports.length,
      y: total.y / supports.length
    };
  }

  return {
    x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
    y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
  };
}

function drawCollisionFlashes(ctx, flashes) {
  const now = Date.now();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  flashes.forEach((flash) => {
    const progress = Math.min(1, (now - flash.createdAt) / COLLISION_FLASH_MS);
    const alpha = 1 - progress;
    const radius = 7 + progress * 22;
    const rayLength = 12 + progress * 18;

    ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
    ctx.fillStyle = `rgba(251, 146, 60, ${alpha * 0.7})`;
    ctx.lineWidth = 2 + alpha * 2;

    ctx.beginPath();
    ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(flash.x, flash.y, 3 + progress * 4, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 6; i += 1) {
      const angle = flash.angle + (Math.PI * 2 * i) / 6;
      const inner = radius * 0.45;
      ctx.beginPath();
      ctx.moveTo(
        flash.x + Math.cos(angle) * inner,
        flash.y + Math.sin(angle) * inner
      );
      ctx.lineTo(
        flash.x + Math.cos(angle) * rayLength,
        flash.y + Math.sin(angle) * rayLength
      );
      ctx.stroke();
    }
  });

  ctx.restore();
}

function drawPolygonDraft(ctx, points) {
  if (!points.length) return;

  ctx.save();
  ctx.strokeStyle = '#a3e635';
  ctx.fillStyle = '#a3e635';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
  if (points.length >= 3) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, POLYGON_POINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawStringConstraint(ctx, entry, bodyMap) {
  const { data } = entry;
  if (!data || data.type !== 'string') return;

  const a = bodyMap[data.bodyA];
  const b = bodyMap[data.bodyB];
  if (!a || !b) return;

  const length = typeof data.length === 'number'
    ? data.length
    : bodyDistance(a, b);
  const currentLength = bodyDistance(a, b);
  const slack = Math.max(0, length - currentLength);
  const isLoose = slack > 2;
  const start = a.position;
  const end = b.position;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const sag = Math.min(70, 12 + slack * 0.35);

  ctx.save();
  ctx.strokeStyle = isLoose ? 'rgba(125, 211, 252, 0.72)' : '#7dd3fc';
  ctx.lineWidth = isLoose ? 1.75 : 2.5;
  ctx.lineCap = 'round';
  if (isLoose) ctx.setLineDash([8, 7]);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  if (isLoose) {
    ctx.quadraticCurveTo(midX, midY + sag, end.x, end.y);
  } else {
    ctx.lineTo(end.x, end.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPivotHandles(ctx, entries, bodyMap, activePivotId) {
  const pivots = entries.filter(({ data }) => data && data.type === 'pivot');
  if (!pivots.length) return;

  ctx.save();
  pivots.forEach(({ data }) => {
    const body = bodyMap[data.bodyA];
    if (!body || !data.pointA) return;

    const isActive = data.id === activePivotId;
    ctx.strokeStyle = isActive ? '#fef08a' : '#facc15';
    ctx.fillStyle = isActive ? 'rgba(250, 204, 21, 0.38)' : 'rgba(250, 204, 21, 0.22)';
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.shadowColor = 'rgba(15, 23, 42, 0.85)';
    ctx.shadowBlur = 5;

    ctx.beginPath();
    ctx.arc(data.pointA.x, data.pointA.y, PIVOT_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(data.pointA.x, data.pointA.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawPivotSelectionPrompt(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 1;
  ctx.fillRect(18, 18, 260, 42);
  ctx.strokeRect(18, 18, 260, 42);

  ctx.fillStyle = '#fde68a';
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Select a body for the pivot', 34, 39);
  ctx.restore();
}

// Draw a live preview of the force / velocity vector the user has dialled
// in but not yet applied. Length scales with magnitude, capped so the arrow
// stays visible on screen. Colour distinguishes mode at a glance.
function drawForcePreview(ctx, body, preview) {
  if (!body || !preview) return;
  const magnitude = Number(preview.magnitude) || 0;
  if (magnitude <= 0) return;

  const angleRad = (preview.angle * Math.PI) / 180;
  const startX = body.position.x;
  const startY = body.position.y;

  // Scale: force is in Newtons (small), velocity is in m/s. We pick visual
  // lengths that read well for typical inputs.
  const scale = preview.mode === 'force' ? 1.4 : 4;
  const length = Math.min(160, 14 + magnitude * scale);

  const endX = startX + Math.cos(angleRad) * length;
  const endY = startY - Math.sin(angleRad) * length; // canvas y is inverted

  const color = preview.mode === 'force' ? '#fb923c' : '#38bdf8';
  const headLength = 12;
  const drawAngle = Math.atan2(endY - startY, endX - startX);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(15, 23, 42, 0.9)';
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLength * Math.cos(drawAngle - Math.PI / 6),
    endY - headLength * Math.sin(drawAngle - Math.PI / 6)
  );
  ctx.lineTo(
    endX - headLength * Math.cos(drawAngle + Math.PI / 6),
    endY - headLength * Math.sin(drawAngle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.font = '11px Inter, system-ui, sans-serif';
  const labelX = endX + Math.cos(drawAngle) * 14;
  const labelY = endY + Math.sin(drawAngle) * 14;
  ctx.fillText(
    `${preview.mode === 'force' ? 'F' : 'v'} ${magnitude.toFixed(1)}`,
    labelX,
    labelY
  );

  ctx.restore();
}

function getTouchCanvasPosition(touch, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
    y: (touch.clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
  };
}

// The physics canvas owns the Matter.js world, the network bodies map,
// and all socket events related to bodies/constraints. The parent uses
// the imperative ref to add/remove things in response to UI buttons.
const PhysicsCanvas = forwardRef(
  (
    {
      socket,
      onBodiesUpdate,
      onSelectionChange,
      onConstraintsUpdate,
      onHistoryChange,
      showGrid,
      gravityEnabled,
      onGravityChange,
      simulationSpeed,
      activeTool,
      onActiveToolChange,
      onPolygonDraftChange,
      forcePreview
    },
    ref
  ) => {
  const { wrapperRef, engineRef, renderRef, runnerRef, mouseConstraintRef } =
    usePhysicsEngine(CANVAS_WIDTH, CANVAS_HEIGHT);

  // Internal mirror of the socket prop so non-effect code (imperative
  // handlers, the broadcast tick) can read the latest socket via .current
  // without listing it as a dependency.
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  const onBodiesUpdateRef = useRef(onBodiesUpdate);
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onBodiesUpdateRef.current = onBodiesUpdate;
  }, [onBodiesUpdate]);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);
  const onConstraintsUpdateRef = useRef(onConstraintsUpdate);
  useEffect(() => {
    onConstraintsUpdateRef.current = onConstraintsUpdate;
  }, [onConstraintsUpdate]);
  const onHistoryChangeRef = useRef(onHistoryChange);
  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);
  const onGravityChangeRef = useRef(onGravityChange);
  useEffect(() => {
    onGravityChangeRef.current = onGravityChange;
  }, [onGravityChange]);
  const showGridRef = useRef(showGrid);
  useEffect(() => {
    showGridRef.current = showGrid;
  }, [showGrid]);
  const gravityEnabledRef = useRef(gravityEnabled !== false);
  const applyGravityEnabled = useCallback((enabled) => {
    const normalized = enabled !== false;
    gravityEnabledRef.current = normalized;
    const engine = engineRef.current;
    if (!engine) return;

    engine.gravity.x = 0;
    engine.gravity.y = normalized ? DEFAULT_GRAVITY_Y : 0;
  }, [engineRef]);
  useEffect(() => {
    applyGravityEnabled(gravityEnabled);
  }, [applyGravityEnabled, gravityEnabled]);
  const syncGravityFromRemote = useCallback((enabled) => {
    if (typeof enabled !== 'boolean') return;
    applyGravityEnabled(enabled);
    if (onGravityChangeRef.current) {
      onGravityChangeRef.current(enabled);
    }
  }, [applyGravityEnabled]);
  const forcePreviewRef = useRef(forcePreview);
  useEffect(() => {
    forcePreviewRef.current = forcePreview;
  }, [forcePreview]);
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.timing.timeScale = simulationSpeed || 1;
  }, [engineRef, simulationSpeed]);
  const activeToolRef = useRef(activeTool);
  const onActiveToolChangeRef = useRef(onActiveToolChange);
  const onPolygonDraftChangeRef = useRef(onPolygonDraftChange);
  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== 'polygon') {
      polygonDraftRef.current = [];
      if (onPolygonDraftChangeRef.current) {
        onPolygonDraftChangeRef.current(0);
      }
    }
    if (activeTool !== 'pivot') {
      pivotSelectionModeRef.current = false;
    }
  }, [activeTool]);
  useEffect(() => {
    onActiveToolChangeRef.current = onActiveToolChange;
  }, [onActiveToolChange]);
  useEffect(() => {
    onPolygonDraftChangeRef.current = onPolygonDraftChange;
  }, [onPolygonDraftChange]);

  // Bodies indexed by their networkId so we can look them up when
  // remote updates arrive
  const bodyMapRef = useRef({});
  // Last few positions for each body, used to draw fading motion history.
  const trailMapRef = useRef({});
  // Short-lived collision highlights waiting to be rendered.
  const collisionFlashRef = useRef([]);
  // Points collected while the custom polygon tool is active.
  const polygonDraftRef = useRef([]);
  // Pivot mode waits for a body click, then leaves a draggable anchor handle.
  const pivotSelectionModeRef = useRef(false);
  const draggedPivotAnchorRef = useRef(null);
  // Remember the order bodies were added (for picking last 2 for constraints)
  const addOrderRef = useRef([]);
  // Constraints we've created (so we can remove them on clear)
  const constraintListRef = useRef([]);
  // Scene snapshots for local undo / redo.
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  // The body the local user is currently dragging, if any
  const draggedBodyRef = useRef(null);
  // Currently selected body, used by Delete key and the toolbar X button.
  const selectedBodyIdRef = useRef(null);
  // Cached socket id once connection is established
  const myIdRef = useRef(null);
  // Whether the Matter runner is currently stopped by the toolbar.
  const isPausedRef = useRef(false);

  const notifyConstraintsChanged = useCallback(() => {
    if (onConstraintsUpdateRef.current) {
      onConstraintsUpdateRef.current(
        constraintListRef.current.map(({ data }) => data)
      );
    }
  }, []);

  const notifyHistoryChanged = useCallback(() => {
    if (onHistoryChangeRef.current) {
      onHistoryChangeRef.current({
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0
      });
    }
  }, []);

  const getSceneSnapshot = useCallback(() => {
    const bodies = Object.values(bodyMapRef.current).map((body) => ({
      ...serializeBody(body),
      networkId: body.networkId,
      ownerId: body.ownerId
    }));
    const constraints = constraintListRef.current.map(({ data }) => data);
    return {
      bodies,
      constraints,
      gravityEnabled: gravityEnabledRef.current
    };
  }, []);

  const hasSceneContent = useCallback(() => (
    Object.keys(bodyMapRef.current).length > 0 ||
    constraintListRef.current.length > 0
  ), []);

  const recordHistory = useCallback(() => {
    undoStackRef.current.push(getSceneSnapshot());
    if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    notifyHistoryChanged();
  }, [getSceneSnapshot, notifyHistoryChanged]);

  // ---- Body management ----------------------------------------------------

  const setSelectedBody = useCallback((networkId) => {
    const previousId = selectedBodyIdRef.current;
    if (previousId && bodyMapRef.current[previousId]) {
      bodyMapRef.current[previousId].render.lineWidth = 0;
    }

    selectedBodyIdRef.current = networkId || null;

    if (networkId && bodyMapRef.current[networkId]) {
      const body = bodyMapRef.current[networkId];
      body.render.strokeStyle = '#facc15';
      body.render.lineWidth = 4;
      if (onSelectionChangeRef.current) {
        onSelectionChangeRef.current(getBodySummary(body));
      }
      return;
    }

    if (onSelectionChangeRef.current) onSelectionChangeRef.current(null);
  }, []);

  const registerBody = useCallback((body, type, networkId, ownerId) => {
    body.shapeType = type;
    body.networkId = networkId;
    body.ownerId = ownerId;
    body.baseFillStyle = body.render.fillStyle;
    Matter.World.add(engineRef.current.world, body);
    bodyMapRef.current[networkId] = body;
    trailMapRef.current[networkId] = [
      { x: body.position.x, y: body.position.y }
    ];
    addOrderRef.current.push(networkId);
  }, [engineRef]);

  const addLocalBody = useCallback((body, type) => {
    if (!body) return;
    recordHistory();
    const socket = socketRef.current;
    const networkId = newNetworkId();
    const ownerId = (socket && socket.id) || 'local';
    registerBody(body, type, networkId, ownerId);

    // Tell every other user about this new body so they can recreate it
    if (socket) {
      socket.emit('add-body', {
        ...serializeBody(body),
        networkId,
        ownerId
      });
    }
  }, [recordHistory, registerBody]);

  const addRemoteBody = useCallback((data) => {
    if (!data || !data.networkId) return;
    if (bodyMapRef.current[data.networkId]) return; // already known

    const body = deserializeBody(data);
    registerBody(body, data.type, data.networkId, data.ownerId || 'remote');
  }, [registerBody]);

  const clearAllBodies = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    Object.values(bodyMapRef.current).forEach((b) =>
      Matter.World.remove(engine.world, b)
    );
    constraintListRef.current.forEach(({ constraint }) =>
      Matter.World.remove(engine.world, constraint)
    );
    bodyMapRef.current = {};
    trailMapRef.current = {};
    collisionFlashRef.current = [];
    addOrderRef.current = [];
    constraintListRef.current = [];
    draggedBodyRef.current = null;
    setSelectedBody(null);
    notifyConstraintsChanged();
    if (onBodiesUpdateRef.current) onBodiesUpdateRef.current([]);
  }, [engineRef, notifyConstraintsChanged, setSelectedBody]);

  const removeConstraintsForBody = useCallback((networkId) => {
    const engine = engineRef.current;
    if (!engine) return;

    const kept = [];
    constraintListRef.current.forEach((entry) => {
      const { constraint, data } = entry;
      const isAttached =
        data.bodyA === networkId || data.bodyB === networkId;

      if (isAttached) {
        Matter.World.remove(engine.world, constraint);
      } else {
        kept.push(entry);
      }
    });
    constraintListRef.current = kept;
  }, [engineRef]);

  const removeBodyById = useCallback((networkId, shouldBroadcast = false) => {
    const engine = engineRef.current;
    const body = bodyMapRef.current[networkId];
    if (!engine || !body) return;

    if (shouldBroadcast) recordHistory();
    removeConstraintsForBody(networkId);
    Matter.World.remove(engine.world, body);
    delete bodyMapRef.current[networkId];
    delete trailMapRef.current[networkId];
    addOrderRef.current = addOrderRef.current.filter((id) => id !== networkId);

    if (
      draggedBodyRef.current &&
      draggedBodyRef.current.networkId === networkId
    ) {
      draggedBodyRef.current = null;
    }
    if (selectedBodyIdRef.current === networkId) {
      setSelectedBody(null);
    }
    if (onBodiesUpdateRef.current) {
      onBodiesUpdateRef.current(Object.values(bodyMapRef.current));
    }
    notifyConstraintsChanged();

    if (shouldBroadcast && socketRef.current) {
      socketRef.current.emit('remove-body', { networkId });
    }
  }, [
    engineRef,
    notifyConstraintsChanged,
    recordHistory,
    removeConstraintsForBody,
    setSelectedBody
  ]);

  const deleteSelectedBody = useCallback(() => {
    const selectedId = selectedBodyIdRef.current;
    if (!selectedId) return;
    removeBodyById(selectedId, true);
  }, [removeBodyById]);

  const updateBodyProperties = useCallback((networkId, patch, shouldBroadcast = true) => {
    const body = bodyMapRef.current[networkId];
    if (!body) return;

    if (shouldBroadcast) recordHistory();
    const applied = applyBodyPropertyPatch(body, patch);
    if (!applied) return;

    if (selectedBodyIdRef.current === networkId && onSelectionChangeRef.current) {
      onSelectionChangeRef.current(getBodySummary(body));
    }
    if (onBodiesUpdateRef.current) {
      onBodiesUpdateRef.current(Object.values(bodyMapRef.current));
    }
    if (shouldBroadcast && socketRef.current) {
      socketRef.current.emit('body-properties-update', {
        networkId,
        ...applied
      });
    }
  }, [recordHistory]);

  const updatePolygonDraftCount = useCallback(() => {
    if (onPolygonDraftChangeRef.current) {
      onPolygonDraftChangeRef.current(polygonDraftRef.current.length);
    }
  }, []);

  const addPolygonPoint = useCallback((point) => {
    polygonDraftRef.current = [...polygonDraftRef.current, point];
    updatePolygonDraftCount();
  }, [updatePolygonDraftCount]);

  const finishPolygon = useCallback(() => {
    if (polygonDraftRef.current.length < 3) return;
    const body = createPolygon(polygonDraftRef.current);
    addLocalBody(body, 'polygon');
    polygonDraftRef.current = [];
    updatePolygonDraftCount();
  }, [addLocalBody, updatePolygonDraftCount]);

  const cancelPolygon = useCallback(() => {
    polygonDraftRef.current = [];
    updatePolygonDraftCount();
  }, [updatePolygonDraftCount]);

  const pauseSimulation = () => {
    const runner = runnerRef.current;
    if (!runner || isPausedRef.current) return;
    Matter.Runner.stop(runner);
    isPausedRef.current = true;
  };

  const playSimulation = () => {
    const engine = engineRef.current;
    const runner = runnerRef.current;
    if (!engine || !runner || !isPausedRef.current) return;
    Matter.Runner.run(runner, engine);
    isPausedRef.current = false;
  };

  const stepSimulation = () => {
    const engine = engineRef.current;
    if (!engine || !isPausedRef.current) return;

    Matter.Engine.update(engine, 1000 / 60);
    if (onBodiesUpdateRef.current) {
      onBodiesUpdateRef.current(Object.values(bodyMapRef.current));
    }
  };

  // ---- Physics visibility overlays ---------------------------------------

  useEffect(() => {
    const engine = engineRef.current;
    const render = renderRef.current;
    if (!engine || !render) return undefined;

    const captureTrails = () => {
      const now = Date.now();
      collisionFlashRef.current = collisionFlashRef.current.filter(
        (flash) => now - flash.createdAt < COLLISION_FLASH_MS
      );

      Object.values(bodyMapRef.current).forEach((body) => {
        if (body.isStatic || !body.networkId) return;

        body.render.fillStyle = getKineticHeatColor(body);

        const trail = trailMapRef.current[body.networkId] || [];
        const last = trail[trail.length - 1];
        const moved = !last ||
          Math.hypot(body.position.x - last.x, body.position.y - last.y) >=
            TRAIL_MIN_DISTANCE;

        if (!moved) return;

        trail.push({ x: body.position.x, y: body.position.y });
        if (trail.length > TRAIL_LENGTH) {
          trail.splice(0, trail.length - TRAIL_LENGTH);
        }
        trailMapRef.current[body.networkId] = trail;
      });
    };

    const captureCollisionFlashes = (event) => {
      const createdAt = Date.now();
      event.pairs.forEach((pair) => {
        if (pair.bodyA.isStatic && pair.bodyB.isStatic) return;

        const point = getCollisionPoint(pair);
        collisionFlashRef.current.push({
          ...point,
          createdAt,
          angle: Math.atan2(
            pair.bodyB.position.y - pair.bodyA.position.y,
            pair.bodyB.position.x - pair.bodyA.position.x
          )
        });
      });

      if (collisionFlashRef.current.length > MAX_COLLISION_FLASHES) {
        collisionFlashRef.current.splice(
          0,
          collisionFlashRef.current.length - MAX_COLLISION_FLASHES
        );
      }
    };

    const drawMotionOverlays = () => {
      const ctx = render.context;

      if (showGridRef.current) {
        drawGridOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      Object.values(bodyMapRef.current).forEach((body) => {
        drawTrajectoryTrail(
          ctx,
          trailMapRef.current[body.networkId],
          body.render.fillStyle || '#f8fafc'
        );
      });
      Object.values(bodyMapRef.current).forEach((body) => {
        drawVelocityArrow(ctx, body);
      });
      constraintListRef.current.forEach((entry) => {
        drawStringConstraint(ctx, entry, bodyMapRef.current);
      });
      drawPivotHandles(
        ctx,
        constraintListRef.current,
        bodyMapRef.current,
        draggedPivotAnchorRef.current && draggedPivotAnchorRef.current.constraintId
      );
      if (pivotSelectionModeRef.current) {
        drawPivotSelectionPrompt(ctx);
      }
      drawPolygonDraft(ctx, polygonDraftRef.current);
      drawCollisionFlashes(ctx, collisionFlashRef.current);

      const preview = forcePreviewRef.current;
      if (preview && preview.networkId) {
        const target = bodyMapRef.current[preview.networkId];
        if (target) drawForcePreview(ctx, target, preview);
      }
    };

    const enforcePivotConstraints = () => {
      // Matter's pivot constraint is iterative and can be temporarily
      // overcome by the mouse constraint or strong forces. Per the
      // physics spec, a hinged body must NEVER translate radially —
      // only rotate about its pivot. We enforce this every step.
      const HINGE_TOLERANCE = 0.001; // any length below this is treated as a fixed hinge

      constraintListRef.current.forEach(({ data }) => {
        if (!data || data.type !== 'pivot') return;
        const body = bodyMapRef.current[data.bodyA];
        if (!body) return;

        const pivot = data.pointA || { x: body.position.x, y: body.position.y };
        const length = typeof data.length === 'number' ? data.length : 0;

        if (length <= HINGE_TOLERANCE) {
          // Pure hinge: body's center is pinned to the pivot point.
          // Linear velocity must be zero; angular velocity stays free,
          // so the body can spin in place from torque (e.g. mouse drag).
          if (
            body.position.x !== pivot.x ||
            body.position.y !== pivot.y
          ) {
            Matter.Body.setPosition(body, { x: pivot.x, y: pivot.y });
          }
          if (body.velocity.x !== 0 || body.velocity.y !== 0) {
            Matter.Body.setVelocity(body, { x: 0, y: 0 });
          }
          return;
        }

        // Pendulum: enforce constant distance + remove radial velocity.
        const dx = body.position.x - pivot.x;
        const dy = body.position.y - pivot.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;

        if (Math.abs(dist - length) > HINGE_TOLERANCE) {
          const scale = length / dist;
          Matter.Body.setPosition(body, {
            x: pivot.x + dx * scale,
            y: pivot.y + dy * scale
          });
        }

        // Project velocity onto tangential direction only — kills the
        // radial component that would otherwise stretch/compress the rod.
        const ux = dx / dist;
        const uy = dy / dist;
        const radialV = body.velocity.x * ux + body.velocity.y * uy;
        if (radialV !== 0) {
          Matter.Body.setVelocity(body, {
            x: body.velocity.x - radialV * ux,
            y: body.velocity.y - radialV * uy
          });
        }
      });
    };

    void enforcePivotConstraints;

    const enforceBodyPairConstraint = (a, b, length, allowSlack) => {
      if (!a || !b || !Number.isFinite(length)) return;

      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const dist = Math.hypot(dx, dy);
      if (allowSlack && dist <= length) return;
      if (dist <= CONSTRAINT_TOLERANCE) return;

      const ux = dx / dist;
      const uy = dy / dist;
      const delta = dist - length;
      const { shareA, shareB } = distributeByInverseMass(a, b);

      if (Math.abs(delta) > CONSTRAINT_TOLERANCE && shareA + shareB > 0) {
        if (!a.isStatic) {
          Matter.Body.setPosition(a, {
            x: a.position.x + ux * delta * shareA,
            y: a.position.y + uy * delta * shareA
          });
        }
        if (!b.isStatic) {
          Matter.Body.setPosition(b, {
            x: b.position.x - ux * delta * shareB,
            y: b.position.y - uy * delta * shareB
          });
        }
      }

      const relativeVelocity =
        (b.velocity.x - a.velocity.x) * ux +
        (b.velocity.y - a.velocity.y) * uy;
      if (allowSlack && relativeVelocity <= 0) return;
      if (Math.abs(relativeVelocity) <= CONSTRAINT_TOLERANCE) return;

      if (!a.isStatic) {
        Matter.Body.setVelocity(a, {
          x: a.velocity.x + ux * relativeVelocity * shareA,
          y: a.velocity.y + uy * relativeVelocity * shareA
        });
      }
      if (!b.isStatic) {
        Matter.Body.setVelocity(b, {
          x: b.velocity.x - ux * relativeVelocity * shareB,
          y: b.velocity.y - uy * relativeVelocity * shareB
        });
      }
    };

    const enforcePointConstraint = (body, point, length) => {
      if (!body || body.isStatic || !point || !Number.isFinite(length)) return;

      if (length <= CONSTRAINT_TOLERANCE) {
        if (body.position.x !== point.x || body.position.y !== point.y) {
          Matter.Body.setPosition(body, point);
        }
        if (body.velocity.x !== 0 || body.velocity.y !== 0) {
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
        }
        return;
      }

      const dx = body.position.x - point.x;
      const dy = body.position.y - point.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= CONSTRAINT_TOLERANCE) return;

      const ux = dx / dist;
      const uy = dy / dist;
      if (Math.abs(dist - length) > CONSTRAINT_TOLERANCE) {
        Matter.Body.setPosition(body, {
          x: point.x + ux * length,
          y: point.y + uy * length
        });
      }

      const radialVelocity = body.velocity.x * ux + body.velocity.y * uy;
      if (Math.abs(radialVelocity) > CONSTRAINT_TOLERANCE) {
        Matter.Body.setVelocity(body, {
          x: body.velocity.x - radialVelocity * ux,
          y: body.velocity.y - radialVelocity * uy
        });
      }
    };

    const enforceCustomConstraints = () => {
      constraintListRef.current.forEach(({ data }) => {
        if (!data) return;

        if (data.type === 'pivot') {
          const body = bodyMapRef.current[data.bodyA];
          const point = data.pointA || (body && body.position);
          const length = typeof data.length === 'number' ? data.length : 0;
          enforcePointConstraint(body, point, length);
          return;
        }

        if (data.type === 'rod' || data.type === 'string') {
          const a = bodyMapRef.current[data.bodyA];
          const b = bodyMapRef.current[data.bodyB];
          const length = typeof data.length === 'number'
            ? data.length
            : bodyDistance(a, b);
          enforceBodyPairConstraint(a, b, length, data.type === 'string');
        }
      });
    };

    Matter.Events.on(engine, 'afterUpdate', captureTrails);
    Matter.Events.on(engine, 'afterUpdate', enforceCustomConstraints);
    Matter.Events.on(engine, 'collisionStart', captureCollisionFlashes);
    Matter.Events.on(render, 'afterRender', drawMotionOverlays);
    return () => {
      Matter.Events.off(engine, 'afterUpdate', captureTrails);
      Matter.Events.off(engine, 'afterUpdate', enforceCustomConstraints);
      Matter.Events.off(engine, 'collisionStart', captureCollisionFlashes);
      Matter.Events.off(render, 'afterRender', drawMotionOverlays);
    };
  }, [engineRef, renderRef]);

  // ---- Constraint creation ------------------------------------------------

  const normalizeConstraintData = useCallback((data) => {
    if (!data) return null;

    const type = normalizeConstraintType(data.type);
    const normalized = {
      ...data,
      type,
      id: data.id || newConstraintId()
    };

    if (type === 'pivot') {
      const body = bodyMapRef.current[normalized.bodyA];
      if (!body) return normalized;

      const pointA = normalized.pointA || {
        x: body.position.x,
        y: Math.max(PIVOT_HANDLE_RADIUS, body.position.y - DEFAULT_PIVOT_OFFSET)
      };
      normalized.pointA = { x: pointA.x, y: pointA.y };
      normalized.pointB = normalized.pointB || { x: 0, y: 0 };
      if (typeof normalized.length !== 'number') {
        normalized.length = distanceBetween(normalized.pointA, body.position);
      }
      return normalized;
    }

    if (type === 'rod' || type === 'string') {
      const a = bodyMapRef.current[normalized.bodyA];
      const b = bodyMapRef.current[normalized.bodyB];
      if (typeof normalized.length !== 'number' && a && b) {
        normalized.length = bodyDistance(a, b);
      }
    }

    return normalized;
  }, []);

  const syncMatterConstraint = useCallback((entry) => {
    if (!entry || !entry.constraint || !entry.data) return;

    const { constraint, data } = entry;
    if (data.type === 'pivot') {
      if (data.pointA) constraint.pointA = { ...data.pointA };
      if (typeof data.length === 'number') constraint.length = data.length;
      return;
    }

    if (
      (data.type === 'rod' || data.type === 'string' || data.type === 'spring') &&
      typeof data.length === 'number'
    ) {
      constraint.length = data.length;
    }
  }, []);

  const buildConstraint = useCallback((data) => {
    const engine = engineRef.current;
    if (!engine) return null;
    const normalizedData = normalizeConstraintData(data);
    if (!normalizedData) return null;

    if (normalizedData.type === 'pivot') {
      const body = bodyMapRef.current[normalizedData.bodyA];
      if (!body) return null;
      return Matter.Constraint.create({
        pointA: normalizedData.pointA,
        bodyB: body,
        pointB: normalizedData.pointB || { x: 0, y: 0 },
        stiffness: 1,
        length: typeof normalizedData.length === 'number' ? normalizedData.length : 0,
        render: { strokeStyle: '#facc15', lineWidth: 2 }
      });
    }

    const a = bodyMapRef.current[normalizedData.bodyA];
    const b = bodyMapRef.current[normalizedData.bodyB];
    if (!a || !b) return null;

    if (normalizedData.type === 'rod') {
      return Matter.Constraint.create({
        bodyA: a,
        bodyB: b,
        stiffness: 1,
        length: typeof normalizedData.length === 'number'
          ? normalizedData.length
          : bodyDistance(a, b),
        damping: 0,
        render: { strokeStyle: '#a78bfa', lineWidth: 2 }
      });
    }
    if (normalizedData.type === 'string') {
      return Matter.Constraint.create({
        bodyA: a,
        bodyB: b,
        stiffness: 0,
        length: typeof normalizedData.length === 'number'
          ? normalizedData.length
          : bodyDistance(a, b),
        damping: 0,
        render: { visible: false }
      });
    }
    if (normalizedData.type === 'spring') {
      return Matter.Constraint.create({
        bodyA: a,
        bodyB: b,
        stiffness: 0.05,
        damping: 0,
        render: { strokeStyle: '#34d399', lineWidth: 2 }
      });
    }
    return null;
  }, [engineRef, normalizeConstraintData]);

  const addConstraintEntry = useCallback((data, shouldBroadcast = false) => {
    const engine = engineRef.current;
    if (!engine || !data) return null;

    const normalizedData = normalizeConstraintData(data);
    const constraint = buildConstraint(normalizedData);
    if (!normalizedData || !constraint) return null;

    Matter.World.add(engine.world, constraint);
    const entry = { constraint, data: normalizedData };
    constraintListRef.current.push(entry);
    notifyConstraintsChanged();

    if (shouldBroadcast && socketRef.current) {
      socketRef.current.emit('add-constraint', normalizedData);
    }

    return entry;
  }, [
    buildConstraint,
    engineRef,
    normalizeConstraintData,
    notifyConstraintsChanged
  ]);

  const beginPivotSelection = useCallback(() => {
    if (!Object.keys(bodyMapRef.current).length) {
      if (onActiveToolChangeRef.current) {
        onActiveToolChangeRef.current('select');
      }
      return;
    }
    pivotSelectionModeRef.current = true;
    draggedPivotAnchorRef.current = null;
    setSelectedBody(null);
  }, [setSelectedBody]);

  const createPivotForBody = useCallback((body) => {
    if (!body || !body.networkId) return null;

    const anchor = {
      x: body.position.x,
      y: Math.max(PIVOT_HANDLE_RADIUS, body.position.y - DEFAULT_PIVOT_OFFSET)
    };
    const data = {
      id: newConstraintId(),
      type: 'pivot',
      bodyA: body.networkId,
      pointA: anchor,
      pointB: { x: 0, y: 0 },
      length: distanceBetween(anchor, body.position)
    };

    recordHistory();
    const entry = addConstraintEntry(data, true);
    if (!entry) return null;

    pivotSelectionModeRef.current = false;
    setSelectedBody(null);
    if (onActiveToolChangeRef.current) {
      onActiveToolChangeRef.current('select');
    }
    return entry.data.id;
  }, [addConstraintEntry, recordHistory, setSelectedBody]);

  const findPivotHandleAt = useCallback((position) => {
    let closest = null;
    let closestDistance = PIVOT_HANDLE_RADIUS + 5;

    constraintListRef.current.forEach((entry) => {
      const { data } = entry;
      if (!data || data.type !== 'pivot' || !data.pointA) return;
      const distance = distanceBetween(position, data.pointA);
      if (distance <= closestDistance) {
        closest = entry;
        closestDistance = distance;
      }
    });

    return closest;
  }, []);

  const updatePivotAnchor = useCallback((constraintId, point, shouldBroadcast = false) => {
    const entry = constraintListRef.current.find(
      ({ data }) => data && data.id === constraintId
    );
    if (!entry) return;

    const body = bodyMapRef.current[entry.data.bodyA];
    if (!body) return;

    const pointA = {
      x: clampNumber(point.x, 0, CANVAS_WIDTH),
      y: clampNumber(point.y, 0, CANVAS_HEIGHT)
    };
    entry.data = {
      ...entry.data,
      pointA,
      length: distanceBetween(pointA, body.position)
    };
    syncMatterConstraint(entry);

    if (shouldBroadcast) {
      notifyConstraintsChanged();
      if (socketRef.current) {
        socketRef.current.emit('constraint-update', entry.data);
      }
    }
  }, [notifyConstraintsChanged, syncMatterConstraint]);

  const createConstraint = useCallback((type) => {
    const normalizedType = normalizeConstraintType(type);
    const order = addOrderRef.current;

    if (normalizedType === 'pivot') {
      beginPivotSelection();
      return;
    }

    let data = null;
    if (normalizedType === 'rod' || normalizedType === 'string' || normalizedType === 'spring') {
      if (order.length < 2) return;
      const bodyA = bodyMapRef.current[order[order.length - 2]];
      const bodyB = bodyMapRef.current[order[order.length - 1]];
      data = {
        id: newConstraintId(),
        type: normalizedType,
        bodyA: order[order.length - 2],
        bodyB: order[order.length - 1]
      };
      if ((normalizedType === 'rod' || normalizedType === 'string') && bodyA && bodyB) {
        data.length = bodyDistance(bodyA, bodyB);
      }
    }

    if (!data) return;
    recordHistory();
    addConstraintEntry(data, true);
  }, [addConstraintEntry, beginPivotSelection, recordHistory]);

  const addRemoteConstraint = useCallback((data) => {
    if (!data) return;
    if (data.id && constraintListRef.current.some(({ data: current }) => current.id === data.id)) {
      return;
    }
    addConstraintEntry(data, false);
  }, [addConstraintEntry]);

  const updateConstraintFromRemote = useCallback((data) => {
    if (!data || !data.id) return;
    const entry = constraintListRef.current.find(
      ({ data: current }) => current && current.id === data.id
    );
    if (!entry) {
      addRemoteConstraint(data);
      return;
    }

    const normalizedData = normalizeConstraintData({
      ...entry.data,
      ...data
    });
    if (!normalizedData) return;

    entry.data = normalizedData;
    syncMatterConstraint(entry);
    notifyConstraintsChanged();
  }, [
    addRemoteConstraint,
    normalizeConstraintData,
    notifyConstraintsChanged,
    syncMatterConstraint
  ]);

  const removeConstraintById = useCallback((constraintId, shouldBroadcast = false) => {
    const engine = engineRef.current;
    if (!engine || !constraintId) return;

    const entry = constraintListRef.current.find(
      ({ data }) => data.id === constraintId
    );
    if (!entry) return;

    if (shouldBroadcast) recordHistory();
    Matter.World.remove(engine.world, entry.constraint);
    constraintListRef.current = constraintListRef.current.filter(
      ({ data }) => data.id !== constraintId
    );
    if (
      draggedPivotAnchorRef.current &&
      draggedPivotAnchorRef.current.constraintId === constraintId
    ) {
      draggedPivotAnchorRef.current = null;
    }
    notifyConstraintsChanged();

    if (shouldBroadcast && socketRef.current) {
      socketRef.current.emit('remove-constraint', { id: constraintId });
    }
  }, [engineRef, notifyConstraintsChanged, recordHistory]);

  const applySceneSnapshot = useCallback((snapshot, shouldBroadcast = false) => {
    clearAllBodies();

    (snapshot.bodies || []).forEach((data) => {
      const body = deserializeBody(data);
      const networkId = data.networkId || newNetworkId();
      const ownerId =
        data.ownerId ||
        (socketRef.current && socketRef.current.id) ||
        'local';
      registerBody(body, data.type, networkId, ownerId);
    });

    (snapshot.constraints || []).forEach((data) => {
      addConstraintEntry(data, false);
    });

    notifyConstraintsChanged();
    if (onBodiesUpdateRef.current) {
      onBodiesUpdateRef.current(Object.values(bodyMapRef.current));
    }

    if (shouldBroadcast && socketRef.current) {
      socketRef.current.emit('load-state', getSceneSnapshot());
    }
  }, [
    addConstraintEntry,
    clearAllBodies,
    getSceneSnapshot,
    notifyConstraintsChanged,
    registerBody
  ]);

  const undoScene = useCallback(() => {
    if (!undoStackRef.current.length) return;
    const current = getSceneSnapshot();
    const previous = undoStackRef.current.pop();
    redoStackRef.current.push(current);
    applySceneSnapshot(previous, true);
    notifyHistoryChanged();
  }, [applySceneSnapshot, getSceneSnapshot, notifyHistoryChanged]);

  const redoScene = useCallback(() => {
    if (!redoStackRef.current.length) return;
    const current = getSceneSnapshot();
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(current);
    applySceneSnapshot(next, true);
    notifyHistoryChanged();
  }, [applySceneSnapshot, getSceneSnapshot, notifyHistoryChanged]);

  // Returns the pivot constraint attached to a body, or null. Used by the
  // apply-force feature to enforce the spec's "hinged block can only
  // receive tangential velocity" rule.
  const findPivotForBody = useCallback((networkId) => {
    for (const { data } of constraintListRef.current) {
      if (data && data.type === 'pivot' && data.bodyA === networkId) {
        return data;
      }
    }
    return null;
  }, []);

  // Apply a force or velocity to a body at a chosen angle. Honours every
  // constraint described in the physics spec.
  const applyToBody = useCallback((options) => {
    if (!options || !options.networkId) return;
    const body = bodyMapRef.current[options.networkId];
    if (!body) return;
    if (body.isStatic) return;

    const magnitude = Number(options.magnitude) || 0;
    if (magnitude <= 0) return;

    const angleRad = ((Number(options.angle) || 0) * Math.PI) / 180;
    // Canvas y axis is inverted, so 90 deg ("up" to the user) is -y.
    let vx = magnitude * Math.cos(angleRad);
    let vy = -magnitude * Math.sin(angleRad);

    const pivot = findPivotForBody(options.networkId);
    if (pivot) {
      const pivotPoint = pivot.pointA || { x: body.position.x, y: body.position.y };
      const dx = body.position.x - pivotPoint.x;
      const dy = body.position.y - pivotPoint.y;
      const dist = Math.hypot(dx, dy);
      const length = typeof pivot.length === 'number' ? pivot.length : 0;

      if (length <= 0.001) {
        // Hinge through the body's centre: the body cannot translate at all,
        // so a linear force / velocity has no physical meaning. Bail without
        // doing anything; the user feedback is the body simply stays put.
        recordHistory();
        return;
      }

      if (dist > 0) {
        // Pendulum: project the input onto the tangent direction so the
        // rod stays at constant length. Radial component is discarded.
        const ux = dx / dist;
        const uy = dy / dist;
        const radial = vx * ux + vy * uy;
        vx -= radial * ux;
        vy -= radial * uy;
      }
    }

    recordHistory();

    if (options.mode === 'force') {
      // Matter.Body.applyForce takes very small numbers — a force of ~1
      // would launch a unit-mass body across the canvas in one frame.
      // Convert "Newtons" the user enters to engine-scale by /1000.
      const FORCE_SCALE = 0.001;
      Matter.Body.applyForce(body, body.position, {
        x: vx * FORCE_SCALE,
        y: vy * FORCE_SCALE
      });
    } else {
      // Velocity mode: set velocity directly. We add to existing velocity
      // so re-applying compounds intuitively.
      Matter.Body.setVelocity(body, {
        x: body.velocity.x + vx,
        y: body.velocity.y + vy
      });
    }

    if (onBodiesUpdateRef.current) {
      onBodiesUpdateRef.current(Object.values(bodyMapRef.current));
    }
  }, [findPivotForBody, recordHistory]);

  // ---- Imperative API exposed to App.jsx ----------------------------------

  useImperativeHandle(ref, () => ({
    addBox: () => {
      const x = 200 + Math.random() * 400;
      const y = 80 + Math.random() * 80;
      addLocalBody(createBox(x, y), 'box');
    },
    addCircle: () => {
      const x = 200 + Math.random() * 400;
      const y = 80 + Math.random() * 80;
      addLocalBody(createCircle(x, y), 'circle');
    },
    finishPolygon,
    cancelPolygon,
    clear: () => {
      if (hasSceneContent()) recordHistory();
      clearAllBodies();
      if (socketRef.current) {
        socketRef.current.emit('clear-scene');
      }
    },
    undo: undoScene,
    redo: redoScene,
    pause: pauseSimulation,
    play: playSimulation,
    step: stepSimulation,
    setTimeScale: (speed) => {
      if (engineRef.current) {
        engineRef.current.timing.timeScale = speed || 1;
      }
    },
    setGravityEnabled: (enabled) => {
      const normalized = enabled !== false;
      applyGravityEnabled(normalized);
      if (socketRef.current) {
        socketRef.current.emit('gravity-update', {
          gravityEnabled: normalized
        });
      }
    },
    reset: () => {
      if (hasSceneContent()) recordHistory();
      clearAllBodies();
      if (socketRef.current) {
        socketRef.current.emit('clear-scene');
      }
    },
    deleteSelected: deleteSelectedBody,
    updateBodyProperties,
    applyToBody,
    addConstraint: (type) => createConstraint(type),
    removeConstraint: (constraintId) => removeConstraintById(constraintId, true),
    getSnapshot: () => {
      return getSceneSnapshot();
    },
    loadExperiment: (exp) => {
      if (hasSceneContent()) recordHistory();
      clearAllBodies();
      if (socketRef.current) {
        socketRef.current.emit('clear-scene');
      }
      (exp.bodies || []).forEach((data) => {
        const body = deserializeBody(data);
        const networkId = data.networkId || newNetworkId();
        const ownerId =
          (socketRef.current && socketRef.current.id) ||
          data.ownerId ||
          'local';
        registerBody(body, data.type, networkId, ownerId);
        if (socketRef.current) {
          socketRef.current.emit('add-body', {
            ...serializeBody(body),
            networkId,
            ownerId
          });
        }
      });
      (exp.constraints || []).forEach((data) => {
        addConstraintEntry(data, true);
      });
      notifyConstraintsChanged();
    },

    // Additive load. Used by Guided Lessons "Load Setup" so a student can
    // build their own scene first and then drop a pendulum / spring /
    // collision setup on top without losing what they already had.
    // Generates fresh networkId / constraint id values so loading the
    // same template several times doesn't produce id collisions.
    addTemplate: (template) => {
      if (!template) return;

      const idMap = {};
      recordHistory();

      (template.bodies || []).forEach((data) => {
        const body = deserializeBody(data);
        const newId = newNetworkId();
        if (data.networkId) idMap[data.networkId] = newId;
        const ownerId =
          (socketRef.current && socketRef.current.id) || 'local';
        registerBody(body, data.type, newId, ownerId);
        if (socketRef.current) {
          socketRef.current.emit('add-body', {
            ...serializeBody(body),
            networkId: newId,
            ownerId
          });
        }
      });

      (template.constraints || []).forEach((data) => {
        const remapped = {
          ...data,
          id: newConstraintId(),
          bodyA: idMap[data.bodyA] || data.bodyA,
          bodyB: idMap[data.bodyB] || data.bodyB
        };
        addConstraintEntry(remapped, true);
      });

      notifyConstraintsChanged();
    }
  }));

  // ---- Mouse drag tracking ------------------------------------------------

  useEffect(() => {
    const mc = mouseConstraintRef.current;
    if (!mc) return undefined;

    const onMouseDown = (e) => {
      const position = (e.mouse && e.mouse.position) || mc.mouse.position;
      if (activeToolRef.current === 'polygon') {
        addPolygonPoint({ x: position.x, y: position.y });
        setSelectedBody(null);
        return;
      }

      const pivotHandle = findPivotHandleAt(position);
      if (pivotHandle) {
        recordHistory();
        draggedPivotAnchorRef.current = {
          constraintId: pivotHandle.data.id
        };
        if (mc.constraint) mc.constraint.bodyB = null;
        setSelectedBody(null);
        return;
      }

      const hits = Matter.Query.point(
        Object.values(bodyMapRef.current),
        position
      );
      const body = hits[hits.length - 1];

      if (pivotSelectionModeRef.current) {
        if (body) createPivotForBody(body);
        return;
      }

      setSelectedBody(body ? body.networkId : null);
    };
    const onMouseMove = (e) => {
      if (!draggedPivotAnchorRef.current) return;
      const position = (e.mouse && e.mouse.position) || mc.mouse.position;
      updatePivotAnchor(
        draggedPivotAnchorRef.current.constraintId,
        position,
        false
      );
    };
    const onMouseUp = (e) => {
      if (!draggedPivotAnchorRef.current) return;
      const position = (e.mouse && e.mouse.position) || mc.mouse.position;
      const constraintId = draggedPivotAnchorRef.current.constraintId;
      draggedPivotAnchorRef.current = null;
      updatePivotAnchor(constraintId, position, true);
      if (mc.constraint) mc.constraint.bodyB = null;
    };
    const onStart = (e) => {
      if (draggedPivotAnchorRef.current || pivotSelectionModeRef.current) {
        draggedBodyRef.current = null;
        if (mc.constraint) mc.constraint.bodyB = null;
        return;
      }
      draggedBodyRef.current = e.body;
      if (e.body && e.body.networkId) {
        setSelectedBody(e.body.networkId);
      }
    };
    const onEnd = () => {
      draggedBodyRef.current = null;
    };

    Matter.Events.on(mc, 'mousedown', onMouseDown);
    Matter.Events.on(mc, 'mousemove', onMouseMove);
    Matter.Events.on(mc, 'mouseup', onMouseUp);
    Matter.Events.on(mc, 'startdrag', onStart);
    Matter.Events.on(mc, 'enddrag', onEnd);
    return () => {
      Matter.Events.off(mc, 'mousedown', onMouseDown);
      Matter.Events.off(mc, 'mousemove', onMouseMove);
      Matter.Events.off(mc, 'mouseup', onMouseUp);
      Matter.Events.off(mc, 'startdrag', onStart);
      Matter.Events.off(mc, 'enddrag', onEnd);
    };
  }, [
    addPolygonPoint,
    createPivotForBody,
    findPivotHandleAt,
    mouseConstraintRef,
    recordHistory,
    setSelectedBody,
    updatePivotAnchor
  ]);

  useEffect(() => {
    const render = renderRef.current;
    const canvas = render && render.canvas;
    if (!canvas) return undefined;

    const onTouchStart = (event) => {
      if (event.cancelable) event.preventDefault();
      if (activeToolRef.current === 'polygon') return;
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;

      const position = getTouchCanvasPosition(touch, canvas);
      const hits = Matter.Query.point(
        Object.values(bodyMapRef.current),
        position
      );
      const body = hits[hits.length - 1];
      if (pivotSelectionModeRef.current) {
        if (body) createPivotForBody(body);
        return;
      }
      setSelectedBody(body ? body.networkId : null);
    };

    const stopBrowserGesture = (event) => {
      if (event.cancelable) event.preventDefault();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', stopBrowserGesture, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', stopBrowserGesture);
    };
  }, [createPivotForBody, renderRef, setSelectedBody]);

  // ---- Socket event handlers ---------------------------------------------

  useEffect(() => {
    if (!socket) return undefined;

    const onAddBody = (data) => addRemoteBody(data);
    const onAddConstraint = (data) => addRemoteConstraint(data);
    const onConstraintUpdate = (data) => updateConstraintFromRemote(data);
    const onRemoveConstraint = (data) => {
      const constraintId = data && data.id ? data.id : data;
      removeConstraintById(constraintId, false);
    };
    const onBodyPropertiesUpdate = (data) => {
      if (!data || !data.networkId) return;
      updateBodyProperties(data.networkId, data, false);
    };
    const onRemoveBody = (data) => {
      const networkId = data && data.networkId ? data.networkId : data;
      if (networkId) removeBodyById(networkId, false);
    };

    const onBodyUpdate = (data) => {
      const body = bodyMapRef.current[data.networkId];
      if (!body) return;
      // Don't override the body we're currently dragging locally
      if (
        draggedBodyRef.current &&
        draggedBodyRef.current.networkId === data.networkId
      ) {
        return;
      }
      smoothMoveBody(body, data.x, data.y);
      if (typeof data.angle === 'number') {
        smoothRotate(body, data.angle);
      }
    };

    const onClearScene = () => clearAllBodies();
    const onLoadState = (state) => {
      applySceneSnapshot(state || {}, false);
      if (state && typeof state.gravityEnabled === 'boolean') {
        syncGravityFromRemote(state.gravityEnabled);
      }
    };
    const onGravityUpdate = (data) => {
      const nextGravityEnabled =
        data && typeof data.gravityEnabled === 'boolean'
          ? data.gravityEnabled
          : data;
      syncGravityFromRemote(nextGravityEnabled);
    };

    const onRoomState = (state) => {
      // Initial sync when joining a room with existing content
      clearAllBodies();
      (state.bodies || []).forEach((b) => addRemoteBody(b));
      (state.constraints || []).forEach((c) => addRemoteConstraint(c));
      if (typeof state.gravityEnabled === 'boolean') {
        syncGravityFromRemote(state.gravityEnabled);
      }
    };

    socket.on('add-body', onAddBody);
    socket.on('add-constraint', onAddConstraint);
    socket.on('constraint-update', onConstraintUpdate);
    socket.on('remove-constraint', onRemoveConstraint);
    socket.on('body-properties-update', onBodyPropertiesUpdate);
    socket.on('remove-body', onRemoveBody);
    socket.on('body-update', onBodyUpdate);
    socket.on('clear-scene', onClearScene);
    socket.on('load-state', onLoadState);
    socket.on('room-state', onRoomState);
    socket.on('gravity-update', onGravityUpdate);

    return () => {
      socket.off('add-body', onAddBody);
      socket.off('add-constraint', onAddConstraint);
      socket.off('constraint-update', onConstraintUpdate);
      socket.off('remove-constraint', onRemoveConstraint);
      socket.off('body-properties-update', onBodyPropertiesUpdate);
      socket.off('remove-body', onRemoveBody);
      socket.off('body-update', onBodyUpdate);
      socket.off('clear-scene', onClearScene);
      socket.off('load-state', onLoadState);
      socket.off('room-state', onRoomState);
      socket.off('gravity-update', onGravityUpdate);
    };
  }, [
    socket,
    addRemoteBody,
    addRemoteConstraint,
    clearAllBodies,
    applySceneSnapshot,
    removeBodyById,
    removeConstraintById,
    syncGravityFromRemote,
    updateConstraintFromRemote,
    updateBodyProperties
  ]);

  // ---- Broadcast loop + analytics tick -----------------------------------

  useEffect(() => {
    let frame = 0;
    const tick = setInterval(() => {
      // While paused, the world is frozen — broadcasting and chart-pushing
      // would only spam empty samples. Skip the entire tick.
      if (isPausedRef.current) return;

      frame += 1;
      const socket = socketRef.current;
      const myId = (socket && socket.id) || null;
      if (myId) myIdRef.current = myId;

      // Broadcast updates for bodies we own (or are dragging)
      if (socket) {
        Object.values(bodyMapRef.current).forEach((body) => {
          if (body.isStatic) return;
          const isOwner = body.ownerId === myId;
          const isDragging =
            draggedBodyRef.current &&
            draggedBodyRef.current.networkId === body.networkId;
          const speed = Math.hypot(body.velocity.x, body.velocity.y);
          if (isDragging || (isOwner && speed > 0.05)) {
            socket.emit('body-update', {
              networkId: body.networkId,
              x: body.position.x,
              y: body.position.y,
              angle: body.angle
            });
          }
        });
      }

      // Notify the parent about current bodies for analytics, but
      // throttled so we don't re-render React too aggressively.
      if (frame % 3 === 0 && onBodiesUpdateRef.current) {
        onBodiesUpdateRef.current(Object.values(bodyMapRef.current));
      }
    }, 100);

    return () => clearInterval(tick);
  }, []);

  return (
    <div className="flex items-center justify-center h-full w-full bg-black/30 p-4">
      <div
        ref={wrapperRef}
        className="border border-gray-800 rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          touchAction: 'none',
          userSelect: 'none'
        }}
      />
    </div>
  );
});

PhysicsCanvas.displayName = 'PhysicsCanvas';

export default PhysicsCanvas;
