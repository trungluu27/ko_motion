// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { renderMessage, setCameraOptions } from '../../src/lab/message';

test('messages render as text, never as HTML', () => {
  const el = document.createElement('div');
  renderMessage(el, 'Phiên bản file không hỗ trợ: <img src=x onerror=alert(1)>');
  expect(el.querySelector('img')).toBeNull();
  expect(el.textContent).toContain('<img src=x');
  expect(el.hidden).toBe(false);
});

test('a retry button calls back and null hides the message', () => {
  const el = document.createElement('div');
  let retried = 0;
  renderMessage(el, 'Lỗi', () => retried++);
  el.querySelector('button')!.click();
  expect(retried).toBe(1);
  renderMessage(el, null);
  expect(el.hidden).toBe(true);
  expect(el.textContent).toBe('');
});

test('camera labels are inserted as option text', () => {
  const select = document.createElement('select');
  setCameraOptions(select, [{ deviceId: 'a', label: '<b>Cam</b>' }, { deviceId: 'b', label: '' }]);
  expect(select.querySelector('b')).toBeNull();
  expect([...select.options].map((o) => o.text)).toEqual(['<b>Cam</b>', 'Camera 2']);
});
