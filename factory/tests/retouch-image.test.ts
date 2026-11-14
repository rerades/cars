/** Tests for the photo retouch (ADR-0025) on synthetic images: no Vision, so they run on Linux CI. */
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { carMismatches, compose, encode, pickInstance, plateBoxes, type Box } from "../retouch-image.ts";

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
  assert.deepEqual(boxes, [{ x0: 39, y0: 39, x1: 61, y1: 45 }]);
});

test("compose copia el coche tal cual, tapa la matrícula y deja el fondo transparente", () => {
  const rgb = photo(), mask = rect(CAR), plates = [{ x0: 40, y0: 40, x1: 59, y1: 44 }];
  const out = compose(rgb, mask, W, H, CAR, plates);
  assert.deepEqual(carMismatches(out, rgb, mask, W, plates), { checked: 60 * 40 - 20 * 5, mismatched: 0 });
  const at = (x: number, y: number) => [...out.data.subarray(((y - out.top) * out.width + x - out.left) * 4, ((y - out.top) * out.width + x - out.left) * 4 + 4)];
  assert.equal(at(CAR.x0 - 1, CAR.y0)[3], 0, "outside the car and the shadow: transparent");
  assert.deepEqual(at(40, 40), at(59, 44), "the plate is one plain color");
  assert.notDeepEqual(at(40, 40).slice(0, 3), [...rgb.subarray((40 * W + 40) * 3, (40 * W + 40) * 3 + 3)]);
  assert.ok(at(50, CAR.y1 + 1)[3] > 0, "a shadow under the car");
  out.data[((15 - out.top) * out.width + 30 - out.left) * 4] ^= 1; // one car pixel changed
  assert.equal(carMismatches(out, rgb, mask, W, plates).mismatched, 1);
});

test("encode no pasa de 1280 px de ancho", async () => {
  const out = { data: Buffer.alloc(1400 * 10 * 4, 200), width: 1400, height: 10, left: 0, top: 0 };
  const { png, width } = await encode(out);
  assert.equal(width, 1280);
  assert.equal((await sharp(png).metadata()).channels, 4);
});
