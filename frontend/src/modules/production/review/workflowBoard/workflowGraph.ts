/**
 * The graph a workflow stores, read for the chart board and written back.
 *
 * The backend keeps `nodes` and `transitions` as free JSON and evaluates none of it, so the shape is the
 * frontend's own. Two shapes exist in stored data: the captured one (`label`, `from`, `to`) and the chart
 * board's (`title`, `position`, `source_node_id`, `target_node_id`, `source_port`). `readGraph` accepts both.
 * `writeGraph` keeps every key it does not own, and sets both spellings of an edge's ends so the list view
 * and the board agree.
 */
export type NodeType = 'start' | 'task' | 'approval' | 'review' | 'publish' | 'delivery' | 'condition' | 'automation' | 'end';
export type Port = 'out' | 'true' | 'false';

export const NODE_TYPES: NodeType[] = ['start', 'task', 'approval', 'review', 'publish', 'delivery', 'condition', 'automation', 'end'];

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 112;
const SPACING_X = 340;
const SPACING_Y = 200;
const ORIGIN_X = 60;
const ORIGIN_Y = 80;

export interface BoardNode {
  id: string;
  type: NodeType | string;
  title: string;
  description: string;
  department: string;
  x: number;
  y: number;
  /** The stored record, kept so keys the board does not edit survive a save. */
  raw: Record<string, unknown>;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  port: Port;
  label: string;
  raw: Record<string, unknown>;
}

export interface BoardGraph {
  nodes: BoardNode[];
  edges: BoardEdge[];
}

const str = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const first = (...values: unknown[]): string => values.map(str).find((value) => value !== '') ?? '';

const portOf = (value: unknown): Port => (value === 'true' || value === 'false' ? value : 'out');

const readPosition = (raw: Record<string, unknown>): { x: number; y: number } | null => {
  const position = raw.position;
  if (position && typeof position === 'object') {
    const { x, y } = position as Record<string, unknown>;
    if (num(x) !== null && num(y) !== null) return { x: num(x) as number, y: num(y) as number };
  }
  const x = num(raw.position_x);
  const y = num(raw.position_y);
  return x !== null && y !== null ? { x, y } : null;
};

/** Column by depth from the start nodes, rows within a column in stored order. Cycles stop at the first revisit. */
const autoLayout = (ids: string[], edges: Array<{ source: string; target: string }>, startIds: string[]): Map<string, { x: number; y: number }> => {
  const depth = new Map<string, number>();
  const queue = (startIds.length ? startIds : ids.slice(0, 1)).map((id) => ({ id, d: 0 }));
  while (queue.length) {
    const { id, d } = queue.shift() as { id: string; d: number };
    if (depth.has(id)) continue;
    depth.set(id, d);
    for (const edge of edges) if (edge.source === id && !depth.has(edge.target)) queue.push({ id: edge.target, d: d + 1 });
  }
  const widest = Math.max(-1, ...depth.values());
  ids.forEach((id) => {
    if (!depth.has(id)) depth.set(id, widest + 1);
  });
  const rows = new Map<number, number>();
  const out = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const column = depth.get(id) as number;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    out.set(id, { x: ORIGIN_X + column * SPACING_X, y: ORIGIN_Y + row * SPACING_Y });
  }
  return out;
};

export function readGraph(nodes: Array<Record<string, unknown>> | undefined, transitions: Array<Record<string, unknown>> | undefined): BoardGraph {
  const rawNodes = (nodes ?? []).filter((node): node is Record<string, unknown> => Boolean(node) && typeof node === 'object');
  const seen = new Set<string>();
  const readNodes = rawNodes
    .map((raw, index) => ({ raw, id: str(raw.id) || `node-${index + 1}` }))
    .filter(({ id }) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  const edges: BoardEdge[] = (transitions ?? [])
    .filter((raw): raw is Record<string, unknown> => Boolean(raw) && typeof raw === 'object')
    .map((raw, index) => ({
      id: str(raw.id) || `edge-${index + 1}`,
      source: first(raw.source_node_id, raw.from_node_id, raw.from),
      target: first(raw.target_node_id, raw.to_node_id, raw.to),
      port: portOf(raw.source_port),
      label: str(raw.label),
      raw,
    }))
    // An edge to a node that is not there cannot be drawn; it stays in the stored data until a save drops it.
    .filter((edge) => seen.has(edge.source) && seen.has(edge.target));

  const missing = readNodes.filter(({ raw }) => !readPosition(raw));
  const layout = missing.length
    ? autoLayout(
        readNodes.map(({ id }) => id),
        edges,
        readNodes.filter(({ raw }) => raw.type === 'start').map(({ id }) => id),
      )
    : new Map<string, { x: number; y: number }>();

  return {
    nodes: readNodes.map(({ raw, id }) => {
      const at = readPosition(raw) ?? layout.get(id) ?? { x: ORIGIN_X, y: ORIGIN_Y };
      return {
        id,
        type: str(raw.type) || 'task',
        title: first(raw.title, raw.label, raw.name, id),
        description: str(raw.description),
        department: str(raw.department),
        x: at.x,
        y: at.y,
        raw,
      };
    }),
    edges,
  };
}

export function writeGraph(graph: BoardGraph): { nodes: Array<Record<string, unknown>>; transitions: Array<Record<string, unknown>> } {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node.raw,
      id: node.id,
      type: node.type,
      title: node.title,
      // `label` is what the captured shape and the list view read; keep it in step with the title.
      label: node.title,
      description: node.description,
      department: node.department,
      position: { x: Math.round(node.x), y: Math.round(node.y) },
    })),
    transitions: graph.edges.map((edge) => ({
      ...edge.raw,
      id: edge.id,
      from: edge.source,
      to: edge.target,
      source_node_id: edge.source,
      target_node_id: edge.target,
      source_port: edge.port,
      label: edge.label,
    })),
  };
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node';

/** An id not used by any node, derived from the type: `task-2`, `task-3`, ... */
export function nextNodeId(graph: BoardGraph, type: string): string {
  const used = new Set(graph.nodes.map((node) => node.id));
  for (let n = 1; ; n += 1) {
    const id = `${slug(type)}-${n}`;
    if (!used.has(id)) return id;
  }
}

export function nextEdgeId(graph: BoardGraph): string {
  const used = new Set(graph.edges.map((edge) => edge.id));
  for (let n = 1; ; n += 1) {
    const id = `edge-${n}`;
    if (!used.has(id)) return id;
  }
}

export const DEFAULT_TITLES: Record<NodeType, string> = {
  start: 'Start',
  task: 'Task step',
  approval: 'Approval gate',
  review: 'Review session',
  publish: 'Publish',
  delivery: 'Client delivery',
  condition: 'Decision',
  automation: 'Automation',
  end: 'End',
};

export function addNode(graph: BoardGraph, type: NodeType, at: { x: number; y: number }): BoardGraph {
  const id = nextNodeId(graph, type);
  const node: BoardNode = { id, type, title: DEFAULT_TITLES[type], description: '', department: '', x: at.x, y: at.y, raw: {} };
  return { ...graph, nodes: [...graph.nodes, node] };
}

export function removeNode(graph: BoardGraph, id: string): BoardGraph {
  return { nodes: graph.nodes.filter((node) => node.id !== id), edges: graph.edges.filter((edge) => edge.source !== id && edge.target !== id) };
}

/** Connect two nodes from a port; the same source, port and target is not added twice and a node does not connect to itself. */
export function connect(graph: BoardGraph, source: string, port: Port, target: string): BoardGraph {
  if (source === target) return graph;
  if (graph.edges.some((edge) => edge.source === source && edge.port === port && edge.target === target)) return graph;
  const label = port === 'true' ? 'Yes' : port === 'false' ? 'No' : '';
  return { ...graph, edges: [...graph.edges, { id: nextEdgeId(graph), source, target, port, label, raw: {} }] };
}

export function moveNode(graph: BoardGraph, id: string, x: number, y: number): BoardGraph {
  return { ...graph, nodes: graph.nodes.map((node) => (node.id === id ? { ...node, x: Math.max(0, x), y: Math.max(0, y) } : node)) };
}

export function updateNode(graph: BoardGraph, id: string, patch: Partial<Pick<BoardNode, 'title' | 'description' | 'department' | 'type'>>): BoardGraph {
  return { ...graph, nodes: graph.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)) };
}

export function removeEdge(graph: BoardGraph, id: string): BoardGraph {
  return { ...graph, edges: graph.edges.filter((edge) => edge.id !== id) };
}
