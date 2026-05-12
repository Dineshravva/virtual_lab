import Matter from 'matter-js';

// Default visual style for new bodies
const BOX_COLOR = '#38bdf8';
const CIRCLE_COLOR = '#f472b6';
const POLYGON_COLOR = '#a3e635';
const PLANE_COLOR = '#64748b';
const STATIC_COLOR = '#1f2937';

function applySerializedProperties(body, data) {
  // Hard-zero air drag. The simulation's only allowed energy losses are
  // user-set surface friction and collision elasticity. Matter.js's default
  // frictionAir of 0.01 silently kills oscillations in ~1-2 swings, which
  // is the wrong physics for a teaching tool.
  body.frictionAir = 0;

  if (typeof data.mass === 'number' && data.mass > 0) {
    Matter.Body.setMass(body, data.mass);
  }
  if (typeof data.friction === 'number') {
    body.friction = data.friction;
  }
  if (typeof data.restitution === 'number') {
    body.restitution = data.restitution;
  }
  if (data.color) {
    body.render.fillStyle = data.color;
    body.baseFillStyle = data.color;
  }
}

// Create a draggable box at (x, y)
export function createBox(x, y, w = 60, h = 60, options = {}) {
  return Matter.Bodies.rectangle(x, y, w, h, {
    restitution: 0.4,
    friction: 0.3,
    frictionAir: 0,
    render: { fillStyle: BOX_COLOR },
    ...options
  });
}

// Create a draggable circle at (x, y)
export function createCircle(x, y, r = 30, options = {}) {
  return Matter.Bodies.circle(x, y, r, {
    restitution: 0.6,
    friction: 0.3,
    frictionAir: 0,
    render: { fillStyle: CIRCLE_COLOR },
    ...options
  });
}

// Create a draggable polygon from canvas points.
export function createPolygon(points, options = {}) {
  if (!points || points.length < 3) return null;

  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  center.x /= points.length;
  center.y /= points.length;

  const body = Matter.Bodies.fromVertices(
    center.x,
    center.y,
    [points],
    {
      restitution: 0.45,
      friction: 0.3,
      frictionAir: 0,
      render: { fillStyle: POLYGON_COLOR },
      ...options
    },
    true
  );

  if (!body) return null;
  body.shapeVertices = body.vertices.map((vertex) => ({
    x: vertex.x - body.position.x,
    y: vertex.y - body.position.y
  }));
  return body;
}

// Create a static rigid plane/floor at (x, y) with a given length, thickness, and angle.
// The plane acts as an immovable surface that other bodies can collide with.
export function createPlane(x, y, length = 200, angle = 0, options = {}) {
  const PLANE_THICKNESS = 12;
  const body = Matter.Bodies.rectangle(x, y, length, PLANE_THICKNESS, {
    isStatic: true,
    restitution: 0.3,
    friction: 0.5,
    frictionStatic: 0.6,
    frictionAir: 0,
    chamfer: { radius: 2 },
    render: {
      fillStyle: PLANE_COLOR,
      strokeStyle: '#94a3b8',
      lineWidth: 1
    },
    ...options
  });
  if (angle !== 0) {
    Matter.Body.setAngle(body, (angle * Math.PI) / 180);
  }
  body.shapeType = 'plane';
  body.planeLength = length;
  body.planeAngle = angle;
  body.planeLocked = false;
  body.baseFillStyle = PLANE_COLOR;
  return body;
}

// Build the four static walls around the canvas so bodies stay visible.
export function createWalls(width, height, thickness = 50) {
  const opts = { isStatic: true, render: { fillStyle: STATIC_COLOR } };
  return [
    Matter.Bodies.rectangle(width / 2, -thickness / 2, width, thickness, opts),
    Matter.Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, opts),
    Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height, opts),
    Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, opts)
  ];
}

// Convert a Matter body into plain JSON we can send over the network
// or save in MongoDB. We only keep the data needed to rebuild it.
export function serializeBody(body) {
  const type = body.shapeType || (body.circleRadius ? 'circle' : 'box');
  const serialized = {
    type: body.shapeType || (body.circleRadius ? 'circle' : 'box'),
    x: body.position.x,
    y: body.position.y,
    angle: body.angle,
    width: body.bounds.max.x - body.bounds.min.x,
    height: body.bounds.max.y - body.bounds.min.y,
    radius: body.circleRadius || null,
    mass: body.mass,
    friction: body.friction,
    restitution: body.restitution,
    color: body.baseFillStyle || body.render.fillStyle,
    isStatic: body.isStatic
  };

  if (type === 'polygon') {
    serialized.vertices = body.shapeVertices || body.vertices.map((vertex) => ({
      x: vertex.x - body.position.x,
      y: vertex.y - body.position.y
    }));
  }

  if (type === 'plane') {
    serialized.planeLength = body.planeLength || 200;
    serialized.planeAngle = body.planeAngle || 0;
    serialized.planeLocked = !!body.planeLocked;
  }

  return serialized;
}

// Inverse of serializeBody: rebuild a Matter body from plain JSON.
export function deserializeBody(data) {
  let body;
  if (data.type === 'plane') {
    body = createPlane(
      data.x,
      data.y,
      data.planeLength || data.width || 200,
      data.planeAngle || 0
    );
    body.planeLocked = !!data.planeLocked;
    applySerializedProperties(body, data);
    return body;
  } else if (data.type === 'polygon' && data.vertices && data.vertices.length >= 3) {
    const points = data.vertices.map((vertex) => ({
      x: data.x + vertex.x,
      y: data.y + vertex.y
    }));
    body = createPolygon(points, { isStatic: data.isStatic });
  } else if (data.type === 'circle' && data.radius) {
    body = createCircle(data.x, data.y, data.radius, { isStatic: data.isStatic });
  } else {
    body = createBox(data.x, data.y, data.width, data.height, { isStatic: data.isStatic });
  }
  body.shapeType = data.type;
  if (typeof data.angle === 'number') {
    Matter.Body.setAngle(body, data.angle);
  }
  applySerializedProperties(body, data);
  return body;
}
