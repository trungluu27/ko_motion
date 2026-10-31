import { DISCRETE_ACTIONS } from '../shared/types';
import { evaluate } from '../motion/eval';
import { type Session, SessionFormatError, parseSession, serializeSession } from '../motion/session/format';
import { SessionRecorder } from '../motion/session/recorder';
import { replaySession } from '../motion/session/replay';
import { VideoRecorder, downloadBlob, recordingFilename, timestamp } from '../recording/videoRecorder';
import { DEFAULT_SCRIPT, GuidedCapture } from './guidedCapture';
import { LAB_W, type LabApp } from './labApp';

const sessionFilename = (prefix: string) => `${prefix}-${timestamp(new Date())}.json`;

function button(app: LabApp, label: string, title: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = title;
  app.toolbar.append(b);
  return b;
}

/** Adds video recording, session record/replay and guided capture to the Lab toolbar. */
export function installSessionControls(app: LabApp): void {
  const video = new VideoRecorder();
  const recorder = new SessionRecorder();
  let guided: GuidedCapture | null = null;
  let guidedPrompt: string | undefined;
  let replayStop: (() => void) | null = null;

  const recBtn = button(app, '⏺ Record video', 'Quay video canvas (phím R)');
  const sessionBtn = button(app, '💾 Ghi phiên', 'Ghi landmark ra file JSON');
  const guidedBtn = button(app, '🎯 Guided capture', 'Thu dữ liệu có nhãn theo kịch bản (phím N để bỏ qua bước)');
  const replayBtn = button(app, '▶ Phát lại', 'Chọn hoặc kéo thả file phiên .json');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  app.toolbar.append(fileInput);

  if (!VideoRecorder.isAvailable()) recBtn.hidden = true;

  // --- video recording ---------------------------------------------------
  const toggleVideo = async () => {
    if (video.recording) {
      const blob = await video.stop();
      downloadBlob(blob, recordingFilename(new Date()));
      recBtn.classList.remove('active');
      recBtn.textContent = '⏺ Record video';
    } else {
      video.start(app.canvas);
      recBtn.classList.add('active');
      recBtn.textContent = '⏹ Dừng quay';
    }
  };
  recBtn.onclick = () => void toggleVideo();
  app.afterRender = (ctx, now) => {
    if (!video.recording && !recorder.recording) return;
    const s = Math.floor((video.recording ? video.elapsedMs(now) : 0) / 1000);
    ctx.save();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(LAB_W - 110, 26, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    const label = video.recording ? `REC ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : 'SESSION';
    ctx.fillText(label, LAB_W - 94, 32);
    ctx.restore();
  };

  // --- session recording -------------------------------------------------
  const startSession = () =>
    recorder.start({
      createdAt: new Date().toISOString(),
      width: app.video?.videoWidth || 1280,
      height: app.video?.videoHeight || 720,
      model: app.modelName,
      calibration: app.currentCalibration,
    });
  const saveSession = (prefix: string) => {
    const session = recorder.stop();
    downloadBlob(new Blob([serializeSession(session)], { type: 'application/json' }), sessionFilename(prefix));
  };
  sessionBtn.onclick = () => {
    if (recorder.recording && !guided) {
      saveSession('session');
      sessionBtn.classList.remove('active');
      sessionBtn.textContent = '💾 Ghi phiên';
    } else if (!recorder.recording) {
      startSession();
      sessionBtn.classList.add('active');
      sessionBtn.textContent = '⏹ Lưu phiên';
    }
  };

  // --- guided capture ----------------------------------------------------
  const finishGuided = (save: boolean) => {
    guided = null;
    guidedPrompt = undefined;
    guidedBtn.classList.remove('active');
    guidedBtn.textContent = '🎯 Guided capture';
    if (save) saveSession('guided');
    else recorder.stop();
  };
  const onGuidedUpdate = (u: ReturnType<GuidedCapture['update']>) => {
    if (u.newLabel) recorder.addLabel(u.newLabel);
    if (u.phase === 'done') return finishGuided(true);
    const secs = Math.ceil(u.remainingMs / 1000);
    guidedPrompt = u.phase === 'rest' ? `Chuẩn bị: ${u.step!.prompt} (${secs})` : `${u.step!.prompt} — còn ${secs}s`;
  };
  guidedBtn.onclick = () => {
    if (guided) return finishGuided(false);
    if (!app.currentCalibration) {
      app.showMessage('Hãy bấm 🎯 Calibrate trước khi chạy guided capture.');
      return;
    }
    if (recorder.recording) return;
    startSession();
    guided = new GuidedCapture(DEFAULT_SCRIPT);
    guided.start(performance.now());
    guidedBtn.classList.add('active');
    guidedBtn.textContent = '⏹ Huỷ guided';
  };
  app.prompt = () => guidedPrompt;

  app.frameListeners.push((frame) => {
    if (frame && recorder.recording) recorder.addFrame(frame);
    if (guided) onGuidedUpdate(guided.update(frame?.t ?? performance.now()));
  });

  // --- replay ------------------------------------------------------------
  const startReplay = (session: Session) => {
    replayStop?.();
    const outputs = replaySession(session);
    const scores = evaluate(outputs, session.labels);
    app.footer = session.labels.length
      ? ['Đánh giá (precision / recall):', ...DISCRETE_ACTIONS.map((a) =>
          `${a.padEnd(8)} ${(scores[a].precision * 100).toFixed(0).padStart(4)}% ${(scores[a].recall * 100).toFixed(0).padStart(4)}%`)]
      : [];
    app.setLivePaused(true);
    app.replaySize = { w: session.width || 1280, h: session.height || 720 };
    app.resetView();
    const t0 = session.frames[0]?.t ?? 0;
    const start = performance.now();
    let i = 0;
    let raf = 0;
    const step = () => {
      const now = performance.now();
      while (i < outputs.length && session.frames[i].t - t0 <= now - start) {
        app.process(session.frames[i], outputs[i], now);
        i++;
      }
      if (i < outputs.length) raf = requestAnimationFrame(step);
      else stop();
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      replayStop = null;
      app.replaySize = null;
      app.resetView();
      app.setLivePaused(false);
      replayBtn.textContent = '▶ Phát lại';
    };
    replayStop = stop;
    replayBtn.textContent = '⏹ Dừng phát lại';
    raf = requestAnimationFrame(step);
  };
  const loadFile = async (file: File) => {
    try {
      startReplay(parseSession(await file.text()));
      app.showMessage(null);
    } catch (e) {
      const msg = e instanceof SessionFormatError ? e.message : `Không đọc được file: ${String(e)}`;
      app.showMessage(`📂 ${msg}`);
    }
  };
  replayBtn.onclick = () => (replayStop ? replayStop() : fileInput.click());
  fileInput.onchange = () => {
    const f = fileInput.files?.[0];
    if (f) void loadFile(f);
    fileInput.value = '';
  };
  app.canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    app.canvas.classList.add('drop-hint');
  });
  app.canvas.addEventListener('dragleave', () => app.canvas.classList.remove('drop-hint'));
  app.canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    app.canvas.classList.remove('drop-hint');
    const f = e.dataTransfer?.files[0];
    if (f) void loadFile(f);
  });

  // --- keyboard ----------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement || e.repeat) return;
    if (e.key === 'r' || e.key === 'R') void toggleVideo();
    if ((e.key === 'n' || e.key === 'N') && guided) onGuidedUpdate(guided.skip(performance.now()));
  });
}
