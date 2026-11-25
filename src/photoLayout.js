// Keep frames, pilasters, and alcoves on one architectural grid.
export const PHOTO_BAYS = Object.freeze({
  firstColumn: -4.4,
  firstCenter: -2.5,
  spacing: 3.8,
  wallX: 8.8,
  centerY: 3.1,
  frameWidth: 2.35,
  frameHeight: 2.65,
});
export function wallBayCenters(depth) {
  const result = [];
  for (let i = 0; ; i++) {
    const z = PHOTO_BAYS.firstCenter + i * PHOTO_BAYS.spacing;
    if (z >= depth - 1) break;
    result.push(z);
  }
  return result;
}
export function photoPlacements(count, depth) {
  const back = [
    { x: 0, z: -5.82, rotation: 0, central: true },
    { x: -5.675, z: -5.82, rotation: 0, central: false },
    { x: 5.675, z: -5.82, rotation: 0, central: false },
  ];
  const bays = wallBayCenters(depth),
    rows = Math.ceil((count - 3) / 2);
  return Array.from({ length: count }, (_, index) => {
    if (index < 3) return { index, ...back[index] };
    const row = Math.floor((index - 3) / 2);
    // Spread a small collection through the hall, but only use whole bay
    // indices. Fractional spacing caused photographs to drift into columns.
    const bayIndex =
      rows <= 1 ? 0 : Math.round((row * (bays.length - 1)) / (rows - 1));
    const left = index % 2 === 1;
    return {
      index,
      x: left ? -PHOTO_BAYS.wallX : PHOTO_BAYS.wallX,
      z: bays[bayIndex],
      rotation: left ? Math.PI / 2 : -Math.PI / 2,
      central: false,
    };
  });
}
export function fitPhotoToMount(
  imageWidth,
  imageHeight,
  mountWidth,
  mountHeight,
) {
  const aspect = Math.max(1, imageWidth) / Math.max(1, imageHeight);
  let width = mountWidth,
    height = width / aspect;
  if (height > mountHeight) {
    height = mountHeight;
    width = height * aspect;
  }
  return { width, height };
}
