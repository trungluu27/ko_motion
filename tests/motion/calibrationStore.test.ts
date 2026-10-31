// @vitest-environment happy-dom
import { beforeEach, expect, test } from 'vitest';
import { CALIBRATION_KEY, loadCalibration, saveCalibration } from '../../src/motion/calibrationStore';
import { defaultCalibration } from '../helpers/synthPose';

beforeEach(() => localStorage.clear());

test('a saved calibration loads back unchanged', () => {
  const cal = defaultCalibration();
  saveCalibration(cal);
  expect(loadCalibration()).toEqual(cal);
});

test('malformed JSON is discarded and the key removed', () => {
  localStorage.setItem(CALIBRATION_KEY, '{');
  expect(loadCalibration()).toBeNull();
  expect(localStorage.getItem(CALIBRATION_KEY)).toBeNull();
});

test('a calibration missing a field is rejected', () => {
  const { legPx: _omit, ...partial } = defaultCalibration();
  localStorage.setItem(CALIBRATION_KEY, JSON.stringify(partial));
  expect(loadCalibration()).toBeNull();
});

test('non-positive body sizes are rejected', () => {
  localStorage.setItem(CALIBRATION_KEY, JSON.stringify({ ...defaultCalibration(), torsoPx: 0 }));
  expect(loadCalibration()).toBeNull();
});

test('nothing stored gives null', () => {
  expect(loadCalibration()).toBeNull();
});
