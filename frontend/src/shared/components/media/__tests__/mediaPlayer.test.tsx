import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeClock } from '@/test/mediaElement';
import { MediaPlayer } from '../MediaPlayer';
import type { MediaPlayerHandle } from '../MediaPlayer';

afterEach(cleanup);

const VIDEO = 'https://cdn.example.com/p/clip.mp4';

function load(props: Partial<React.ComponentProps<typeof MediaPlayer>> = {}, duration = 3) {
  const ref = createRef<MediaPlayerHandle>();
  render(<MediaPlayer ref={ref} label="SH0010_V001" src={VIDEO} startFrame={1001} fps={24} {...props} />);
  const video = screen.getByLabelText('SH0010_V001 video') as HTMLVideoElement;
  fakeClock(video, duration);
  act(() => {
    fireEvent.loadedMetadata(video);
  });
  return { video, ref };
}
const frame = () => screen.getByLabelText('Current frame').textContent;
const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(screen.getByRole('group', { name: 'SH0010_V001' }), { key, ...init });

describe('media player', () => {
  it('cannot be driven until the video has told its length, then starts on its first frame', () => {
    render(<MediaPlayer label="SH0010_V001" src={VIDEO} startFrame={1001} fps={24} />);
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Scrub') as HTMLInputElement).disabled).toBe(true);
    cleanup();

    load();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(false);
    expect(frame()).toBe('1001');
    expect(screen.getByText('1001–1072')).toBeTruthy(); // 3 s at 24 fps
    expect(screen.getByLabelText('Timecode').textContent).toBe('00:00:00:00');
  });

  it('steps one frame and ten frames, aiming at the middle of the frame, and stops at both ends', () => {
    const { video } = load();
    fireEvent.click(screen.getByRole('button', { name: 'Forward 1 frame' }));
    expect(frame()).toBe('1002');
    expect(video.currentTime).toBeCloseTo(1.5 / 24);
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 frames' }));
    expect(frame()).toBe('1012');
    fireEvent.click(screen.getByRole('button', { name: 'Back 1 frame' }));
    expect(frame()).toBe('1011');
    fireEvent.click(screen.getByRole('button', { name: 'Jump to first frame' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back 10 frames' }));
    expect(frame()).toBe('1001'); // not below the first frame
    fireEvent.click(screen.getByRole('button', { name: 'Jump to last frame' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 frames' }));
    expect(frame()).toBe('1072'); // not past the last
    expect(screen.getByLabelText('Timecode').textContent).toBe('00:00:02:23');
  });

  it('stepping pauses a playing video first', async () => {
    const { video } = load();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Forward 1 frame' }));
    expect(video.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('is driven from the keyboard while it has focus, and leaves the keys alone while a field has them', () => {
    const { video } = load();
    press('ArrowRight');
    expect(frame()).toBe('1002');
    press('ArrowRight', { shiftKey: true });
    expect(frame()).toBe('1012');
    press('ArrowLeft');
    expect(frame()).toBe('1011');
    press('End');
    expect(frame()).toBe('1072');
    press('Home');
    expect(frame()).toBe('1001');
    press(' ');
    expect(video.play).toHaveBeenCalledTimes(1);
    press('l');
    expect(video.loop).toBe(true);
    press('m');
    expect(video.muted).toBe(true);

    const speed = screen.getByLabelText('Speed');
    const event = createEvent.keyDown(speed, { key: 'ArrowRight', bubbles: true });
    fireEvent(speed, event);
    expect(event.defaultPrevented).toBe(false);
    expect(frame()).toBe('1001'); // a key typed into the speed menu does not step the video
  });

  it('plays and pauses, follows the picture while playing, and says so on the button', async () => {
    const { video } = load();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(video.play).toHaveBeenCalled();
    await screen.findByRole('button', { name: 'Pause' });
    video.currentTime = 1.0; // one second in, as the browser would have moved it
    await vi.waitFor(() => expect(frame()).toBe('1025'));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('where the browser reports each presented frame, follows that while playing, and settles on a frame boundary when paused', async () => {
    const { video } = load();
    let report: VideoFrameRequestCallback | undefined;
    const cancelled: number[] = [];
    (video as unknown as { requestVideoFrameCallback: (cb: VideoFrameRequestCallback) => number }).requestVideoFrameCallback = vi.fn((cb: VideoFrameRequestCallback) => {
      report = cb;
      return 7;
    });
    (video as unknown as { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback = (id: number) => void cancelled.push(id);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await screen.findByRole('button', { name: 'Pause' });
    video.currentTime = 1.0; // the clock says index 24...
    act(() => report?.(0, { mediaTime: 26 / 24 } as VideoFrameCallbackMetadata)); // ...but the picture painted is index 26
    expect(frame()).toBe('1027');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await screen.findByRole('button', { name: 'Play' });
    expect(cancelled).toContain(7);
    // paused: the counter and the picture are put on the same frame, the clock's, by seeking to the middle of it
    expect(frame()).toBe('1025');
    expect(video.currentTime).toBeCloseTo(24.5 / 24);
  });

  it('pausing at the very end leaves it there instead of seeking back', async () => {
    const { video } = load();
    fireEvent.click(screen.getByRole('button', { name: 'Jump to last frame' }));
    video.currentTime = 3;
    Object.defineProperty(video, 'ended', { configurable: true, get: () => true });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await screen.findByRole('button', { name: 'Pause' });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await screen.findByRole('button', { name: 'Play' });
    expect(video.currentTime).toBe(3);
  });

  it('seeks from the scrub bar, from a marker, and from the handle, and tells its owner the frame', () => {
    const seen: number[] = [];
    const { ref, video } = load({
      onFrameChange: (f) => seen.push(f),
      markers: [
        { frame: 1030, label: 'edge matte', tone: 'comment' },
        { frame: 1050, label: 'grain', tone: 'annotation' },
        { frame: 5000, label: 'beyond the clip' },
      ],
    });
    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '1020' } });
    expect(frame()).toBe('1020');
    expect(video.currentTime).toBeCloseTo(19.5 / 24);
    fireEvent.click(screen.getByRole('button', { name: 'Go to frame 1030: edge matte' }));
    expect(frame()).toBe('1030');
    expect(screen.queryByRole('button', { name: /beyond the clip/ })).toBeNull(); // a marker outside the clip is not drawn
    act(() => ref.current?.seekToFrame(1060));
    expect(frame()).toBe('1060');
    expect(ref.current?.getFrame()).toBe(1060);
    act(() => ref.current?.seekToFrame(9999));
    expect(frame()).toBe('1072');
    expect(seen).toEqual(expect.arrayContaining([1001, 1020, 1030, 1060, 1072]));
  });

  it('loops, changes speed and mutes through its own controls', () => {
    const { video } = load();
    fireEvent.click(screen.getByRole('button', { name: 'Loop' }));
    expect(video.loop).toBe(true);
    expect(screen.getByRole('button', { name: 'Loop' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '0.5' } });
    expect(video.playbackRate).toBe(0.5);
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(video.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeTruthy();
  });

  it('takes the length from the video, not from a frame range that is longer than it', () => {
    load({ startFrame: 1001 }, 2); // a 96-frame version with a 48-frame preview
    expect(screen.getByText('1001–1048')).toBeTruthy();
  });

  it('says so when the video cannot be loaded', () => {
    const { video } = load();
    act(() => {
      fireEvent.error(video);
    });
    expect(screen.getByText('This video could not be loaded.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a still image with no transport, and a message when there is nothing to show', () => {
    render(<MediaPlayer label="Plate" src="https://cdn.example.com/p/plate.jpg" />);
    expect(screen.getByRole('img', { name: 'Plate' })).toBeTruthy();
    expect(screen.queryByLabelText('Scrub')).toBeNull();
    expect(screen.getByText(/A still image/)).toBeTruthy();
    cleanup();

    render(<MediaPlayer label="Plate" poster="https://cdn.example.com/p/plate.jpg" src="" />);
    expect(screen.getByRole('img', { name: 'Plate' })).toBeTruthy(); // the poster stands in for a missing video
    cleanup();

    render(<MediaPlayer label="Plate" />);
    expect(screen.getByText('No preview is linked yet.')).toBeTruthy();
  });

  it('refuses an address that is not a web address', () => {
    for (const src of ['javascript:alert(1)', 'data:video/mp4;base64,AAAA', 'file:///etc/passwd']) {
      render(<MediaPlayer label="X" src={src} />);
      expect(document.querySelector('video')).toBeNull();
      expect(screen.getByText('No preview is linked yet.')).toBeTruthy();
      cleanup();
    }
  });
});
