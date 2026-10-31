export type Landmark = { x: number; y: number; z: number; visibility: number };

export type PoseFrame = {
  frameId: number;
  /** ms, capture time of the video frame (performance.now timeline) */
  t: number;
  /** 33 landmarks, normalized image coordinates (0..1) */
  image: Landmark[];
  /** 33 landmarks, meters, origin at hip center */
  world: Landmark[];
};

export type DiscreteAction = 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'jump';
export const DISCRETE_ACTIONS: readonly DiscreteAction[] = ['punch_l', 'punch_r', 'kick_l', 'kick_r', 'jump'];

export type ActionEvent = { action: DiscreteAction; confidence: number; t: number; frameId: number };

export type ControlState = {
  block: boolean;
  crouch: boolean;
  /** -1 left, 1 right (player's anatomical side) */
  dodge: -1 | 0 | 1;
  move: -1 | 0 | 1;
};

export const DEFAULT_STATE: Readonly<ControlState> = Object.freeze({ block: false, crouch: false, dodge: 0, move: 0 });

export type TrackingStatus = 'no_person' | 'partial' | 'out_of_frame' | 'ok';

export type ControlFrame = { t: number; events: ActionEvent[]; state: ControlState; tracking: TrackingStatus };

export type LR<T> = { l: T; r: T };
export type Side = keyof LR<unknown>;
