import { CheckCircle2, CheckSquare, GitBranch, Maximize, Play, PlaySquare, Send, ShieldCheck, UploadCloud, ZoomIn, ZoomOut, Zap } from 'lucide-react';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/components/Button';
import {
  addNode,
  type BoardEdge,
  type BoardGraph,
  type BoardNode,
  connect,
  moveNode,
  NODE_HEIGHT,
  NODE_TYPES,
  NODE_WIDTH,
  type NodeType,
  type Port,
  readGraph,
  removeEdge,
  removeNode,
  updateNode,
  writeGraph,
} from './workflowGraph';

interface TypeStyle {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

const TYPE_STYLE: Record<NodeType, TypeStyle> = {
  start: { label: 'Start', icon: Play, tone: 'text-emerald-400 border-emerald-500/40' },
  task: { label: 'Task', icon: CheckSquare, tone: 'text-indigo-400 border-indigo-500/40' },
  approval: { label: 'Approval', icon: ShieldCheck, tone: 'text-amber-400 border-amber-500/40' },
  review: { label: 'Review', icon: PlaySquare, tone: 'text-purple-400 border-purple-500/40' },
  publish: { label: 'Publish', icon: UploadCloud, tone: 'text-cyan-400 border-cyan-500/40' },
  delivery: { label: 'Delivery', icon: Send, tone: 'text-teal-400 border-teal-500/40' },
  condition: { label: 'Condition', icon: GitBranch, tone: 'text-yellow-400 border-yellow-500/40' },
  automation: { label: 'Automation', icon: Zap, tone: 'text-fuchsia-400 border-fuchsia-500/40' },
  end: { label: 'End', icon: CheckCircle2, tone: 'text-slate-400 border-slate-600' },
};
const styleOf = (type: string): TypeStyle => TYPE_STYLE[type as NodeType] ?? { label: type || 'Node', icon: CheckSquare, tone: 'text-slate-300 border-slate-600' };

const PORT_STROKE: Record<Port, string> = { out: '#64748b', true: '#34d399', false: '#fb7185' };
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;

/** Where an edge leaves its source: the right edge, a condition's true and false ports a third and two thirds down. */
const portY = (node: BoardNode, port: Port) => node.y + (node.type === 'condition' ? (port === 'true' ? NODE_HEIGHT / 3 : port === 'false' ? (NODE_HEIGHT * 2) / 3 : NODE_HEIGHT / 2) : NODE_HEIGHT / 2);

const curve = (from: BoardNode, port: Port, to: BoardNode) => {
  const x1 = from.x + NODE_WIDTH;
  const y1 = portY(from, port);
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const pull = Math.max(60, Math.abs(x2 - x1) / 2);
  return { d: `M ${x1} ${y1} C ${x1 + pull} ${y1}, ${x2 - pull} ${y2}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
};

interface WorkflowBoardProps {
  nodes: Array<Record<string, unknown>>;
  transitions: Array<Record<string, unknown>>;
  /** With a way to save, the board edits; without, it only shows. */
  onSave?: (graph: { nodes: Array<Record<string, unknown>>; transitions: Array<Record<string, unknown>> }) => void;
  saving?: boolean;
}

/** The workflow's graph as a chart: nodes in columns, curved transitions, pan and zoom. Edits are kept until Save. */
export const WorkflowBoard: React.FC<WorkflowBoardProps> = ({ nodes, transitions, onSave, saving = false }) => {
  const stored = useMemo(() => readGraph(nodes, transitions), [nodes, transitions]);
  const [edited, setEdited] = useState<BoardGraph | null>(null);
  const [editing, setEditing] = useState(false);
  const graph = edited ?? stored;
  const dirty = edited !== null;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null);
  const [connecting, setConnecting] = useState<{ source: string; port: Port } | null>(null);
  const drag = useRef<{ kind: 'pan' | 'node'; id?: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const width = Math.max(900, ...graph.nodes.map((node) => node.x + NODE_WIDTH + 120));
  const height = Math.max(420, ...graph.nodes.map((node) => node.y + NODE_HEIGHT + 120));
  const change = (next: BoardGraph) => setEdited(next);
  const selectedNode = selected?.kind === 'node' ? byId.get(selected.id) : undefined;
  const selectedEdge: BoardEdge | undefined = selected?.kind === 'edge' ? graph.edges.find((edge) => edge.id === selected.id) : undefined;

  const onPointerDown = (event: React.PointerEvent, kind: 'pan' | 'node', id?: string) => {
    if (kind === 'node' && !editing) return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const node = id ? byId.get(id) : undefined;
    drag.current = { kind, id, startX: event.clientX, startY: event.clientY, originX: node ? node.x : pan.x, originY: node ? node.y : pan.y };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (d.kind === 'pan') setPan({ x: d.originX + dx, y: d.originY + dy });
    else if (d.id) change(moveNode(graph, d.id, d.originX + dx / zoom, d.originY + dy / zoom));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const zoomBy = (factor: number) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z * factor).toFixed(2)))));
  const fit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const finishConnect = (target: string) => {
    if (!connecting) return;
    change(connect(graph, connecting.source, connecting.port, target));
    setConnecting(null);
  };

  const cancel = () => {
    setEdited(null);
    setEditing(false);
    setConnecting(null);
    setSelected(null);
  };

  return (
    <section aria-label="Workflow board" className="space-y-2">
      <div role="toolbar" aria-label="Board controls" className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" aria-label="Reset view" onClick={fit}>
          <Maximize className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[11px] text-slate-500">{Math.round(zoom * 100)}%</span>
        {onSave && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit board
          </Button>
        )}
        {onSave && editing && (
          <>
            <select
              aria-label="Add node"
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              value=""
              onChange={(event) => {
                const type = event.target.value as NodeType;
                if (!type) return;
                const lowest = Math.max(0, ...graph.nodes.map((node) => node.y));
                change(addNode(graph, type, { x: 60, y: lowest + 200 }));
              }}
            >
              <option value="">Add node…</option>
              {NODE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {styleOf(type).label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!dirty || saving}
              onClick={() => {
                onSave(writeGraph(graph));
              }}
            >
              {saving ? 'Saving…' : 'Save board'}
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={cancel}>
              {dirty ? 'Discard' : 'Done'}
            </Button>
            {connecting && <span className="text-[11px] text-amber-300">Pick the node to connect to, or press its port again to cancel.</span>}
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div
          data-testid="workflow-board-viewport"
          className="relative h-[520px] flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 touch-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgb(51 65 85 / 0.5) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          onPointerDown={(event) => {
            setSelected(null);
            onPointerDown(event, 'pan');
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {graph.nodes.length === 0 ? (
            <p className="p-6 text-xs text-slate-500">No nodes yet.{onSave ? ' Choose Edit board, then add one.' : ''}</p>
          ) : (
            <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <svg aria-hidden="false" role="img" aria-label="Transitions" width={width} height={height} className="absolute left-0 top-0 overflow-visible">
                <defs>
                  {(Object.keys(PORT_STROKE) as Port[]).map((port) => (
                    <marker key={port} id={`board-arrow-${port}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={PORT_STROKE[port]} />
                    </marker>
                  ))}
                </defs>
                {graph.edges.map((edge) => {
                  const from = byId.get(edge.source);
                  const to = byId.get(edge.target);
                  if (!from || !to) return null;
                  const { d, mx, my } = curve(from, edge.port, to);
                  const on = selected?.kind === 'edge' && selected.id === edge.id;
                  return (
                    <g key={edge.id} data-edge={edge.id}>
                      <path d={d} fill="none" stroke={PORT_STROKE[edge.port]} strokeWidth={on ? 3 : 1.75} markerEnd={`url(#board-arrow-${edge.port})`} />
                      {/* a wide invisible stroke makes the thin line easy to hit */}
                      <path
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        style={{ cursor: 'pointer' }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setSelected({ kind: 'edge', id: edge.id })}
                      />
                      {edge.label && (
                        <text x={mx} y={my - 6} textAnchor="middle" className="fill-slate-300" fontSize={11} style={{ pointerEvents: 'none' }}>
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {graph.nodes.map((node) => {
                const style = styleOf(node.type);
                const Icon = style.icon;
                const on = selected?.kind === 'node' && selected.id === node.id;
                return (
                  <div
                    key={node.id}
                    role="group"
                    aria-label={`Node ${node.title}`}
                    data-node={node.id}
                    className={`absolute rounded-lg border bg-slate-900 shadow-lg ${style.tone} ${on ? 'ring-2 ring-indigo-400' : ''}`}
                    style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                    tabIndex={0}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setSelected({ kind: 'node', id: node.id })}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        setSelected({ kind: 'node', id: node.id });
                      }
                    }}
                  >
                    <div
                      className={`flex items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${editing ? 'cursor-grab' : ''}`}
                      onPointerDown={(event) => onPointerDown(event, 'node', node.id)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {style.label}
                    </div>
                    <div className="space-y-1 px-3 py-2">
                      <h4 className="text-sm font-bold leading-snug text-white">{node.title}</h4>
                      {node.description && <p className="line-clamp-2 text-[11px] text-slate-400">{node.description}</p>}
                      {node.department && <span className="inline-block rounded border border-slate-800 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-300">{node.department}</span>}
                    </div>
                    {editing && node.type !== 'start' && (
                      <button
                        type="button"
                        aria-label={`Connect to ${node.title}`}
                        disabled={!connecting}
                        onClick={(event) => {
                          event.stopPropagation();
                          finishConnect(node.id);
                        }}
                        className={`absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 ${connecting ? 'border-amber-300 bg-amber-400' : 'border-slate-600 bg-slate-800'}`}
                      />
                    )}
                    {editing && node.type !== 'end' &&
                      (node.type === 'condition' ? (['true', 'false'] as Port[]) : (['out'] as Port[])).map((port) => (
                        <button
                          key={port}
                          type="button"
                          aria-label={`Connect from ${node.title} (${port})`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setConnecting(connecting?.source === node.id && connecting.port === port ? null : { source: node.id, port });
                          }}
                          className="absolute -right-2 h-4 w-4 rounded-full border-2"
                          style={{
                            top: node.type === 'condition' ? (port === 'true' ? NODE_HEIGHT / 3 - 8 : (NODE_HEIGHT * 2) / 3 - 8) : NODE_HEIGHT / 2 - 8,
                            borderColor: PORT_STROKE[port],
                            background: connecting?.source === node.id && connecting.port === port ? PORT_STROKE[port] : '#0f172a',
                          }}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {(selectedNode || selectedEdge) && (
          <aside aria-label="Selection" className="w-full lg:w-64 shrink-0 space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
            {selectedNode && (
              <>
                <h3 className="font-semibold text-slate-100">{selectedNode.title}</h3>
                <p className="font-mono text-[10px] text-slate-500">
                  {selectedNode.id} · {styleOf(selectedNode.type).label}
                </p>
                {editing ? (
                  <>
                    <label className="block space-y-1">
                      <span>Title</span>
                      <input className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" value={selectedNode.title} onChange={(event) => change(updateNode(graph, selectedNode.id, { title: event.target.value }))} />
                    </label>
                    <label className="block space-y-1">
                      <span>Description</span>
                      <textarea className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" rows={3} value={selectedNode.description} onChange={(event) => change(updateNode(graph, selectedNode.id, { description: event.target.value }))} />
                    </label>
                    <label className="block space-y-1">
                      <span>Department</span>
                      <input className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" value={selectedNode.department} onChange={(event) => change(updateNode(graph, selectedNode.id, { department: event.target.value }))} />
                    </label>
                    <label className="block space-y-1">
                      <span>Type</span>
                      <select className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" value={selectedNode.type} onChange={(event) => change(updateNode(graph, selectedNode.id, { type: event.target.value }))}>
                        {NODE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {styleOf(type).label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        change(removeNode(graph, selectedNode.id));
                        setSelected(null);
                      }}
                    >
                      Delete node
                    </Button>
                  </>
                ) : (
                  <>
                    {selectedNode.description && <p>{selectedNode.description}</p>}
                    {selectedNode.department && <p>Department: {selectedNode.department}</p>}
                  </>
                )}
              </>
            )}
            {selectedEdge && (
              <>
                <h3 className="font-semibold text-slate-100">Transition</h3>
                <p>
                  {byId.get(selectedEdge.source)?.title} → {byId.get(selectedEdge.target)?.title}
                  {selectedEdge.port !== 'out' ? ` (${selectedEdge.port})` : ''}
                </p>
                {selectedEdge.label && <p className="text-slate-400">{selectedEdge.label}</p>}
                {editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      change(removeEdge(graph, selectedEdge.id));
                      setSelected(null);
                    }}
                  >
                    Delete transition
                  </Button>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </section>
  );
};
