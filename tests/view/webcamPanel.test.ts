import { describe, expect, test } from 'vitest';
import { ActionLabelTimer } from '../../src/view/webcamPanel';

const ev = (action: 'punch_l' | 'kick_r', t: number) => ({ action, confidence: 1, t, frameId: 0 });

describe('ActionLabelTimer', () => {
  test('shows an event for 600 ms then clears', () => {
    const timer = new ActionLabelTimer();
    expect(timer.current(0)).toBeNull();
    timer.push(ev('punch_l', 1000), 1000);
    expect(timer.current(1300)?.action).toBe('punch_l');
    expect(timer.current(1599)?.action).toBe('punch_l');
    expect(timer.current(1600)).toBeNull();
  });

  test('a newer event replaces the shown one and restarts the timer', () => {
    const timer = new ActionLabelTimer(600);
    timer.push(ev('punch_l', 0), 0);
    timer.push(ev('kick_r', 400), 400);
    expect(timer.current(900)?.action).toBe('kick_r');
  });
});
