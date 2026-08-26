import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  Layers,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Grid,
} from 'lucide-react';
import {
  WorkflowNode,
  WorkflowTransition,
  WorkflowNodeType,
  WorkflowDryRunStep,
} from '@/types/workflow';
import { NodeCard } from './NodeCard';
import { ConnectionEdge } from './ConnectionEdge';
import { Button } from '@/shared/components/Button';

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  transitions: WorkflowTransition[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onTransitionsChange: (transitions: WorkflowTransition[]) => void;
  onSelectNode: (node: WorkflowNode) => void;
  onSelectTransition: (transition: WorkflowTransition) => void;
  isSimulating?: boolean;
  activeSimulationStep?: WorkflowDryRunStep | null;
  activeSimulationIndex?: number;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  transitions,
  onNodesChange,
  onTransitionsChange,
  onSelectNode,
  onSelectTransition,
  isSimulating,
  activeSimulationStep,
  activeSimulationIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 100 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selected state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Connecting state
  const [connectingSource, setConnectingSource] = useState<{
    nodeId: string;
    port: 'out' | 'true' | 'false' | 'default';
  } | null>(null);

  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Handle Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
      setSelectedTransitionId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Track mouse in canvas coords for live edge preview
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      setMousePos({ x: canvasX, y: canvasY });
    }

    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    } else if (draggingNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      onNodesChange(
        nodes.map((n) => (n.id === draggingNodeId ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } } : n))
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Node Interactions
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedTransitionId(null);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) onSelectNode(node);
  };

  const handleNodeDelete = (nodeId: string) => {
    onNodesChange(nodes.filter((n) => n.id !== nodeId));
    onTransitionsChange(
      transitions.filter((t) => t.source_node_id !== nodeId && t.target_node_id !== nodeId)
    );
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleNodeEdit = (node: WorkflowNode) => {
    setSelectedNodeId(node.id);
    onSelectNode(node);
  };

  // Connection Creation
  const handleStartConnection = (
    nodeId: string,
    port: 'out' | 'true' | 'false' | 'default'
  ) => {
    setConnectingSource({ nodeId, port });
  };

  const handleEndConnection = (targetNodeId: string) => {
    if (!connectingSource || connectingSource.nodeId === targetNodeId) {
      setConnectingSource(null);
      return;
    }

    // Check if edge already exists
    const exists = transitions.some(
      (t) =>
        t.source_node_id === connectingSource.nodeId &&
        t.target_node_id === targetNodeId &&
        t.source_port === connectingSource.port
    );

    if (!exists) {
      const newTransition: WorkflowTransition = {
        id: `tr-${Date.now()}`,
        source_node_id: connectingSource.nodeId,
        target_node_id: targetNodeId,
        source_port: connectingSource.port,
        label:
          connectingSource.port === 'true'
            ? 'Approved'
            : connectingSource.port === 'false'
            ? 'Retake'
            : 'Next Step',
        trigger_event: 'status_changed',
      };
      onTransitionsChange([...transitions, newTransition]);
    }

    setConnectingSource(null);
  };

  // Transition interactions
  const handleTransitionSelect = (transitionId: string) => {
    setSelectedTransitionId(transitionId);
    setSelectedNodeId(null);
    const tr = transitions.find((t) => t.id === transitionId);
    if (tr) onSelectTransition(tr);
  };

  const handleTransitionDelete = (transitionId: string) => {
    onTransitionsChange(transitions.filter((t) => t.id !== transitionId));
    if (selectedTransitionId === transitionId) setSelectedTransitionId(null);
  };

  // Auto-Layout Algorithm (Topological Ranking)
  const handleAutoLayout = () => {
    if (nodes.length === 0) return;

    // Calculate in-degree for topological order
    const inDegree: Record<string, number> = {};
    nodes.forEach((n) => (inDegree[n.id] = 0));
    transitions.forEach((t) => {
      if (inDegree[t.target_node_id] !== undefined) {
        inDegree[t.target_node_id] += 1;
      }
    });

    // BFS ranking
    const levels: Record<string, number> = {};
    const queue: string[] = [];

    nodes.forEach((n) => {
      if (inDegree[n.id] === 0 || n.type === 'start') {
        levels[n.id] = 0;
        queue.push(n.id);
      }
    });

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentLevel = levels[currentId] || 0;

      const outgoing = transitions.filter((t) => t.source_node_id === currentId);
      outgoing.forEach((edge) => {
        const nextId = edge.target_node_id;
        const nextLevel = Math.max(levels[nextId] || 0, currentLevel + 1);
        levels[nextId] = nextLevel;
        if (!queue.includes(nextId)) queue.push(nextId);
      });
    }

    // Group nodes by level
    const levelGroups: Record<number, WorkflowNode[]> = {};
    nodes.forEach((n) => {
      const lvl = levels[n.id] ?? 0;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(n);
    });

    const HORIZONTAL_SPACING = 340;
    const VERTICAL_SPACING = 200;
    const START_X = 60;
    const START_Y = 120;

    const newNodes = nodes.map((node) => {
      const lvl = levels[node.id] ?? 0;
      const group = levelGroups[lvl] || [node];
      const indexInGroup = group.findIndex((n) => n.id === node.id);

      return {
        ...node,
        position: {
          x: START_X + lvl * HORIZONTAL_SPACING,
          y: START_Y + indexInGroup * VERTICAL_SPACING,
        },
      };
    });

    onNodesChange(newNodes);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 60, y: 100 });
  };

  // Find connecting line coords
  let connectingLine = null;
  if (connectingSource) {
    const srcNode = nodes.find((n) => n.id === connectingSource.nodeId);
    if (srcNode) {
      const startX = srcNode.position.x + 288;
      const startY =
        connectingSource.port === 'true'
          ? srcNode.position.y + 46
          : connectingSource.port === 'false'
          ? srcNode.position.y + 92
          : srcNode.position.y + 70;

      connectingLine = (
        <line
          x1={startX}
          y1={startY}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke="#818cf8"
          strokeWidth="2"
          strokeDasharray="4,4"
          className="animate-pulse"
        />
      );
    }
  }

  // Node dragging initiation
  const handleNodeMouseDown = (e: React.MouseEvent, node: WorkflowNode) => {
    e.stopPropagation();
    handleNodeSelect(node.id);
    setDraggingNodeId(node.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = (e.clientX - rect.left - pan.x) / zoom;
    const clickY = (e.clientY - rect.top - pan.y) / zoom;
    setDragOffset({
      x: clickX - node.position.x,
      y: clickY - node.position.y,
    });
  };

  return (
    <div className="relative flex-1 h-full bg-slate-950 overflow-hidden select-none">
      {/* Canvas Top Bar Controls */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-lg">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[11px] font-mono text-slate-400 px-1 min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <div className="h-4 w-px bg-slate-800" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetView}
          title="Reset View to Origin"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAutoLayout}
          title="Auto-Arrange Nodes into DAG Layout"
          className="gap-1 text-indigo-300 hover:text-white"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Auto Layout
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid Background"
          className={showGrid ? 'text-indigo-400' : 'text-slate-500'}
        >
          <Grid className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Connecting In-Progress Banner */}
      {connectingSource && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-indigo-950/90 border border-indigo-500/50 text-indigo-200 px-4 py-2 rounded-full text-xs font-mono shadow-xl flex items-center gap-2 backdrop-blur-md animate-bounce">
          <Layers className="w-4 h-4 text-indigo-400" />
          Click target node input port to create transition connection (or click canvas to cancel)
        </div>
      )}

      {/* Main Draggable / Pannable Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
        style={{
          backgroundColor: '#020617',
          backgroundImage: showGrid
            ? 'radial-gradient(circle, #334155 1px, transparent 1px)'
            : 'none',
          backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Transform Container */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* SVG Layer for Transitions & Edges */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible z-10">
            <defs>
              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
              </marker>
              <marker
                id="arrow-true"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
              </marker>
              <marker
                id="arrow-false"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
              </marker>
            </defs>

            {/* Connecting line preview */}
            {connectingLine}

            {/* Render all transition edges */}
            {transitions.map((tr) => {
              const src = nodes.find((n) => n.id === tr.source_node_id);
              const tgt = nodes.find((n) => n.id === tr.target_node_id);
              if (!src || !tgt) return null;

              return (
                <ConnectionEdge
                  key={tr.id}
                  transition={tr}
                  sourceNode={src}
                  targetNode={tgt}
                  isSelected={selectedTransitionId === tr.id}
                  isSimulating={isSimulating}
                  onSelect={handleTransitionSelect}
                  onDelete={handleTransitionDelete}
                />
              );
            })}
          </svg>

          {/* HTML Node Cards Layer */}
          <div className="absolute inset-0 pointer-events-auto z-20">
            {nodes.map((node, index) => {
              const isSimNode = isSimulating && activeSimulationStep?.node_id === node.id;
              const hasExecutedInSim =
                isSimulating && activeSimulationIndex !== undefined && index <= activeSimulationIndex;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                >
                  <NodeCard
                    node={node}
                    isSelected={selectedNodeId === node.id}
                    isSimulating={isSimNode}
                    simulationStatus={isSimNode ? 'executed' : hasExecutedInSim ? 'executed' : undefined}
                    onSelect={handleNodeSelect}
                    onDelete={handleNodeDelete}
                    onEdit={handleNodeEdit}
                    onStartConnection={handleStartConnection}
                    onEndConnection={handleEndConnection}
                    isConnecting={!!connectingSource}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mini-map Overlay (Bottom-Right) */}
      <div className="absolute bottom-4 right-4 z-30 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl backdrop-blur-md shadow-2xl w-48 h-32 hidden sm:block">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
          <span>DAG MINIMAP</span>
          <span>{nodes.length} NODES</span>
        </div>
        <div className="w-full h-20 bg-slate-950 rounded-lg relative overflow-hidden border border-slate-800/80">
          {nodes.map((n) => (
            <div
              key={n.id}
              style={{
                left: `${Math.min(100, Math.max(0, (n.position.x / 3000) * 100))}%`,
                top: `${Math.min(100, Math.max(0, (n.position.y / 1500) * 100))}%`,
              }}
              className="absolute w-2.5 h-1.5 rounded-sm bg-indigo-500/80"
            />
          ))}
          {/* Viewport box */}
          <div
            style={{
              left: `${Math.min(100, Math.max(0, (-pan.x / 3000) * 100))}%`,
              top: `${Math.min(100, Math.max(0, (-pan.y / 1500) * 100))}%`,
              width: `${Math.min(100, 30 / zoom)}%`,
              height: `${Math.min(100, 40 / zoom)}%`,
            }}
            className="absolute border border-indigo-400 bg-indigo-500/20 rounded pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
};
