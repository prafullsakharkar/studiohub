/**
 * What a reviewer draws on a frame, and how it is stored. The server keeps `drawing_coordinates` as free JSON, so this
 * shape is the frontend's own: `{ version: 1, shapes: [...] }` with every coordinate a fraction (0 to 1) of the picture,
 * so a drawing lines up at any player size. What comes back from the server is somebody's data: `parseDrawing` keeps
 * only shapes it fully understands, with finite numbers inside the picture and a plain colour.
 */
export type Tool = 'brush' | 'rect' | 'ellipse' | 'arrow';
export const TOOLS: ReadonlyArray<{ id: Tool; label: string }> = [
  { id: 'brush', label: 'Brush' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'arrow', label: 'Arrow' },
];

export const COLORS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#38bdf8', label: 'Blue' },
  { value: '#e879f9', label: 'Pink' },
];

export type Point = readonly [number, number];
export type Shape =
  | { type: 'path'; color: string; points: Point[] }
  | { type: 'rect'; color: string; x: number; y: number; w: number; h: number }
  | { type: 'ellipse'; color: string; cx: number; cy: number; rx: number; ry: number }
  | { type: 'arrow'; color: string; x1: number; y1: number; x2: number; y2: number };

export const MAX_SHAPES = 50;
export const MAX_POINTS = 400;
/** Smaller than this (a tap, a twitch) is not a shape. */
export const MIN_SIZE = 0.008;
/** The ring drawn for a stored pin, as a fraction of the picture's width (its height is scaled to stay round). */
const PIN_RADIUS = 0.012;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const COLOR = /^#[0-9a-f]{6}$/i;

export function startShape(tool: Tool, color: string, at: Point): Shape {
  const [x, y] = at;
  switch (tool) {
    case 'brush':
      return { type: 'path', color, points: [[x, y]] };
    case 'rect':
      return { type: 'rect', color, x, y, w: 0, h: 0 };
    case 'ellipse':
      return { type: 'ellipse', color, cx: x, cy: y, rx: 0, ry: 0 };
    case 'arrow':
      return { type: 'arrow', color, x1: x, y1: y, x2: x, y2: y };
  }
}

/** The shape as it stands with the pointer at `to`, having been pressed at `from`. A brush gains a point; the others stretch from `from`. */
export function stretchShape(shape: Shape, from: Point, to: Point): Shape {
  const [fx, fy] = from;
  const [tx, ty] = [clamp01(to[0]), clamp01(to[1])];
  switch (shape.type) {
    case 'path': {
      const last = shape.points[shape.points.length - 1];
      if (last && Math.hypot(tx - last[0], ty - last[1]) < 0.003) return shape; // a hair's width of movement adds nothing
      return { ...shape, points: [...shape.points, [tx, ty]] };
    }
    case 'rect':
      return { ...shape, x: Math.min(fx, tx), y: Math.min(fy, ty), w: Math.abs(tx - fx), h: Math.abs(ty - fy) };
    case 'ellipse':
      // dragged corner to corner: the ellipse is the one inside that box
      return { ...shape, cx: (fx + tx) / 2, cy: (fy + ty) / 2, rx: Math.abs(tx - fx) / 2, ry: Math.abs(ty - fy) / 2 };
    case 'arrow':
      return { ...shape, x2: tx, y2: ty };
  }
}

export function isMeaningful(shape: Shape): boolean {
  switch (shape.type) {
    case 'path':
      return shape.points.length >= 2;
    case 'rect':
      return shape.w >= MIN_SIZE && shape.h >= MIN_SIZE;
    case 'ellipse':
      return shape.rx >= MIN_SIZE / 2 && shape.ry >= MIN_SIZE / 2;
    case 'arrow':
      return Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) >= MIN_SIZE;
  }
}

/** At most `MAX_POINTS` points, keeping the first and the last and spreading the rest evenly. */
export function thin(points: Point[]): Point[] {
  if (points.length <= MAX_POINTS) return points;
  const kept: Point[] = [];
  for (let i = 0; i < MAX_POINTS; i += 1) kept.push(points[Math.round((i * (points.length - 1)) / (MAX_POINTS - 1))]);
  return kept;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

function normalize(s: Shape): Shape {
  switch (s.type) {
    case 'path':
      return { ...s, points: thin(s.points).map(([x, y]) => [round(x), round(y)] as const) };
    case 'rect':
      return { ...s, x: round(s.x), y: round(s.y), w: round(s.w), h: round(s.h) };
    case 'ellipse':
      return { ...s, cx: round(s.cx), cy: round(s.cy), rx: round(s.rx), ry: round(s.ry) };
    case 'arrow':
      return { ...s, x1: round(s.x1), y1: round(s.y1), x2: round(s.x2), y2: round(s.y2) };
  }
}

export function toDrawing(shapes: Shape[]): { version: 1; shapes: Shape[] } {
  return { version: 1, shapes: shapes.filter(isMeaningful).slice(0, MAX_SHAPES).map(normalize) };
}

const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const colorOf = (v: unknown): string => (typeof v === 'string' && COLOR.test(v) ? v : COLORS[0].value);

/** The shapes in a stored drawing; anything that is not a drawing, or a shape that is malformed, is left out. */
export function parseDrawing(value: unknown): Shape[] {
  if (!value || typeof value !== 'object') return [];
  const raw = (value as { shapes?: unknown }).shapes;
  if (!Array.isArray(raw)) {
    // A bare point, `{ x, y }`, is what older clients stored for an annotation: a pin. It is shown as a small ring.
    const pin = value as { x?: unknown; y?: unknown };
    return unit(pin.x) && unit(pin.y) ? [{ type: 'ellipse', color: COLORS[0].value, cx: pin.x, cy: pin.y, rx: PIN_RADIUS, ry: PIN_RADIUS * (16 / 9) }] : [];
  }
  const shapes: Shape[] = [];
  for (const item of raw.slice(0, MAX_SHAPES)) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const color = colorOf(s.color);
    if (s.type === 'path' && Array.isArray(s.points)) {
      const points = s.points
        .slice(0, MAX_POINTS)
        .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && unit(p[0]) && unit(p[1]))
        .map((p) => [p[0], p[1]] as const);
      if (points.length >= 2) shapes.push({ type: 'path', color, points });
    } else if (s.type === 'rect' && unit(s.x) && unit(s.y) && unit(s.w) && unit(s.h)) {
      shapes.push({ type: 'rect', color, x: s.x, y: s.y, w: s.w, h: s.h });
    } else if (s.type === 'ellipse' && unit(s.cx) && unit(s.cy) && unit(s.rx) && unit(s.ry)) {
      shapes.push({ type: 'ellipse', color, cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry });
    } else if (s.type === 'arrow' && unit(s.x1) && unit(s.y1) && unit(s.x2) && unit(s.y2)) {
      shapes.push({ type: 'arrow', color, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 });
    }
  }
  return shapes;
}
