// Сынақ кадрлары: ашылу, орта, финал. (Толық монтаж — түпнұсқа дауыстың уақыт белгілері алынғаннан кейін.)
import * as THREE from 'three';
import {legIK} from './character.js';
import {PATH} from './world.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const TOP = 0.1; // жол тақтасының беті

/** Тік тұру/қадам позасы: жамбас биіктігі, табан нысаналары (жергілікті), қолдар. */
function standPose({hipY = 0.93, lean = 0.04, head = [0, 0, 0], footL = [0.1, 0, 0.04], footR = [-0.1, 0, -0.04], armL, armR, sway = 0} = {}) {
  const hip = v(0, hipY, 0);
  const iL = legIK(hip, v(footL[0], footL[1], footL[2])), iR = legIK(hip, v(footR[0], footR[1], footR[2]));
  return {hipY, spine: [lean, 0, 0], chest: [lean * 0.5, 0, 0], head, legL: {hp: [iL.hp, 0, 0.02], kn: iL.kn, an: [-(iL.hp + iL.kn) * 0.9, 0, 0]}, legR: {hp: [iR.hp, 0, -0.02], kn: iR.kn, an: [-(iR.hp + iR.kn) * 0.9, 0, 0]}, armL, armR, sway};
}
const wristWorld = (ch, s) => { const p = new THREE.Vector3(0, -0.07, 0); ch.arm[s].wr.localToWorld(p); return p; };
function holdBetween(block, ch, yOff = 0) {
  ch.root.updateMatrixWorld(true);
  const a = wristWorld(ch, 'L'), b = wristWorld(ch, 'R');
  block.position.copy(a).add(b).multiplyScalar(0.5); block.position.y += yOff;
  block.quaternion.copy(ch.root.quaternion);
}
function lightsDefault(W, {amber = 0, cool = 0, shaftA = 0, shaftB = 0} = {}) {
  W.amber.intensity = amber; W.coolSpot.intensity = cool;
  W.shaftA.material.uniforms.uInt.value = shaftA; W.shaftB.material.uniforms.uInt.value = shaftB;
}
function aimShaft(shaft, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  shaft.position.copy(from); shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
}

export const TEST_SHOTS = {
  // 00:00–00:08 — екі параллель жол, жарық сол жолға ертерек түседі; оң жолдағы кейіпкер жұмысын тоқтатып, сол жаққа қарайды
  opening(S, t) {
    const {camera, world: W, hero, other, steps, family, heldBlock, heroBlock} = S;
    steps.forEach(b => (b.visible = false)); family.visible = false;
    camera.fov = 36; camera.position.set(0.55, 0.78, 8.6); camera.lookAt(0.0, 1.05, -3.5); camera.updateProjectionMatrix();
    lightsDefault(W, {amber: 520, cool: 60, shaftA: 1.0, shaftB: 0.18});
    W.amber.position.set(-3.0, 17.5, -2.5); W.amber.target.position.set(PATH.ax, 0, 1.2); aimShaft(W.shaftA, W.amber.position, v(PATH.ax, 0, 1.2));
    // басқа кейіпкер: блокты көтеріп келеді
    other.root.position.set(PATH.ax + 0.05, TOP, 1.3); other.root.rotation.y = 0.35;
    other.setPose(standPose({hipY: 0.9, lean: 0.12, footL: [0.11, 0, 0.16], footR: [-0.1, 0.02, -0.2], head: [0.12, 0, 0],
      armL: {sh: [-0.62, 0, 0.32], el: -1.05, wr: [0, 0, -0.2]}, armR: {sh: [-0.62, 0, -0.32], el: -1.05, wr: [0, 0, 0.2]}}));
    holdBetween(heldBlock, other, 0.04);
    // кейіпкер: бір тізерлеп отыр, қолы блокта тоқтап қалған, басы сол жолға бұрылған
    hero.root.position.set(PATH.bx - 0.05, TOP, 2.5); hero.root.rotation.y = -0.55;
    hero.setPose({hipY: 0.56, spine: [0.32, 0.12, 0], chest: [0.12, 0.18, 0], neck: [0.05, -0.35, 0], head: [-0.12, -0.55, 0],
      legL: {hp: [-1.42, 0, 0.08], kn: 1.38, an: [0.05, 0, 0]}, legR: {hp: [0.06, 0, -0.05], kn: 1.62, an: [0.55, 0, 0]},
      armL: {sh: [-0.85, 0, 0.18], el: -0.55}, armR: {sh: [-0.75, 0, -0.12], el: -0.75, grip: 0.4}});
    hero.root.updateMatrixWorld(true);
    const wr = wristWorld(hero, 'R'); heroBlock.position.set(wr.x, TOP + 0.15, wr.z + 0.02); heroBlock.quaternion.copy(hero.root.quaternion); heroBlock.visible = true;
    S.title = ''; S.titleOpacity = 0;
  },
  // 00:25–00:43 — өзгенің артықшылығы: көтерілген сатылар, назар сәулесі, алыстағы жылы отбасы; камера кейіпкердің иығынан
  middle(S, t) {
    const {camera, world: W, hero, other, steps, family, heldBlock, heroBlock} = S;
    steps.forEach(b => (b.visible = true)); family.visible = true; heldBlock.visible = false; heroBlock.visible = false;
    camera.fov = 38; camera.position.set(2.75, 1.72, 4.6); camera.lookAt(-1.25, 1.95, -5.0); camera.updateProjectionMatrix();
    const top = v(PATH.ax, TOP + 6 * 0.36 - 0.1, -3.0 - 5 * 0.7);
    lightsDefault(W, {amber: 650, cool: 25, shaftA: 1.1, shaftB: 0.0});
    W.amber.position.set(-3.6, 18, -9); W.amber.target.position.copy(top); aimShaft(W.shaftA, W.amber.position, top);
    other.root.position.copy(top); other.root.rotation.y = 0.5;
    other.setPose(standPose({hipY: 0.93, lean: -0.03, head: [-0.15, 0.2, 0], armL: {sh: [0.05, 0, 0.12], el: -0.2}, armR: {sh: [0.1, 0, -0.1], el: -0.25}}));
    hero.root.position.set(1.95, TOP, 3.0); hero.root.rotation.y = Math.PI + 0.62;
    hero.setPose(standPose({hipY: 0.93, lean: 0.02, head: [-0.28, 0.08, 0], footL: [0.1, 0, 0.0], footR: [-0.1, 0, -0.08],
      armL: {sh: [0.02, 0, 0.06], el: -0.35, grip: 0.9}, armR: {sh: [0.0, 0, -0.06], el: -0.3, grip: 0.9}}));
    S.title = ''; S.titleOpacity = 0;
  },
  // 01:15–01:30 — финал: әркім өз жолымен; екі жолда да жарық; нақыл
  final(S, t) {
    const {camera, world: W, hero, other, steps, family, heldBlock, heroBlock} = S;
    steps.forEach(b => (b.visible = false)); family.visible = false; heldBlock.visible = false; heroBlock.visible = false;
    camera.fov = 36; camera.position.set(0, 4.8, 12.5); camera.lookAt(0, 0.9, -6); camera.updateProjectionMatrix();
    lightsDefault(W, {amber: 420, cool: 0, shaftA: 0.8, shaftB: 0.75});
    W.amber.position.set(-3.0, 17.5, -3); W.amber.target.position.set(PATH.ax, 0, 0.8); aimShaft(W.shaftA, W.amber.position, v(PATH.ax, 0, 0.8));
    W.coolSpot.color.set('#e9cf9f'); W.coolSpot.intensity = 380; W.coolSpot.position.set(3.2, 17.5, -1.5); W.coolSpot.target.position.set(PATH.bx, 0, 1.6);
    W.shaftB.material.uniforms.uColor.value.set('#e2c792'); aimShaft(W.shaftB, W.coolSpot.position, v(PATH.bx, 0, 1.6));
    const walk = (ch, x, z, ph) => {
      ch.root.position.set(x, TOP, z); ch.root.rotation.y = Math.PI;
      const s = Math.sin(ph);
      ch.setPose(standPose({hipY: 0.91, lean: 0.06, footL: [0.1, 0, 0.26 * s], footR: [-0.1, 0.03 * Math.max(0, s), -0.26 * s],
        armL: {sh: [0.32 * s, 0, 0.08], el: -0.25}, armR: {sh: [-0.32 * s, 0, -0.08], el: -0.25}}));
    };
    walk(other, PATH.ax, 0.6, 0.9); walk(hero, PATH.bx, 1.6, -0.6);
    S.title = 'Жігіттің өзімен тартыссаң да,<br>бағымен тартыспа.'; S.titleOpacity = 1;
  },
};
