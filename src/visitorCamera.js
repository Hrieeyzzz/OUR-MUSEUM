import * as THREE from "three";
import { LOVE_ROTUNDA } from "./galleryLayout.js";
import { PHOTO_BAYS } from "./photoLayout.js";

function cameraBlocked(p, depth) {
  if (Math.abs(p.x) > 8.5 || p.z < -5.45 || p.z > depth - 0.4) return true;
  if (p.y > 4.3) return false;
  for (const s of LOVE_ROTUNDA.screens)
    if (
      p.y > 1.25 &&
      Math.abs(p.x - s.x) < s.width / 2 + 0.28 &&
      Math.abs(p.z - s.z) < 0.5
    )
      return true;
  for (const s of LOVE_ROTUNDA.sculptures)
    if (p.y < 3.4 && Math.hypot(p.x - s.x, p.z - s.z) < 1) return true;
  return false;
}
function columnBlocked(p, depth) {
  for (let z = PHOTO_BAYS.firstColumn; z < depth; z += PHOTO_BAYS.spacing)
    if (Math.hypot(Math.abs(p.x) - 7.85, p.z - z) < 0.63) return true;
  return [-8.2, -3.15, 3.15, 8.2].some(
    (x) => Math.hypot(p.x - x, p.z + 5.45) < 0.63,
  );
}
export function thirdPersonCamera(player, yaw, pitch, depth) {
  const target = new THREE.Vector3(player.x, 1.1, player.z);
  const height = 2.7 + Math.sin(pitch) * 2.0;
  const desired = new THREE.Vector3(
    player.x + Math.sin(yaw) * 4.0,
    height,
    player.z + Math.cos(yaw) * 4.0,
  );
  const direction = desired.clone().sub(target),
    length = direction.length();
  direction.normalize();
  let distance = length;
  for (let d = 0.45; d <= length; d += 0.15) {
    const point = target.clone().addScaledVector(direction, d);
    if (cameraBlocked(point, depth) || columnBlocked(point, depth)) {
      distance = Math.max(0.4, d - 0.2);
      break;
    }
  }
  return {
    position: target.clone().addScaledVector(direction, distance),
    target,
    distance,
  };
}
export function interactionCamera(action, people, depth) {
  const a = people.find((p) => p.id === action.actor),
    b = people.find((p) => p.id === action.target);
  if (!a || !b) return null;
  const x = (a.x + b.x) / 2,
    z = (a.z + b.z) / 2;
  const position =
    action.type === "hands"
      ? new THREE.Vector3(x + 2.6, 2.25, z - 3.8)
      : new THREE.Vector3(x + 3.25, 2.15, z + 2.25);
  position.x = THREE.MathUtils.clamp(position.x, -8.2, 8.2);
  position.z = THREE.MathUtils.clamp(position.z, -5.3, depth - 0.6);
  return {
    position,
    target: new THREE.Vector3(x, action.type === "propose" ? 1.0 : 1.2, z),
  };
}
