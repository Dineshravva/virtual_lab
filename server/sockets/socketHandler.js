const roomManager = require('./roomManager');

// --- Limits ----------------------------------------------------------------
// A correctly-behaving client never approaches these. They exist only to
// stop a malicious or buggy peer from driving server memory or bandwidth.
const MAX_ROOM_NAME_LENGTH = 80;
const MAX_BODIES_PER_ROOM = 200;
const MAX_CONSTRAINTS_PER_ROOM = 200;
const MAX_BODY_PAYLOAD_BYTES = 8 * 1024;
const MAX_CONSTRAINT_PAYLOAD_BYTES = 4 * 1024;
const MAX_LOAD_PAYLOAD_BYTES = 256 * 1024;

function payloadSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value || {}), 'utf8');
  } catch {
    return Infinity;
  }
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isValidRoomName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= MAX_ROOM_NAME_LENGTH;
}

// Wires up all Socket.io events for the collaborative session.
// Events handled:
//   - join-room        : a user joins a named room
//   - add-body         : a user added a new body
//   - remove-body      : a user removed one body
//   - body-properties-update : a user edited physical body properties
//   - add-constraint   : a user added a rod/string/spring/pivot
//   - constraint-update: a user moved or edited an existing constraint
//   - remove-constraint: a user removed a constraint
//   - gravity-update   : a user toggled downward gravity
//   - body-update      : high-frequency position update
//   - clear-scene      : remove everything in the room
//   - load-state       : replace room state with a saved experiment
function setupSockets(io) {
  io.on('connection', (socket) => {
    console.log('[socket] User connected:', socket.id);
    let currentRoom = null;

    socket.on('join-room', (roomName) => {
      if (!isValidRoomName(roomName)) return;
      currentRoom = roomName;
      socket.join(roomName);

      const room = roomManager.addUser(roomName);

      // Send the current room state so the new user can see existing bodies
      socket.emit('room-state', {
        bodies: room.bodies,
        constraints: room.constraints,
        gravityEnabled: room.gravityEnabled
      });

      socket.to(roomName).emit('user-joined', { id: socket.id, users: room.users });
      console.log(`[socket] ${socket.id} joined room "${roomName}" (users: ${room.users})`);
    });

    socket.on('add-body', (body) => {
      if (!currentRoom) return;
      if (!isPlainObject(body) || !body.networkId) return;
      if (payloadSize(body) > MAX_BODY_PAYLOAD_BYTES) return;

      const room = roomManager.getRoom(currentRoom);
      if (room.bodies.length >= MAX_BODIES_PER_ROOM) return;

      roomManager.addBody(currentRoom, body);
      socket.to(currentRoom).emit('add-body', body);
    });

    socket.on('remove-body', (data) => {
      if (!currentRoom) return;
      const networkId = data && data.networkId ? data.networkId : data;
      if (typeof networkId !== 'string' || !networkId) return;
      roomManager.removeBody(currentRoom, networkId);
      socket.to(currentRoom).emit('remove-body', { networkId });
    });

    socket.on('body-properties-update', (update) => {
      if (!currentRoom) return;
      if (!isPlainObject(update) || typeof update.networkId !== 'string') return;
      if (payloadSize(update) > MAX_BODY_PAYLOAD_BYTES) return;
      roomManager.updateBodyProperties(currentRoom, update);
      socket.to(currentRoom).emit('body-properties-update', update);
    });

    socket.on('add-constraint', (constraint) => {
      if (!currentRoom) return;
      if (!isPlainObject(constraint) || !constraint.type) return;
      if (payloadSize(constraint) > MAX_CONSTRAINT_PAYLOAD_BYTES) return;

      const room = roomManager.getRoom(currentRoom);
      if (room.constraints.length >= MAX_CONSTRAINTS_PER_ROOM) return;

      roomManager.addConstraint(currentRoom, constraint);
      socket.to(currentRoom).emit('add-constraint', constraint);
    });

    socket.on('constraint-update', (constraint) => {
      if (!currentRoom) return;
      if (!isPlainObject(constraint) || typeof constraint.id !== 'string') return;
      if (payloadSize(constraint) > MAX_CONSTRAINT_PAYLOAD_BYTES) return;
      roomManager.updateConstraint(currentRoom, constraint);
      socket.to(currentRoom).emit('constraint-update', constraint);
    });

    socket.on('remove-constraint', (data) => {
      if (!currentRoom) return;
      const constraintId = data && data.id ? data.id : data;
      if (typeof constraintId !== 'string' || !constraintId) return;
      roomManager.removeConstraint(currentRoom, constraintId);
      socket.to(currentRoom).emit('remove-constraint', { id: constraintId });
    });

    socket.on('gravity-update', (data) => {
      if (!currentRoom) return;
      const gravityEnabled =
        data && typeof data.gravityEnabled === 'boolean'
          ? data.gravityEnabled
          : data;
      if (typeof gravityEnabled !== 'boolean') return;
      roomManager.setGravityEnabled(currentRoom, gravityEnabled);
      socket.to(currentRoom).emit('gravity-update', { gravityEnabled });
    });

    // Streaming position update. We store the latest snapshot so reconnecting
    // users rejoin near the current scene state.
    socket.on('body-update', (update) => {
      if (!currentRoom) return;
      if (
        !isPlainObject(update) ||
        typeof update.networkId !== 'string' ||
        typeof update.x !== 'number' ||
        typeof update.y !== 'number'
      ) {
        return;
      }
      roomManager.updateBody(currentRoom, update);
      socket.to(currentRoom).emit('body-update', update);
    });

    socket.on('clear-scene', () => {
      if (!currentRoom) return;
      roomManager.clearRoom(currentRoom);
      io.to(currentRoom).emit('clear-scene');
    });

    socket.on('load-state', (state) => {
      if (!currentRoom) return;
      if (!isPlainObject(state)) return;
      if (payloadSize(state) > MAX_LOAD_PAYLOAD_BYTES) return;
      // Truncate over-large arrays defensively
      const bounded = {
        bodies: Array.isArray(state.bodies)
          ? state.bodies.slice(0, MAX_BODIES_PER_ROOM)
          : [],
        constraints: Array.isArray(state.constraints)
          ? state.constraints.slice(0, MAX_CONSTRAINTS_PER_ROOM)
          : [],
        gravityEnabled:
          typeof state.gravityEnabled === 'boolean'
            ? state.gravityEnabled
            : roomManager.getRoom(currentRoom).gravityEnabled
      };
      roomManager.setRoomState(currentRoom, bounded);
      io.to(currentRoom).emit('load-state', bounded);
    });

    socket.on('disconnect', () => {
      if (currentRoom) {
        roomManager.removeUser(currentRoom);
        socket.to(currentRoom).emit('user-left', { id: socket.id });
      }
      console.log('[socket] User disconnected:', socket.id);
    });
  });
}

module.exports = setupSockets;
