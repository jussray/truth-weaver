import { describe, expect, it } from "vitest";

import { suggestPageBounds } from "./auto-crop";

function scene(width: number, height: number, rect?: { x1: number; y1: number; x2: number; y2: number }): ImageData {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const paper = rect && x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2;
      pixels[i] = paper ? 240 : 30;
      pixels[i + 1] = paper ? 240 : 30;
      pixels[i + 2] = paper ? 235 : 30;
      pixels[i + 3] = 255;
    }
  }
  return { data: pixels, width, height } as ImageData;
}

describe("optional offline page bounds", () => {
  it("suggests a conservative crop of bright paper on a dark background", () => {
    const crop = suggestPageBounds(scene(200, 200, { x1: 20, x2: 180, y1: 25, y2: 175 }));
    expect(crop).not.toBeNull();
    expect(crop!.left).toBeGreaterThan(0);
    expect(crop!.top).toBeGreaterThan(0);
    expect(crop!.right).toBeGreaterThan(0);
    expect(crop!.bottom).toBeGreaterThan(0);
  });

  it("fails closed if it cannot reliably infer page boundaries", () => {
    expect(suggestPageBounds(scene(200, 200))).toBeNull();
    expect(suggestPageBounds(scene(40, 40))).toBeNull();
  });
});
