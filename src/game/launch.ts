import type Phaser from 'phaser';
import type { Difficulty } from './ai/difficulty';
import type { Settings } from './settings';

/** What the player picked in the menu. */
export type Launch = { mode: 'fight'; opponent: Difficulty } | { mode: 'dummy' } | { mode: 'drill' };

export type Step = 'safety' | 'calibration' | 'fight' | 'drill';

/** The screens between the menu and the activity: safety once, calibration for body control (spec phase5 2). */
export function routeLaunch(launch: Launch, settings: Settings): Step[] {
  const steps: Step[] = [];
  if (!settings.safetyAck) steps.push('safety');
  if (settings.control === 'body') steps.push('calibration');
  steps.push(launch.mode === 'drill' ? 'drill' : 'fight');
  return steps;
}

/** Scene keys of each step. */
export const SCENE_OF: Record<Step, string> = { safety: 'safety', calibration: 'calibration', fight: 'fight', drill: 'drill' };

/** Data every launch-driven scene receives: what to start, the steps still to go after this one, and overrides. */
export type LaunchData = {
  launch: Launch;
  rest: Step[];
  /** forces the control for the activity (calibration done → body; camera failed → keyboard) */
  control?: 'keyboard' | 'body';
  /** shown for a few seconds when the activity starts */
  notice?: string | null;
};

/** Starts the first remaining step's scene, carrying the launch and any overrides along. */
export function advance(scene: Phaser.Scene, data: LaunchData, extra: Pick<LaunchData, 'control' | 'notice'> = {}): void {
  const [next, ...rest] = data.rest;
  if (next) scene.scene.start(SCENE_OF[next], { ...data, ...extra, rest } satisfies LaunchData);
}
