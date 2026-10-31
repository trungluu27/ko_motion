// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { installSessionControls } from '../../src/lab/sessionControls';
import type { LabApp } from '../../src/lab/labApp';

function stubApp() {
  const toolbar = document.createElement('div');
  const app = {
    toolbar,
    canvas: document.createElement('canvas'),
    frameListeners: [],
    video: null,
    modelName: 'full',
    currentCalibration: null,
    showMessage: vi.fn(),
    setLivePaused: vi.fn(),
    afterRender: null,
    prompt: null,
  };
  installSessionControls(app as unknown as LabApp);
  const buttons = [...toolbar.querySelectorAll('button')];
  const find = (text: string) => buttons.find((b) => b.textContent?.includes(text))!;
  return { app, find, fileInput: toolbar.querySelector('input')! };
}

test('replay is refused while a session is being recorded', () => {
  const { app, find, fileInput } = stubApp();
  const openPicker = vi.spyOn(fileInput, 'click');
  find('Ghi phiên').click();
  find('Phát lại').click();
  expect(openPicker).not.toHaveBeenCalled();
  expect(app.showMessage).toHaveBeenCalledWith(expect.stringContaining('Dừng ghi'));
});

test('replay opens the file picker when nothing is recording', () => {
  const { find, fileInput } = stubApp();
  const openPicker = vi.spyOn(fileInput, 'click');
  find('Phát lại').click();
  expect(openPicker).toHaveBeenCalled();
});
