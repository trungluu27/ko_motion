import { describe, expect, test } from 'vitest';
import { pickMimeType, recordingFilename } from '../../src/recording/videoRecorder';

describe('pickMimeType', () => {
  test('prefers vp9, then vp8, then plain webm', () => {
    expect(pickMimeType(() => true)).toBe('video/webm;codecs=vp9,opus');
    expect(pickMimeType((t) => t.includes('vp8'))).toBe('video/webm;codecs=vp8,opus');
    expect(pickMimeType((t) => t === 'video/webm')).toBe('video/webm');
  });
  test('returns null when nothing is supported', () => {
    expect(pickMimeType(() => false)).toBeNull();
  });
});

test('recordingFilename uses local date and time', () => {
  expect(recordingFilename(new Date(2026, 9, 31, 14, 5, 9))).toBe('bodyfighter-20261031-140509.webm');
});
