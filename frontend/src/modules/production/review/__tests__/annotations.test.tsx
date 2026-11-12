import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { fakeClock } from '@/test/mediaElement';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { AnnotationLayer } from '../AnnotationLayer';
import { COLORS, isMeaningful, MAX_POINTS, MAX_SHAPES, parseDrawing, type Shape, startShape, stretchShape, thin, toDrawing } from '../annotationModel';
import { ReviewViewer } from '../ReviewViewer';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;
const red = COLORS[0].value;

describe('drawing model', () => {
  it('stretches a rectangle from the corner it was pressed at, whichever way it is dragged, and keeps it inside the picture', () => {
    const start = startShape('rect', red, [0.5, 0.5]);
    expect(stretchShape(start, [0.5, 0.5], [0.7, 0.9])).toMatchObject({ x: 0.5, y: 0.5, w: expect.closeTo(0.2), h: expect.closeTo(0.4) });
    expect(stretchShape(start, [0.5, 0.5], [0.2, 0.1])).toMatchObject({ x: 0.2, y: 0.1, w: expect.closeTo(0.3), h: expect.closeTo(0.4) }); // up and to the left
    expect(stretchShape(start, [0.5, 0.5], [3, -2])).toMatchObject({ x: 0.5, y: 0, w: 0.5, h: 0.5 }); // past the edges
  });

  it('makes an ellipse of the box dragged, an arrow from the press to the pointer, and a brush that adds points', () => {
    expect(stretchShape(startShape('ellipse', red, [0.2, 0.2]), [0.2, 0.2], [0.6, 0.4])).toMatchObject({ cx: expect.closeTo(0.4), cy: expect.closeTo(0.3), rx: expect.closeTo(0.2), ry: expect.closeTo(0.1) });
    expect(stretchShape(startShape('arrow', red, [0.1, 0.1]), [0.1, 0.1], [0.8, 0.6])).toMatchObject({ x1: 0.1, y1: 0.1, x2: 0.8, y2: 0.6 });
    let brush = startShape('brush', red, [0.1, 0.1]);
    brush = stretchShape(brush, [0.1, 0.1], [0.3, 0.3]);
    brush = stretchShape(brush, [0.1, 0.1], [0.3005, 0.3005]); // a hair's width of movement adds nothing
    brush = stretchShape(brush, [0.1, 0.1], [0.5, 0.2]);
    expect((brush as Extract<Shape, { type: 'path' }>).points).toEqual([[0.1, 0.1], [0.3, 0.3], [0.5, 0.2]]);
  });

  it('does not count a tap or a twitch as a shape', () => {
    expect([startShape('rect', red, [0.5, 0.5]), startShape('ellipse', red, [0.5, 0.5]), startShape('arrow', red, [0.5, 0.5]), startShape('brush', red, [0.5, 0.5])].map(isMeaningful)).toEqual([false, false, false, false]);
    expect(isMeaningful({ type: 'rect', color: red, x: 0.1, y: 0.1, w: 0.2, h: 0.001 })).toBe(false);
    expect(isMeaningful({ type: 'rect', color: red, x: 0.1, y: 0.1, w: 0.2, h: 0.1 })).toBe(true);
  });

  it('stores a drawing as fractions of the picture, rounded, at most 50 shapes and 400 points a stroke', () => {
    const many = Array.from({ length: 60 }, (_, i): Shape => ({ type: 'rect', color: red, x: 0.1, y: 0.1, w: 0.2 + i / 1000, h: 0.2 }));
    expect(toDrawing(many).shapes).toHaveLength(MAX_SHAPES);
    const stroke: Shape = { type: 'path', color: red, points: Array.from({ length: 1000 }, (_, i) => [i / 1000, 0.5] as const) };
    const [kept] = toDrawing([stroke]).shapes as Array<Extract<Shape, { type: 'path' }>>;
    expect(kept.points).toHaveLength(MAX_POINTS);
    expect(kept.points[0]).toEqual([0, 0.5]);
    expect(kept.points.at(-1)).toEqual([0.999, 0.5]); // first and last are kept
    expect(thin([[0, 0], [1, 1]])).toHaveLength(2);
    expect(toDrawing([{ type: 'rect', color: red, x: 0.123456789, y: 0.2, w: 0.3, h: 0.3 }, { type: 'rect', color: red, x: 0.1, y: 0.1, w: 0, h: 0 }]).shapes).toEqual([{ type: 'rect', color: red, x: 0.1235, y: 0.2, w: 0.3, h: 0.3 }]);
    expect(toDrawing([]).version).toBe(1);
  });

  it('reads back what it stored', () => {
    const shapes: Shape[] = [
      { type: 'rect', color: '#22c55e', x: 0.1, y: 0.2, w: 0.3, h: 0.1 },
      { type: 'ellipse', color: '#38bdf8', cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.2 },
      { type: 'arrow', color: '#e879f9', x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.8 },
      { type: 'path', color: red, points: [[0.1, 0.1], [0.2, 0.3], [0.4, 0.2]] },
    ];
    expect(parseDrawing(toDrawing(shapes))).toEqual(shapes);
  });

  it('keeps only what it fully understands from data it did not write', () => {
    for (const bad of [null, undefined, 'x', 7, [], {}, { shapes: 'nope' }, { shapes: null }]) expect(parseDrawing(bad)).toEqual([]);
    const parsed = parseDrawing({
      shapes: [
        { type: 'rect', color: '#22c55e', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
        { type: 'rect', color: red, x: 1.5, y: 0.1, w: 0.2, h: 0.2 }, // outside the picture
        { type: 'rect', color: red, x: -0.1, y: 0.1, w: 0.2, h: 0.2 },
        { type: 'rect', color: red, x: Number.NaN, y: 0.1, w: 0.2, h: 0.2 },
        { type: 'rect', color: red, x: '0.1', y: 0.1, w: 0.2, h: 0.2 }, // a string, not a number
        { type: 'circle', color: red, cx: 0.5, cy: 0.5 }, // not a shape it knows
        { type: 'path', color: red, points: [[0.1, 0.1]] }, // one point is not a stroke
        { type: 'path', color: red, points: [[0.1, 0.1], [9, 9], [0.2, 0.2], 'x', [0.3]] }, // the bad points go, the stroke stays
        null,
        'x',
        { type: 'arrow', color: red, x1: 0.1, y1: 0.1, x2: 0.9 }, // missing a number
      ],
    });
    expect(parsed).toEqual([
      { type: 'rect', color: '#22c55e', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      { type: 'path', color: red, points: [[0.1, 0.1], [0.2, 0.2]] },
    ]);
  });

  it('puts a plain colour on a shape or the default one: a colour is never text that could be anything else', () => {
    const [a, b, c] = parseDrawing({ shapes: [{ type: 'rect', color: 'red', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, { type: 'rect', color: 'url(javascript:alert(1))', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, { type: 'rect', color: '#AABBCC', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }] });
    expect([a.color, b.color, c.color]).toEqual([red, red, '#AABBCC']);
  });

  it('caps what it reads, and shows a stored pin as a small ring', () => {
    const lots = { shapes: Array.from({ length: 80 }, () => ({ type: 'rect', color: red, x: 0.1, y: 0.1, w: 0.2, h: 0.2 })) };
    expect(parseDrawing(lots)).toHaveLength(MAX_SHAPES);
    const [pin] = parseDrawing({ x: 0.4, y: 0.5 }); // the captured annotation's drawing_coordinates
    expect(pin).toMatchObject({ type: 'ellipse', cx: 0.4, cy: 0.5 });
    expect(parseDrawing({ x: 4, y: 0.5 })).toEqual([]);
  });
});

/** jsdom lays nothing out: tell the layer it is 1000 by 562.5 pixels. */
function sized(svg: Element) {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 562.5, right: 1000, bottom: 562.5, x: 0, y: 0, toJSON: () => ({}) });
}
const press = (svg: Element, x: number, y: number) => fireEvent.pointerDown(svg, { clientX: x, clientY: y, pointerId: 1, buttons: 1 });
const drag = (svg: Element, x: number, y: number) => fireEvent.pointerMove(svg, { clientX: x, clientY: y, pointerId: 1, buttons: 1 });
const lift = (svg: Element, x: number, y: number) => fireEvent.pointerUp(svg, { clientX: x, clientY: y, pointerId: 1 });

describe('annotation layer', () => {
  afterEach(cleanup);

  it('with a tool chosen, takes a drag and hands over the finished rectangle as fractions of the picture', () => {
    const onDraft = vi.fn();
    render(<AnnotationLayer draft={[]} tool="rect" color={red} onDraft={onDraft} />);
    const svg = screen.getByRole('img', { name: 'Drawing on the frame' });
    sized(svg);
    press(svg, 100, 56.25);
    drag(svg, 300, 200);
    lift(svg, 500, 281.25);
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(onDraft.mock.calls[0][0]).toEqual([{ type: 'rect', color: red, x: 0.1, y: 0.1, w: expect.closeTo(0.4), h: expect.closeTo(0.4) }]);
  });

  it('shows the rectangle as it is dragged, and adds to what is already drawn', () => {
    const before: Shape[] = [{ type: 'rect', color: '#22c55e', x: 0.1, y: 0.1, w: 0.1, h: 0.1 }];
    const onDraft = vi.fn();
    render(<AnnotationLayer draft={before} tool="ellipse" color={red} onDraft={onDraft} />);
    const svg = screen.getByRole('img', { name: 'Drawing on the frame' });
    sized(svg);
    press(svg, 200, 100);
    drag(svg, 400, 300);
    expect(svg.querySelectorAll('[data-shape="rect"]')).toHaveLength(1);
    expect(svg.querySelectorAll('[data-shape="ellipse"]')).toHaveLength(1); // the one being dragged
    lift(svg, 400, 300);
    expect(onDraft.mock.calls[0][0]).toHaveLength(2);
    expect(onDraft.mock.calls[0][0][0]).toEqual(before[0]);
  });

  it('draws a brush stroke from its moves and an arrow with a head', () => {
    const onDraft = vi.fn();
    const { rerender } = render(<AnnotationLayer draft={[]} tool="brush" color={red} onDraft={onDraft} />);
    const svg = screen.getByRole('img', { name: 'Drawing on the frame' });
    sized(svg);
    press(svg, 100, 100);
    drag(svg, 200, 150);
    drag(svg, 300, 120);
    lift(svg, 400, 200);
    expect(onDraft.mock.calls[0][0][0].points).toHaveLength(4);
    rerender(<AnnotationLayer draft={[{ type: 'arrow', color: red, x1: 0.1, y1: 0.1, x2: 0.8, y2: 0.6 }]} tool={null} color={red} onDraft={onDraft} />);
    const arrow = svg.querySelector('[data-shape="arrow"]') as Element;
    expect(arrow.querySelector('line')).not.toBeNull();
    expect(arrow.querySelector('polyline')).not.toBeNull(); // the head
  });

  it('ignores a tap that makes no shape, and ignores the pointer altogether without a tool', () => {
    const onDraft = vi.fn();
    const { rerender } = render(<AnnotationLayer draft={[]} tool="rect" color={red} onDraft={onDraft} />);
    const svg = screen.getByRole('img', { name: 'Drawing on the frame' });
    sized(svg);
    press(svg, 300, 300);
    lift(svg, 301, 301);
    expect(onDraft).not.toHaveBeenCalled();
    rerender(<AnnotationLayer draft={[]} tool={null} color={red} onDraft={onDraft} />);
    press(svg, 100, 100);
    drag(svg, 400, 400);
    lift(svg, 400, 400);
    expect(onDraft).not.toHaveBeenCalled();
    expect(svg.getAttribute('class')).toContain('pointer-events-none'); // it lets clicks through to the player
  });

  it('shows what is saved, dimmed while drawing', () => {
    const saved: Shape[] = [{ type: 'ellipse', color: red, cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.1 }];
    const { rerender } = render(<AnnotationLayer existing={saved} draft={[]} tool={null} color={red} onDraft={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Drawing on the frame' }).querySelector('[data-shape="ellipse"]')?.getAttribute('opacity')).toBe('1');
    rerender(<AnnotationLayer existing={saved} draft={[]} tool="rect" color={red} onDraft={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Drawing on the frame' }).querySelector('[data-shape="ellipse"]')?.getAttribute('opacity')).toBe('0.55');
  });
});

const review = flow.reviews_start_review.body; // In Review; a comment and an annotation on frame 1040
const closed = flow.reviews_close.body;
const version = { ...flow.versions_detail.body, video_url: 'https://cdn.example.com/p/sh0010.mp4', thumbnail_url: 'https://cdn.example.com/p/sh0010.jpg' };
const path = (c: MockCall) => new URL(c.url).pathname;
const reply = (body: unknown): MockReply => ({ status: 200, body });

function mount(r = review, user: User = admin, serve: (c: MockCall) => MockReply = (c) => (c.method === 'POST' ? { status: 201, body: {} } : reply(version))) {
  const mock = mockFetch(serve);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <ReviewViewer review={r} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return mock;
}
async function ready() {
  const video = (await screen.findByLabelText(/in review video$/)) as HTMLVideoElement;
  fakeClock(video, 3);
  act(() => {
    fireEvent.loadedMetadata(video);
  });
  const layer = screen.getByRole('img', { name: 'Drawing on the frame' });
  sized(layer);
  return { video, layer };
}
const frame = () => screen.getByLabelText('Current frame').textContent;
const toolbar = () => within(screen.getByRole('region', { name: 'Drawing' }));

describe('drawing in the review viewer', () => {
  beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
  afterEach(() => {
    cleanup();
    tokenStorage.clearTokens();
    vi.unstubAllGlobals();
  });

  it('saves a drawing as an annotation on the frame it was drawn on, with its note, timecode and shapes as fractions of the picture', async () => {
    const { calls } = mount();
    const { layer } = await ready();
    fireEvent.click(toolbar().getByRole('button', { name: 'Draw on this frame' }));
    fireEvent.click(toolbar().getByRole('button', { name: 'Rectangle' }));
    fireEvent.click(toolbar().getByRole('button', { name: 'Colour Green' }));
    press(layer, 100, 56.25);
    lift(layer, 500, 281.25);
    expect(layer.querySelectorAll('[data-shape="rect"]')).toHaveLength(1);
    fireEvent.change(toolbar().getByLabelText('Annotation note'), { target: { value: 'Move this prop left' } });
    fireEvent.click(toolbar().getByRole('button', { name: 'Save annotation' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST') as MockCall;
    expect(path(post)).toBe(`/api/v1/reviews/${review.id}/annotations/`);
    expect(post.body).toEqual({
      comment: 'Move this prop left',
      frame_number: 1001,
      timecode: '00:00:00:00',
      drawing_coordinates: { version: 1, shapes: [{ type: 'rect', color: '#22c55e', x: 0.1, y: 0.1, w: 0.4, h: 0.4 }] },
    });
    await waitFor(() => expect(toolbar().getByRole('button', { name: 'Draw on this frame' })).toBeTruthy()); // back to viewing
  });

  it('stays on the frame it was started on: stepping away shows where it is and stops drawing elsewhere, and Save still goes to its frame', async () => {
    const { calls } = mount();
    const { layer } = await ready();
    fireEvent.click(toolbar().getByRole('button', { name: 'Draw on this frame' }));
    fireEvent.click(toolbar().getByRole('button', { name: 'Rectangle' }));
    press(layer, 100, 100);
    lift(layer, 300, 300);
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 frames' }));
    expect(frame()).toBe('1011');
    expect(screen.getByText(/Your drawing is on frame 1001/)).toBeTruthy();
    expect(layer.getAttribute('class')).toContain('pointer-events-none'); // it will not take a stroke on another frame
    expect(layer.querySelectorAll('[data-shape="rect"]')).toHaveLength(0); // and the drawing is not shown on the wrong frame
    fireEvent.click(screen.getByRole('button', { name: 'Go to it' }));
    expect(frame()).toBe('1001');
    expect(layer.querySelectorAll('[data-shape="rect"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 frames' }));
    fireEvent.click(toolbar().getByRole('button', { name: 'Save annotation' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect((calls.find((c) => c.method === 'POST') as MockCall).body).toMatchObject({ frame_number: 1001 });
  });

  it('undoes the last shape, clears the drawing, and only saves when there is something drawn', async () => {
    mount();
    const { layer } = await ready();
    fireEvent.click(toolbar().getByRole('button', { name: 'Draw on this frame' }));
    const save = () => toolbar().getByRole('button', { name: 'Save annotation' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.click(toolbar().getByRole('button', { name: 'Rectangle' }));
    press(layer, 100, 100);
    lift(layer, 300, 300);
    fireEvent.click(toolbar().getByRole('button', { name: 'Arrow' }));
    press(layer, 400, 100);
    lift(layer, 700, 300);
    expect(layer.querySelectorAll('[data-shape]')).toHaveLength(2);
    expect(save().disabled).toBe(false);
    fireEvent.click(toolbar().getByRole('button', { name: 'Undo' }));
    expect(layer.querySelectorAll('[data-shape]')).toHaveLength(1);
    fireEvent.click(toolbar().getByRole('button', { name: 'Clear drawing' }));
    expect(layer.querySelectorAll('[data-shape]')).toHaveLength(0);
    expect(save().disabled).toBe(true);
  });

  it('shows the drawings saved on a frame when it is reached, and not on other frames', async () => {
    const drawn = { ...review, annotations: [{ ...review.annotations[0], frame_number: 1040, comment: 'circle here', drawing_coordinates: { version: 1, shapes: [{ type: 'ellipse', color: '#38bdf8', cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.15 }] } }] };
    mount(drawn);
    const { layer } = await ready();
    expect(layer.querySelectorAll('[data-shape]')).toHaveLength(0); // frame 1001
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Feedback on frames' })).getByRole('button', { name: /^Go to frame 1040: circle here/ }));
    expect(frame()).toBe('1040');
    expect(layer.querySelectorAll('[data-shape="ellipse"]')).toHaveLength(1);
    expect(within(screen.getByRole('complementary', { name: 'Feedback on frames' })).getByText('Annotation · drawing')).toBeTruthy();
  });

  it('shows the captured pin annotation as a ring on its frame', async () => {
    mount(flow.reviews_approve.body); // its annotation is { x: 0.4, y: 0.5 } on frame 1040
    const { layer } = await ready();
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Feedback on frames' })).getAllByRole('button')[0]);
    expect(frame()).toBe('1040');
    expect(layer.querySelectorAll('[data-shape="ellipse"]')).toHaveLength(1);
  });

  it('pauses the video when drawing starts', async () => {
    mount();
    const { video } = await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await screen.findByRole('button', { name: 'Pause' });
    fireEvent.click(toolbar().getByRole('button', { name: 'Draw on this frame' }));
    expect(video.pause).toHaveBeenCalled();
  });

  it('offers no drawing to someone who cannot update reviews, or on a closed review', async () => {
    mount(review, { ...artist, permissions: artist.permissions.filter((p) => p !== 'review.update') } as User);
    await screen.findByLabelText('Scrub');
    expect(screen.queryByRole('region', { name: 'Drawing' })).toBeNull();
    cleanup();
    mount(closed);
    await screen.findByLabelText('Scrub');
    expect(screen.queryByRole('region', { name: 'Drawing' })).toBeNull();
  });
});
