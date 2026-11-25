import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  VISITOR_OUTFITS,
  visitorAppearance,
  activeVisitorGesture,
  GESTURE_DURATION,
} from "../src/visitorConfig.js";
import {
  createVisitorAvatar,
  poseVisitorAvatar,
  disposeVisitorAvatar,
  armJoints,
} from "../src/VisitorAvatar.js";
import { thirdPersonCamera, interactionCamera } from "../src/visitorCamera.js";

// Only name-label painting needs a canvas; the full 3D rig runs in Node.
globalThis.document = {
  createElement() {
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          createRadialGradient() {
            return { addColorStop() {} };
          },
          fillRect() {},
          beginPath() {},
          roundRect() {},
          fill() {},
          stroke() {},
          fillText() {},
          measureText(text) {
            return { width: text.length * 25 };
          },
        };
      },
    };
  },
};
const person = (id, x = 0, z = 22) => ({
  id,
  name: id,
  color: VISITOR_OUTFITS[0].color,
  hair: "short",
  x,
  z,
  rotation: 0,
});

test("appearance is restricted to supported clothes and hair; gestures expire per participant", () => {
  assert.deepEqual(visitorAppearance({ color: "bad", hair: "bad" }), {
    color: VISITOR_OUTFITS[0].color,
    hair: "short",
  });
  assert.equal(
    visitorAppearance({ color: VISITOR_OUTFITS[2].color, hair: "long" }).hair,
    "long",
  );
  for (const type of Object.keys(GESTURE_DURATION)) {
    const a = { type, actor: "me", target: "you", started: 100 };
    assert.ok(activeVisitorGesture(a, "me", 101));
    assert.ok(activeVisitorGesture(a, "you", 101));
    assert.equal(activeVisitorGesture(a, "other", 101), false);
    assert.equal(
      activeVisitorGesture(a, "me", 100 + GESTURE_DURATION[type]),
      false,
    );
  }
});

test("local and guest rigs have names, faces, articulated limbs and clean up their resources", () => {
  const local = createVisitorAvatar(person("me"), true),
    guest = createVisitorAvatar({ ...person("you"), hair: "long" });
  assert.equal(local.userData.local, true);
  assert.equal(guest.userData.local, false);
  assert.equal(local.userData.rig.arms.length, 2);
  assert.equal(local.userData.rig.legs.length, 2);
  assert.ok(local.userData.rig.head.children.length >= 5);
  assert.ok(
    guest.userData.rig.head.children.length >
      local.userData.rig.head.children.length,
  );
  poseVisitorAvatar(local, { walking: true, phase: 1 });
  const step = local.userData.rig.legs.map((leg) => leg.shoe.position.z);
  assert.notEqual(step[0], step[1]);
  poseVisitorAvatar(local, {});
  assert.equal(
    local.userData.rig.legs[0].shoe.position.z,
    local.userData.rig.legs[1].shoe.position.z,
  );
  let disposed = false;
  local.userData.rig.tag.material.map.addEventListener(
    "dispose",
    () => (disposed = true),
  );
  const scene = new THREE.Scene();
  scene.add(local, guest);
  disposeVisitorAvatar(local);
  disposeVisitorAvatar(guest);
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, true);
});

test("holding hands brings the two inside hands together in world space", () => {
  const a = createVisitorAvatar(person("me"), true),
    b = createVisitorAvatar(person("you", 0.67));
  a.position.set(0, 0, 22);
  b.position.set(0.67, 0, 22);
  const target = new THREE.Vector3(0.335, 0.96, 21.985);
  for (const model of [a, b]) {
    model.updateMatrixWorld(true);
    poseVisitorAvatar(model, {
      gesture: "hands",
      handTarget: model.worldToLocal(target.clone()),
    });
    model.updateMatrixWorld(true);
  }
  const left = a.userData.rig.arms
    .find((arm) => arm.side === 1)
    .hand.getWorldPosition(new THREE.Vector3());
  const right = b.userData.rig.arms
    .find((arm) => arm.side === -1)
    .hand.getWorldPosition(new THREE.Vector3());
  assert.ok(left.distanceTo(right) < 0.001);
  disposeVisitorAvatar(a);
  disposeVisitorAvatar(b);
});

test("only the proposer kneels and opens a ring box; kiss and reset work for both people", () => {
  const a = createVisitorAvatar(person("me"), true),
    b = createVisitorAvatar(person("you"));
  poseVisitorAvatar(a, { gesture: "propose", actor: true });
  poseVisitorAvatar(b, { gesture: "propose", actor: false });
  assert.ok(a.userData.rig.box.visible);
  assert.equal(b.userData.rig.box.visible, false);
  assert.ok(
    a.userData.rig.head.position.y < b.userData.rig.head.position.y - 0.4,
  );
  assert.ok(
    a.userData.rig.legs[1].upper.position.y <
      a.userData.rig.legs[0].upper.position.y,
  );
  for (const model of [a, b]) {
    poseVisitorAvatar(model, { gesture: "kiss" });
    assert.ok(model.userData.rig.head.position.z < 0);
    assert.ok(!model.userData.rig.box.visible);
    poseVisitorAvatar(model, {});
    assert.equal(model.userData.rig.head.position.z, 0);
    assert.equal(model.userData.rig.head.position.y, 1.66);
    disposeVisitorAvatar(model);
  }
  const joints = armJoints(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(30, 30, 30),
  );
  assert.ok(Number.isFinite(joints.elbow.x));
  assert.ok(joints.end.distanceTo(new THREE.Vector3(0, 1, 0)) <= 0.601);
});

test("third-person camera keeps the local body in view and pulls inside walls and screen obstacles", () => {
  const initial = thirdPersonCamera(new THREE.Vector3(0, 0, 22), 0, 0.1, 32);
  assert.ok(initial.position.z > 25);
  assert.ok(initial.position.y > 2.5);
  const nearWall = thirdPersonCamera(
    new THREE.Vector3(8, 0, 22),
    Math.PI / 2,
    0.1,
    32,
  );
  assert.ok(nearWall.position.x < 8.5);
  const nearScreen = thirdPersonCamera(
    new THREE.Vector3(-2.6, 0, 5),
    0,
    0.1,
    32,
  );
  assert.ok(nearScreen.position.z < 6.25);
  for (const type of ["hands", "kiss", "propose"]) {
    const result = interactionCamera(
      { type, actor: "me", target: "you" },
      [person("me"), person("you", 0.67)],
      32,
    );
    const camera = new THREE.PerspectiveCamera(65, 390 / 844, 0.1, 140);
    camera.position.copy(result.position);
    camera.lookAt(result.target);
    camera.updateMatrixWorld();
    for (const x of [0, 0.67])
      for (const y of [0.08, 1.9]) {
        const screen = new THREE.Vector3(x, y, 22).project(camera);
        assert.ok(Math.abs(screen.x) < 0.96);
        assert.ok(Math.abs(screen.y) < 0.96);
      }
  }
  assert.equal(
    interactionCamera({ actor: "gone", target: "you" }, [person("you")], 32),
    null,
  );
});
