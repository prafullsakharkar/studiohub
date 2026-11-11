import { describe, expect, it } from 'vitest';
import { clampFrame, frameCount, frameToTime, timeToFrame, timecode, toFps } from '../frameTime';

describe('frame arithmetic', () => {
  it('reads the frame rate the API sends: a decimal string, sometimes empty or zero', () => {
    expect(toFps('24.00')).toBe(24);
    expect(toFps('23.976')).toBeCloseTo(23.976);
    expect([toFps(''), toFps('0'), toFps(null), toFps(undefined), toFps('abc'), toFps(-5)]).toEqual([24, 24, 24, 24, 24, 24]);
  });

  it('counts the frames of a clip, and none for an unknown length', () => {
    expect(frameCount(3, 24)).toBe(72);
    expect(frameCount(4.0, 23.976)).toBe(96);
    expect([frameCount(0, 24), frameCount(Number.NaN, 24), frameCount(Number.POSITIVE_INFINITY, 24)]).toEqual([0, 0, 0]);
  });

  it('seeks to the middle of a frame, so that reading the time back gives the same frame, for every frame of a clip', () => {
    for (const fps of [24, 25, 23.976, 30, 60]) {
      for (const start of [1, 1001]) {
        const count = 96;
        for (let frame = start; frame < start + count; frame += 1) {
          expect(timeToFrame(frameToTime(frame, start, fps), start, fps, count)).toBe(frame);
        }
      }
    }
  });

  it('keeps a time past either end inside the clip', () => {
    expect(timeToFrame(-1, 1001, 24, 72)).toBe(1001);
    expect(timeToFrame(99, 1001, 24, 72)).toBe(1072);
    expect(timeToFrame(5, 1001, 24, 0)).toBe(1001);
  });

  it('clamps a frame to the clip and rounds a fraction', () => {
    expect(clampFrame(990, 1001, 72)).toBe(1001);
    expect(clampFrame(2000, 1001, 72)).toBe(1072);
    expect(clampFrame(1010.4, 1001, 72)).toBe(1010);
  });

  it('writes the timecode from the first frame, not from the frame number', () => {
    expect(timecode(1001, 1001, 24)).toBe('00:00:00:00');
    expect(timecode(1049, 1001, 24)).toBe('00:00:02:00');
    expect(timecode(1001 + 24 * 3661 + 5, 1001, 24)).toBe('01:01:01:05');
    expect(timecode(900, 1001, 24)).toBe('00:00:00:00'); // before the first frame is the first frame
  });
});
