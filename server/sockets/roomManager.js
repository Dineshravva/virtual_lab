// Simple in-memory store of room state. A room is created on first join
// and cleaned up automatically when the last user leaves.
//
// We keep this in memory (rather than the database) because it changes
// many times per second during a live session. The database is only used
// for permanent saved experiments.

const rooms = {};
const EMPTY_ROOM_GRACE_MS = 30000;

function getRoom(roomName) {
  if (!rooms[roomName]) {
    rooms[roomName] = {
      bodies: [],
      constraints: [],
      gravityEnabled: true,
      users: 0
    };
  }
  return rooms[roomName];
}

function addUser(roomName) {
  const room = getRoom(roomName);
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
  room.users += 1;
  return room;
}

function removeUser(roomName) {
  const room = rooms[roomName];
  if (!room) return;
  room.users = Math.max(0, room.users - 1);
  if (room.users <= 0 && !room.cleanupTimer) {
    room.cleanupTimer = setTimeout(() => {
      const latest = rooms[roomName];
      if (latest && latest.users <= 0) {
        delete rooms[roomName];
      }
    }, EMPTY_ROOM_GRACE_MS);
  }
}

function addBody(roomName, body) {
  const room = getRoom(roomName);
  room.bodies.push(body);
}

function updateBody(roomName, update) {
  const room = getRoom(roomName);
  const body = room.bodies.find((item) => item.networkId === update.networkId);
  if (!body) return;

  if (typeof update.x === 'number') body.x = update.x;
  if (typeof update.y === 'number') body.y = update.y;
  if (typeof update.angle === 'number') body.angle = update.angle;
}

function updateBodyProperties(roomName, update) {
  const room = getRoom(roomName);
  const body = room.bodies.find((item) => item.networkId === update.networkId);
  if (!body) return;

  if (typeof update.mass === 'number') body.mass = update.mass;
  if (typeof update.friction === 'number') body.friction = update.friction;
  if (typeof update.restitution === 'number') {
    body.restitution = update.restitution;
  }
  if (typeof update.color === 'string') body.color = update.color;
}

function addConstraint(roomName, constraint) {
  const room = getRoom(roomName);
  room.constraints.push(constraint);
}

function updateConstraint(roomName, update) {
  const room = getRoom(roomName);
  const index = room.constraints.findIndex(
    (constraint) => constraint.id === update.id
  );
  if (index === -1) return;

  room.constraints[index] = {
    ...room.constraints[index],
    ...update
  };
}

function removeConstraint(roomName, constraintId) {
  const room = getRoom(roomName);
  room.constraints = room.constraints.filter(
    (constraint) => constraint.id !== constraintId
  );
}

function removeBody(roomName, networkId) {
  const room = getRoom(roomName);
  room.bodies = room.bodies.filter((body) => body.networkId !== networkId);
  room.constraints = room.constraints.filter(
    (constraint) =>
      constraint.bodyA !== networkId && constraint.bodyB !== networkId
  );
}

function clearRoom(roomName) {
  const room = getRoom(roomName);
  room.bodies = [];
  room.constraints = [];
}

function setRoomState(roomName, state) {
  const room = getRoom(roomName);
  if (state.bodies) room.bodies = state.bodies;
  if (state.constraints) room.constraints = state.constraints;
  if (typeof state.gravityEnabled === 'boolean') {
    room.gravityEnabled = state.gravityEnabled;
  }
}

function setGravityEnabled(roomName, gravityEnabled) {
  const room = getRoom(roomName);
  room.gravityEnabled = gravityEnabled;
}

module.exports = {
  getRoom,
  addUser,
  removeUser,
  addBody,
  updateBody,
  updateBodyProperties,
  addConstraint,
  updateConstraint,
  removeConstraint,
  removeBody,
  clearRoom,
  setRoomState,
  setGravityEnabled
};
