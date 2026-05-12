import Matter from 'matter-js';

// When we receive a remote body update, we don't snap the body to the
// new position because that looks jittery. Instead we move it part of
// the way each frame, so it visually catches up smoothly.

export function smoothMoveBody(body, targetX, targetY, factor = 0.25) {
  const newX = body.position.x + (targetX - body.position.x) * factor;
  const newY = body.position.y + (targetY - body.position.y) * factor;
  Matter.Body.setPosition(body, { x: newX, y: newY });
  // Reset velocity so the local engine doesn't keep accelerating
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
}

export function smoothRotate(body, targetAngle, factor = 0.25) {
  const diff = targetAngle - body.angle;
  Matter.Body.setAngle(body, body.angle + diff * factor);
  Matter.Body.setAngularVelocity(body, 0);
}
