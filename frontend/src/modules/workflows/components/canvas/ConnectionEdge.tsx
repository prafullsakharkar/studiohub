import React from 'react';
import { WorkflowTransition, WorkflowNode } from '@/types/workflow';
import { Trash2 } from 'lucide-react';

interface ConnectionEdgeProps {
  transition: WorkflowTransition;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  isSelected: boolean;
  isSimulating?: boolean;
  onSelect: (transitionId: string) => void;
  onDelete: (transitionId: string) => void;
}

export const ConnectionEdge: React.FC<ConnectionEdgeProps> = ({
  transition,
  sourceNode,
  targetNode,
  isSelected,
  isSimulating,
  onSelect,
  onDelete,
}) => {
  const NODE_WIDTH = 288; // w-72 = 18rem = 288px
  const NODE_HEIGHT = 140; // approx height

  // Calculate Port positions
  let startX = sourceNode.position.x + NODE_WIDTH;
  let startY = sourceNode.position.y + NODE_HEIGHT / 2;

  if (sourceNode.type === 'condition') {
    if (transition.source_port === 'true') {
      startY = sourceNode.position.y + NODE_HEIGHT / 3;
    } else if (transition.source_port === 'false') {
      startY = sourceNode.position.y + (NODE_HEIGHT * 2) / 3;
    }
  }

  const endX = targetNode.position.x;
  const endY = targetNode.position.y + NODE_HEIGHT / 2;

  // Bezier curve control points
  const deltaX = Math.max(Math.abs(endX - startX) * 0.5, 50);
  const cp1X = startX + deltaX;
  const cp1Y = startY;
  const cp2X = endX - deltaX;
  const cp2Y = endY;

  const pathString = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

  // Midpoint for label
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const isConditionTrue = transition.source_port === 'true';
  const isConditionFalse = transition.source_port === 'false';

  let strokeColor = '#6366f1'; // indigo-500
  if (isConditionTrue) strokeColor = '#10b981'; // emerald-500
  if (isConditionFalse) strokeColor = '#f43f5e'; // rose-500
  if (isSelected) strokeColor = '#38bdf8'; // sky-400

  return (
    <g className="cursor-pointer group" onClick={() => onSelect(transition.id)}>
      {/* Invisible wider hit-area path for easy clicking */}
      <path
        d={pathString}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        className="pointer-events-auto"
      />

      {/* Main SVG Curve */}
      <path
        d={pathString}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray={isSimulating ? '6,6' : undefined}
        className={`transition-colors duration-200 ${isSimulating ? 'animate-[dash_1s_linear_infinite]' : ''}`}
        markerEnd={`url(#arrow-${transition.source_port || 'default'})`}
      />

      {/* Edge Label Badge */}
      <foreignObject
        x={midX - 75}
        y={midY - 14}
        width={150}
        height={32}
        className="overflow-visible pointer-events-auto"
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(transition.id);
          }}
          className={`px-2 py-1 rounded-full border text-[10px] font-mono flex items-center justify-between gap-1 backdrop-blur-md shadow-md transition-all ${
            isSelected
              ? 'bg-sky-950 border-sky-400 text-sky-200 ring-2 ring-sky-400/50'
              : isConditionTrue
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
              : isConditionFalse
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-300'
              : 'bg-slate-900/90 border-slate-700 text-slate-300 group-hover:border-slate-500'
          }`}
        >
          <span className="truncate max-w-[110px] font-medium">
            {transition.label ||
              (isConditionTrue
                ? 'True (Approved)'
                : isConditionFalse
                ? 'False (Retake)'
                : transition.trigger_event || 'Transition')}
          </span>
          <button
            type="button"
            title="Delete Transition"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(transition.id);
            }}
            className="opacity-0 group-hover:opacity-100 hover:text-rose-400 text-slate-400 p-0.5 rounded transition-opacity"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </foreignObject>
    </g>
  );
};
