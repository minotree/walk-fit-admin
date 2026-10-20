export type Rect = [number, number, number, number];
export type Point = [number, number];
export type RegionAction = 'draw' | 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const MIN_REGION_SIZE = .005;

export function changeRegion(initial: Rect, origin: Point, point: Point, action: RegionAction): Rect {
  if (action === 'draw') return [Math.min(origin[0], point[0]), Math.min(origin[1], point[1]),
    Math.max(origin[0], point[0]), Math.max(origin[1], point[1])];
  const [left, top, right, bottom] = initial;
  const dx = point[0] - origin[0], dy = point[1] - origin[1];
  if (action === 'move') {
    const x = clamp(dx, -left, 1 - right), y = clamp(dy, -top, 1 - bottom);
    return [left + x, top + y, right + x, bottom + y];
  }
  return [action.includes('w') ? clamp(left + dx, 0, right - MIN_REGION_SIZE) : left,
    action.includes('n') ? clamp(top + dy, 0, bottom - MIN_REGION_SIZE) : top,
    action.includes('e') ? clamp(right + dx, left + MIN_REGION_SIZE, 1) : right,
    action.includes('s') ? clamp(bottom + dy, top + MIN_REGION_SIZE, 1) : bottom];
}
