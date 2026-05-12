import Matter from 'matter-js';

// ============================================================================
// Distance positioning utility functions.
//
// Two modes:
//   1. OBJECT-TO-OBJECT  — uses Center of Mass (COM) for dx/dy
//   2. OBJECT-TO-PLANE   — uses perpendicular distance from COM to plane surface
//
// All distance values are in METRES.  Conversion to/from pixels uses the same
// scale the grid system defines:  GRID_STEP_PIXELS / GRID_METRES_PER_STEP.
// ============================================================================

const GRID_STEP_PIXELS = 50;
const GRID_METRES_PER_STEP = 1;
const PX_PER_METRE = GRID_STEP_PIXELS / GRID_METRES_PER_STEP; // 50

/**
 * Convert metres → pixels.
 */
export function metresToPx(metres) {
  return metres * PX_PER_METRE;
}

/**
 * Convert pixels → metres.
 */
export function pxToMetres(px) {
  return px / PX_PER_METRE;
}

// ---- Center of Mass -------------------------------------------------------

/**
 * Return the centre-of-mass position of a Matter.js body.
 * For simple shapes Matter stores this as `body.position`.
 * For compound bodies created via `fromVertices`, the COM is also
 * `body.position` because Matter re-centres the body on creation.
 */
export function getBodyCOM(body) {
  if (!body) return null;
  return { x: body.position.x, y: body.position.y };
}

// ---- Object-to-Object positioning -----------------------------------------

/**
 * Compute the target position for bodyB so that:
 *   COM(B).x = COM(A).x + dx   (in pixels)
 *   COM(B).y = COM(A).y + dy   (in pixels, positive = downward in canvas)
 *
 * `dxMetres` / `dyMetres` are in the user's metre units.
 * Canvas Y is inverted: positive dy means "below" the reference on screen.
 *
 * Returns { x, y } in pixel coordinates, or null if bodyA is missing.
 */
export function computeObjectToObjectTarget(bodyA, dxMetres, dyMetres) {
  const comA = getBodyCOM(bodyA);
  if (!comA) return null;

  return {
    x: comA.x + metresToPx(dxMetres),
    y: comA.y + metresToPx(dyMetres)
  };
}

// ---- Plane perpendicular distance -----------------------------------------

/**
 * For a plane body, return the unit normal vector pointing "above" the surface.
 * A plane at angle 0° has its normal pointing upward (0, -1).
 * The plane's angle in radians is stored in `body.angle`.
 *
 * The "above" side is defined as the side the normal points to after rotating
 * the default (0, -1) vector by the body's angle.
 */
export function getPlaneNormal(planeBody) {
  const angle = planeBody.angle || 0;
  // Default normal is (0, -1) — "up" in canvas coords
  return {
    x: -Math.sin(angle),
    y: -Math.cos(angle)
  };
}

/**
 * Get a point on the plane surface (its centre).
 */
export function getPlaneSurfacePoint(planeBody) {
  return { x: planeBody.position.x, y: planeBody.position.y };
}

/**
 * Compute the signed perpendicular distance from a point to the plane surface.
 * Positive = on the "normal" (above) side.
 * Negative = below the surface (embedded).
 */
export function signedPerpendicularDistance(point, planeBody) {
  const normal = getPlaneNormal(planeBody);
  const surface = getPlaneSurfacePoint(planeBody);
  // vector from surface point to query point
  const dx = point.x - surface.x;
  const dy = point.y - surface.y;
  // dot product with normal
  return dx * normal.x + dy * normal.y;
}

/**
 * Compute the target position for an object so that its COM is at exactly
 * `distanceMetres` perpendicular distance from the plane surface.
 *
 * The object is placed on the "normal" (above) side of the plane.
 * A half-thickness offset is added so we measure from the visible surface,
 * not from the plane's centre line.
 *
 * Returns { x, y } in pixel coordinates.
 */
export function computePlaneDistanceTarget(planeBody, targetBody, distanceMetres) {
  const normal = getPlaneNormal(planeBody);
  const surface = getPlaneSurfacePoint(planeBody);
  const distPx = metresToPx(distanceMetres);

  // The plane is a rectangle with a certain height (thickness).
  // We offset by half-thickness so distance is measured from the visible surface.
  const planeHalfThickness = 6; // matches PLANE_THICKNESS / 2 from physicsHelpers
  const surfaceOffset = planeHalfThickness;

  // Also account for the target body's bounding radius so it sits on the
  // surface rather than its COM being exactly at the surface.
  const bodyRadius = getBodyBoundingRadius(targetBody);

  const totalOffsetPx = surfaceOffset + bodyRadius + distPx;

  return {
    x: surface.x + normal.x * totalOffsetPx,
    y: surface.y + normal.y * totalOffsetPx
  };
}

/**
 * Approximate bounding radius of a body from its COM to its farthest bound.
 * Used to prevent the body from overlapping the plane surface.
 */
export function getBodyBoundingRadius(body) {
  if (!body) return 0;
  if (body.circleRadius) return body.circleRadius;
  const hw = (body.bounds.max.x - body.bounds.min.x) / 2;
  const hh = (body.bounds.max.y - body.bounds.min.y) / 2;
  return Math.max(hw, hh);
}

// ---- Boundary validation --------------------------------------------------

/**
 * Check whether a target position would place the body (partially or fully)
 * outside the canvas workspace.
 *
 * Returns an object:
 *   { valid: true,  position: { x, y } }              — target is safe
 *   { valid: false, position: { x, y }, reason: '…' }  — clamped or rejected
 *
 * If invalid, `position` contains the closest valid placement.
 */
export function validateBounds(target, body, canvasWidth, canvasHeight) {
  const radius = getBodyBoundingRadius(body);
  const margin = 2; // small safety margin

  const minX = radius + margin;
  const maxX = canvasWidth - radius - margin;
  const minY = radius + margin;
  const maxY = canvasHeight - radius - margin;

  let x = target.x;
  let y = target.y;
  let clamped = false;
  const reasons = [];

  if (x < minX) { x = minX; clamped = true; reasons.push('left boundary'); }
  if (x > maxX) { x = maxX; clamped = true; reasons.push('right boundary'); }
  if (y < minY) { y = minY; clamped = true; reasons.push('top boundary'); }
  if (y > maxY) { y = maxY; clamped = true; reasons.push('bottom boundary'); }

  if (clamped) {
    return {
      valid: false,
      position: { x, y },
      reason: `Position adjusted: exceeds ${reasons.join(', ')}.`
    };
  }

  return { valid: true, position: { x, y } };
}

/**
 * Check if placing bodyB at `target` would overlap bodyA.
 * Uses bounding-radius approximation for speed.
 */
export function wouldOverlap(target, bodyB, bodyA) {
  if (!bodyA || !bodyB) return false;
  const rA = getBodyBoundingRadius(bodyA);
  const rB = getBodyBoundingRadius(bodyB);
  const dx = target.x - bodyA.position.x;
  const dy = target.y - bodyA.position.y;
  return Math.hypot(dx, dy) < (rA + rB) * 0.8;
}

// ---- Reposition helper ----------------------------------------------------

/**
 * Safely reposition a body to a new (x, y) and zero its velocity so it
 * doesn't drift.  Works in both gravity and no-gravity modes.
 */
export function repositionBody(body, target) {
  if (!body) return;
  Matter.Body.setPosition(body, target);
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(body, 0);
}
