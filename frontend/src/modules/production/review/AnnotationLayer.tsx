import type React from 'react';
import { useRef, useState } from 'react';
import { isMeaningful, type Point, type Shape, startShape, stretchShape, type Tool } from './annotationModel';

/** The picture is 16:9 and the layer is drawn in a 16:9 space, so a circle stays round and an arrowhead stays square. */
const W = 1000;
const H = 562.5;
const STROKE = 4;

const arrowHead = (s: { x1: number; y1: number; x2: number; y2: number }): string => {
  const [x1, y1, x2, y2] = [s.x1 * W, s.y1 * H, s.x2 * W, s.y2 * H];
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 22;
  const wing = (turn: number) => `${x2 - size * Math.cos(angle + turn)},${y2 - size * Math.sin(angle + turn)}`;
  return `${wing(0.45)} ${x2},${y2} ${wing(-0.45)}`;
};

/** One shape as SVG, in the 1000 by 562.5 space. */
export const ShapeView: React.FC<{ shape: Shape; faint?: boolean }> = ({ shape, faint }) => {
  const common = { stroke: shape.color, strokeWidth: STROKE, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', opacity: faint ? 0.55 : 1, 'data-shape': shape.type } as const;
  switch (shape.type) {
    case 'path':
      return <polyline {...common} points={shape.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')} />;
    case 'rect':
      return <rect {...common} x={shape.x * W} y={shape.y * H} width={shape.w * W} height={shape.h * H} />;
    case 'ellipse':
      return <ellipse {...common} cx={shape.cx * W} cy={shape.cy * H} rx={shape.rx * W} ry={shape.ry * H} />;
    case 'arrow':
      return (
        <g {...{ 'data-shape': 'arrow', opacity: faint ? 0.55 : 1 }}>
          <line x1={shape.x1 * W} y1={shape.y1 * H} x2={shape.x2 * W} y2={shape.y2 * H} stroke={shape.color} strokeWidth={STROKE} strokeLinecap="round" />
          <polyline points={arrowHead(shape)} stroke={shape.color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
  }
};

interface AnnotationLayerProps {
  /** What is already on this frame (from the server): shown, never changed here. */
  existing?: Shape[];
  /** What the reviewer has drawn and not yet saved. */
  draft: Shape[];
  /** With a tool the layer takes the pointer and draws; without one it only shows. */
  tool: Tool | null;
  color: string;
  onDraft: (shapes: Shape[]) => void;
}

/** A transparent layer over the picture: shows the drawings on the frame and, with a tool chosen, takes brush strokes, rectangles, ellipses and arrows. */
export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({ existing = [], draft, tool, color, onDraft }) => {
  const svg = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<{ shape: Shape; from: Point } | null>(null);

  const at = (e: React.PointerEvent): Point => {
    const box = svg.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return [0, 0];
    return [Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))];
  };

  return (
    <svg
      ref={svg}
      role="img"
      aria-label="Drawing on the frame"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full touch-none ${tool ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onPointerDown={(e) => {
        if (!tool) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const from = at(e);
        setActive({ shape: startShape(tool, color, from), from });
      }}
      onPointerMove={(e) => {
        if (active) setActive({ ...active, shape: stretchShape(active.shape, active.from, at(e)) });
      }}
      onPointerUp={(e) => {
        if (!active) return;
        const finished = stretchShape(active.shape, active.from, at(e));
        setActive(null);
        if (isMeaningful(finished)) onDraft([...draft, finished]);
      }}
      onPointerCancel={() => setActive(null)}
    >
      {existing.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: shapes have no id; they are a fixed list per frame
        <ShapeView key={`e${i}`} shape={s} faint={Boolean(tool)} />
      ))}
      {draft.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: shapes have no id; they are a fixed list
        <ShapeView key={`d${i}`} shape={s} />
      ))}
      {active && <ShapeView shape={active.shape} />}
    </svg>
  );
};
