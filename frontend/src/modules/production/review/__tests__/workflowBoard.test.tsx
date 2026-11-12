import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSample } from '@/test/samples';
import { WorkflowBoard } from '../workflowBoard/WorkflowBoard';
import { addNode, connect, moveNode, nextNodeId, readGraph, removeNode, writeGraph } from '../workflowBoard/workflowGraph';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const captured = flow.workflows_detail.body as { nodes: Array<Record<string, unknown>>; transitions: Array<Record<string, unknown>> };

// The board's own shape, as the seeded studio workflows store it.
const boardNodes = [
  { id: 'a', type: 'start', title: 'Assigned', position: { x: 60, y: 120 } },
  { id: 'b', type: 'condition', title: 'Approved?', position: { x: 400, y: 120 } },
  { id: 'c', type: 'end', title: 'Done', position: { x: 740, y: 120 } },
  { id: 'd', type: 'task', title: 'Retake', position: { x: 740, y: 320 } },
];
const boardEdges = [
  { id: 'e1', source_node_id: 'a', target_node_id: 'b', source_port: 'out', label: '' },
  { id: 'e2', source_node_id: 'b', target_node_id: 'c', source_port: 'true', label: 'Yes' },
  { id: 'e3', source_node_id: 'b', target_node_id: 'd', source_port: 'false', label: 'No' },
];

afterEach(cleanup);

describe('workflow graph', () => {
  it('reads the captured shape (label, from, to) and lays the nodes out in columns', () => {
    const graph = readGraph(captured.nodes, captured.transitions);
    expect(graph.nodes.map((n) => n.title)).toEqual(captured.nodes.map((n) => String(n.label)));
    expect(graph.edges).toHaveLength(captured.transitions.length);
    const [first, second] = graph.nodes;
    expect(second.x).toBeGreaterThan(first.x); // the next step is a column to the right
  });

  it('reads the board shape as stored, and drops an edge whose node is missing', () => {
    const graph = readGraph(boardNodes, [...boardEdges, { id: 'x', source_node_id: 'a', target_node_id: 'gone' }]);
    expect(graph.nodes.find((n) => n.id === 'b')).toMatchObject({ x: 400, y: 120, type: 'condition' });
    expect(graph.edges.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(graph.edges.find((e) => e.id === 'e3')?.port).toBe('false');
  });

  it('ignores a duplicate node id instead of drawing two nodes on one key', () => {
    expect(readGraph([{ id: 'a', title: 'One' }, { id: 'a', title: 'Two' }], []).nodes.map((n) => n.title)).toEqual(['One']);
  });

  it('writes both spellings of an edge and keeps keys it does not own', () => {
    const graph = readGraph([{ id: 'a', type: 'start', title: 'A', config: { primary_dcc: 'Nuke' } }, { id: 'b', type: 'end', title: 'B' }], [{ id: 't', from: 'a', to: 'b', trigger_event: 'approved' }]);
    const out = writeGraph(graph);
    expect(out.nodes[0]).toMatchObject({ id: 'a', label: 'A', title: 'A', config: { primary_dcc: 'Nuke' }, position: { x: expect.any(Number), y: expect.any(Number) } });
    expect(out.transitions[0]).toMatchObject({ id: 't', from: 'a', to: 'b', source_node_id: 'a', target_node_id: 'b', source_port: 'out', trigger_event: 'approved' });
    // a second round trip changes nothing
    expect(writeGraph(readGraph(out.nodes, out.transitions))).toEqual(out);
  });

  it('connect refuses a self loop and a repeat; removeNode takes its edges; ids never repeat', () => {
    let graph = readGraph(boardNodes, boardEdges);
    expect(connect(graph, 'a', 'out', 'a')).toBe(graph);
    expect(connect(graph, 'a', 'out', 'b')).toBe(graph);
    graph = connect(graph, 'd', 'out', 'b');
    expect(graph.edges).toHaveLength(4);
    graph = removeNode(graph, 'b');
    expect(graph.edges).toHaveLength(0);
    graph = addNode(graph, 'task', { x: 0, y: 0 });
    expect(nextNodeId(graph, 'task')).toBe('task-2');
    expect(moveNode(graph, 'a', -50, -50).nodes.find((n) => n.id === 'a')).toMatchObject({ x: 0, y: 0 });
  });
});

describe('workflow board', () => {
  it('shows every node and a transition per edge, without editing controls when there is no way to save', () => {
    render(<WorkflowBoard nodes={boardNodes} transitions={boardEdges} />);
    for (const title of ['Assigned', 'Approved?', 'Done', 'Retake']) expect(screen.getByRole('group', { name: `Node ${title}` })).toBeTruthy();
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Edit board' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Add node' })).toBeNull();
  });

  it('selecting a node shows its details', () => {
    render(<WorkflowBoard nodes={[{ ...boardNodes[1], description: 'Supervisor verdict.' }]} transitions={[]} />);
    fireEvent.click(screen.getByRole('group', { name: 'Node Approved?' }));
    expect(within(screen.getByRole('complementary', { name: 'Selection' })).getByText('Supervisor verdict.')).toBeTruthy();
  });

  it('edit mode adds a node and a connection, and Save sends the written graph; Discard sends nothing', () => {
    const onSave = vi.fn();
    render(<WorkflowBoard nodes={boardNodes} transitions={boardEdges} onSave={onSave} />);
    const save = () => screen.getByRole('button', { name: 'Save board' }) as HTMLButtonElement;

    fireEvent.click(screen.getByRole('button', { name: 'Edit board' }));
    expect(save().disabled).toBe(true); // nothing changed yet

    fireEvent.change(screen.getByRole('combobox', { name: 'Add node' }), { target: { value: 'review' } });
    expect(screen.getByRole('group', { name: 'Node Review session' })).toBeTruthy();
    expect(save().disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Connect from Retake (out)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect to Review session' }));
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(4);

    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledTimes(1);
    const sent = onSave.mock.calls[0][0];
    expect(sent.nodes).toHaveLength(5);
    expect(sent.nodes.at(-1)).toMatchObject({ id: 'review-1', type: 'review', title: 'Review session' });
    expect(sent.transitions.at(-1)).toMatchObject({ from: 'd', to: 'review-1', source_node_id: 'd', target_node_id: 'review-1', source_port: 'out' });

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Node Review session' })).toBeNull();
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(3);
  });

  it('a condition node has a true and a false port; an end node has none; a start node takes no incoming connection', () => {
    render(<WorkflowBoard nodes={boardNodes} transitions={boardEdges} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit board' }));
    expect(screen.getByRole('button', { name: 'Connect from Approved? (true)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect from Approved? (false)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Connect from Done/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect to Assigned' })).toBeNull();
  });

  it('deleting a node in edit mode also removes its transitions', () => {
    render(<WorkflowBoard nodes={boardNodes} transitions={boardEdges} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit board' }));
    fireEvent.click(screen.getByRole('group', { name: 'Node Approved?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete node' }));
    expect(screen.queryByRole('group', { name: 'Node Approved?' })).toBeNull();
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(0);
  });
});
