/** Conservative, optional page-boundary suggestion. No remote service or model. */
export type PageBounds = { left: number; top: number; right: number; bottom: number };

export function suggestPageBounds(pixels: ImageData): PageBounds | null {
  const { width, height, data } = pixels;
  if (width < 80 || height < 80) return null;
  const backgrounds: Array<[number, number, number]> = [];
  const corners: Array<[number, number]> = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ];
  for (const [x, y] of corners) {
    const index = (y * width + x) * 4;
    backgrounds.push([data[index]!, data[index + 1]!, data[index + 2]!]);
  }
  const background: [number, number, number] = [
    backgrounds.reduce((total, p) => total + p[0], 0) / 4,
    backgrounds.reduce((total, p) => total + p[1], 0) / 4,
    backgrounds.reduce((total, p) => total + p[2], 0) / 4,
  ];
  // Require roughly uniform background corners before suggesting a crop.
  const farthestCorner = backgrounds.reduce((largest, color) =>
    Math.max(largest, Math.hypot(
      color[0] - background[0],
      color[1] - background[1],
      color[2] - background[2],
    )), 0);
  if (farthestCorner > 35) return null;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 200));
  let total = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      total++;
      const i = (y * width + x) * 4;
      const diff = Math.hypot(data[i]! - background[0], data[i + 1]! - background[1], data[i + 2]! - background[2]);
      if (diff < 70) continue;
      count++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const ratio = count / Math.max(1, total);
  if (ratio < 0.2 || ratio > 0.9) return null;
  if ((maxX - minX) < width * 0.55 || (maxY - minY) < height * 0.55) return null;
  const padX = Math.round(width * 0.01);
  const padY = Math.round(height * 0.01);
  const left = Math.max(0, Math.floor((minX - padX) / width * 100));
  const right = Math.max(0, Math.floor((width - 1 - maxX - padX) / width * 100));
  const top = Math.max(0, Math.floor((minY - padY) / height * 100));
  const bottom = Math.max(0, Math.floor((height - 1 - maxY - padY) / height * 100));
  // Conservative limit; user review is required before OCR or PDF generation.
  if (Math.max(left, right, top, bottom) > 25) return null;
  return { left, right, top, bottom };
}

/** Analyze a reduced image locally. Suggestions can be discarded without changing the original. */
export async function detectPageBounds(imageUrl: string): Promise<PageBounds | null> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  const factor = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * factor);
  canvas.height = Math.round(image.naturalHeight * factor);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return suggestPageBounds(context.getImageData(0, 0, canvas.width, canvas.height));
}
