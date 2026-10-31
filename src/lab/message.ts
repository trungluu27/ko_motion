/** Shows plain-text status in `el` (never parsed as HTML), with an optional retry button; null hides it. */
export function renderMessage(el: HTMLElement, text: string | null, retry?: () => void): void {
  el.hidden = text === null;
  el.textContent = text ?? '';
  if (text !== null && retry) {
    const b = document.createElement('button');
    b.textContent = 'Thử lại';
    b.onclick = retry;
    el.append(' ', b);
  }
}

export function setCameraOptions(select: HTMLSelectElement, cams: { deviceId: string; label: string }[]): void {
  select.replaceChildren(
    ...cams.map((c, i) => {
      const o = document.createElement('option');
      o.value = c.deviceId;
      o.textContent = c.label || `Camera ${i + 1}`;
      return o;
    }),
  );
}
