import { describe, expect, test } from 'vitest';
import { TrackingPause } from '../../src/game/trackingPause';
import type { TrackingStatus } from '../../src/shared/types';

/** Feeds `status` every 50 ms from `from` to `to` (inclusive) and returns the last view. */
function feed(p: TrackingPause, status: TrackingStatus, from: number, to: number, over = false) {
  let v = p.update(status, from, over);
  for (let t = from + 50; t <= to; t += 50) v = p.update(status, t, over);
  return v;
}

describe('TrackingPause', () => {
  test('stays running while tracking is ok', () => {
    expect(feed(new TrackingPause(), 'ok', 0, 5000)).toEqual({ paused: false, countdown: null });
  });

  test('a brief loss under 500 ms does not pause', () => {
    const p = new TrackingPause();
    feed(p, 'ok', 0, 100);
    feed(p, 'partial', 150, 500);
    expect(feed(p, 'ok', 550, 600)).toEqual({ paused: false, countdown: null });
  });

  test('500 ms of lost tracking pauses; 1 s of ok starts a 3-2-1 countdown, then resumes', () => {
    const p = new TrackingPause();
    expect(feed(p, 'partial', 0, 500)).toEqual({ paused: true, countdown: null });
    expect(feed(p, 'ok', 550, 1500)).toEqual({ paused: true, countdown: null }); // 950 ms ok
    expect(p.update('ok', 1550, false)).toEqual({ paused: true, countdown: 3 }); // 1000 ms ok
    expect(feed(p, 'ok', 1600, 3050)).toEqual({ paused: true, countdown: 2 }); // 1500 ms left
    expect(feed(p, 'ok', 3100, 4550)).toEqual({ paused: false, countdown: null });
  });

  test('losing tracking during the countdown goes back to paused', () => {
    const p = new TrackingPause();
    feed(p, 'no_person', 0, 600);
    feed(p, 'ok', 650, 2000);
    expect(p.update('ok', 2050, false).countdown).not.toBeNull();
    expect(p.update('out_of_frame', 2100, false)).toEqual({ paused: true, countdown: null });
  });

  test('never pauses once the match is over', () => {
    expect(feed(new TrackingPause(), 'no_person', 0, 3000, true)).toEqual({ paused: false, countdown: null });
  });
});
