/** Tests for the photo retouch (ADR-0025) on synthetic images: no Vision, so they run on Linux CI. */
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { carMismatches, compose, encode, inPlate, pickInstance, plateBoxes, type Box } from "../retouch-image.ts";

const W = 100, H = 60;
/** A mask with a filled rectangle (inclusive bounds). */
const rect = (b: Box) => {
  const m = new Uint8Array(W * H);
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) m[y * W + x] = 255;
  return m;
};
/** A noisy RGB photo, so a copied pixel can only match by being copied. */
const photo = () => Buffer.from(Array.from({ length: W * H * 3 }, (_, i) => (i * 37) % 251));
const CAR: Box = { x0: 20, y0: 10, x1: 79, y1: 49 };

test("pickInstance elige la instancia grande y centrada y falla si no hay o si toca un borde", () => {
  const small = rect({ x0: 2, y0: 2, x1: 10, y1: 8 });
  assert.equal(pickInstance([small, rect(CAR)], W, H).index, 1);
  assert.deepEqual(pickInstance([rect(CAR)], W, H).box, CAR);
  assert.throws(() => pickInstance([new Uint8Array(W * H)], W, H), /no foreground instance/);
  assert.throws(() => pickInstance([rect({ ...CAR, x1: W - 1 })], W, H), /touches an edge/);
});

test("plateBoxes solo tapa texto con cifras en la mitad inferior del coche", () => {
  const mask = rect(CAR);
  const plate = { text: "S RN 227E", x: 40, y: 40, w: 20, h: 4 };
  const boxes = plateBoxes([plate, { text: "smart", x: 40, y: 40, w: 20, h: 4 }, { ...plate, y: 12 }, { ...plate, x: 2 }], mask, W, H, CAR);
  assert.deepEqual(boxes, [{ x0: 40, y0: 40, x1: 60, y1: 44 }], "the text box, not padded");
  const quad = [[40, 40], [60, 42], [60, 46], [40, 44]];
  const [tilted] = plateBoxes([{ ...plate, quad }], mask, W, H, CAR);
  assert.deepEqual(tilted, { x0: 40, y0: 40, x1: 60, y1: 46, quad }, "the tilted outline when Vision gives it");
  assert.ok(inPlate(tilted, 50, 43) && !inPlate(tilted, 41, 45) && !inPlate(tilted, 59, 40), "inside the quad only");
});

test("plateBoxes descarta un emblema diminuto y un texto más alto que ancho (#1242)", () => {
  // Text boxes recorded from Apple Vision on the originals of #1235 (1280 px wide).
  const box = (w: number, h: number, car: Box) => {
    const m = new Uint8Array(w * h);
    for (let y = car.y0; y <= car.y1; y++) m.fill(255, y * w + car.x0, y * w + car.x1 + 1);
    return m;
  };
  const ducato: Box = { x0: 30, y0: 56, x1: 1241, y1: 749 };
  const badge = { text: "4XEWO", x: 741.7, y: 454.6, w: 44.7, h: 10.3 };
  assert.deepEqual(plateBoxes([badge], box(1280, 781, ducato), 1280, 781, ducato), [], "e-Ducato: a fender badge");
  const fiat500: Box = { x0: 48, y0: 85, x1: 1231, y1: 824 };
  const texts = [
    { text: "77422", x: 722.9, y: 649.1, w: 41.9, h: 51.3 },
    { text: "BRUNOLD", x: 934.9, y: 566.3, w: 201.9, h: 60.6 },
    { text: "ww.BRUNOLD.DE", x: 1002.6, y: 614.6, w: 84.5, h: 23 },
  ];
  assert.deepEqual(plateBoxes(texts, box(1280, 852, fiat500), 1280, 852, fiat500), [],
    "500e: no plate, so edits says so and the dealer sign is left for the agent to judge");
  // A real plate in the same photo would still be found.
  const plate = { text: "S RN 227E", x: 930, y: 570, w: 200, h: 55 };
  assert.equal(plateBoxes([plate], box(1280, 852, fiat500), 1280, 852, fiat500).length, 1);
});

test("compose copia el coche tal cual, tapa la matrícula y deja el fondo transparente", () => {
  const rgb = photo(), mask = rect(CAR), plates = [{ x0: 40, y0: 40, x1: 59, y1: 44 }];
  const out = compose(rgb, mask, W, H, CAR, plates);
  assert.deepEqual(carMismatches(out, rgb, mask, W, plates), { checked: 60 * 40 - 20 * 5, mismatched: 0 });
  const at = (x: number, y: number) => [...out.data.subarray(((y - out.top) * out.width + x - out.left) * 4, ((y - out.top) * out.width + x - out.left) * 4 + 4)];
  assert.equal(at(CAR.x0 - 1, CAR.y0)[3], 0, "outside the car and the shadow: transparent");
  // Blurred: the plate pixels change and their spread shrinks, so the characters cannot be read.
  const spread = (v: (x: number, y: number) => number) => {
    const vs: number[] = [];
    for (let y = 40; y <= 44; y++) for (let x = 40; x <= 59; x++) vs.push(v(x, y));
    return Math.max(...vs) - Math.min(...vs);
  };
  assert.notDeepEqual(at(50, 42).slice(0, 3), [...rgb.subarray((42 * W + 50) * 3, (42 * W + 50) * 3 + 3)]);
  assert.ok(spread((x, y) => at(x, y)[0]) < spread((x, y) => rgb[(y * W + x) * 3]) / 2);
  assert.ok(at(50, CAR.y1 + 1)[3] > 0, "a shadow under the car");
  out.data[((15 - out.top) * out.width + 30 - out.left) * 4] ^= 1; // one car pixel changed
  assert.equal(carMismatches(out, rgb, mask, W, plates).mismatched, 1);
});

test("el desenfoque de una matrícula inclinada no sale de su contorno ni lee fuera de él", () => {
  const rgb = photo(), mask = rect(CAR);
  const plates = plateBoxes([{ text: "S RN 227E", x: 40, y: 40, w: 20, h: 4, quad: [[40, 40], [60, 42], [60, 46], [40, 44]] }], mask, W, H, CAR);
  const out = compose(rgb, mask, W, H, CAR, plates);
  // Every pixel of the car outside the quad, including the corners of its box, is the original.
  assert.equal(carMismatches(out, rgb, mask, W, plates).mismatched, 0);
  assert.ok(!inPlate(plates[0], 59, 40));
  // A white pixel just outside the quad does not leak into the blur.
  rgb.fill(255, (40 * W + 59) * 3, (40 * W + 59) * 3 + 3);
  const again = compose(rgb, mask, W, H, CAR, plates);
  const i = ((43 - again.top) * again.width + 55 - again.left) * 4;
  assert.deepEqual([...again.data.subarray(i, i + 3)], [...out.data.subarray(i, i + 3)]);
});

test("encode no pasa de 1280 px de ancho", async () => {
  const out = { data: Buffer.alloc(1400 * 10 * 4, 200), width: 1400, height: 10, left: 0, top: 0 };
  const { png, width } = await encode(out);
  assert.equal(width, 1280);
  assert.equal((await sharp(png).metadata()).channels, 4);
});
