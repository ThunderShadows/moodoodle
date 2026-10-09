import { selectionToFraction, type CropRect } from './crop';

export interface CropperHandlers {
  /** Called whenever the user finishes drawing, moving or resizing the selection. */
  onSelect(rect: CropRect): void;
  onCancel(): void;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';

export const cropperCss = `
.crop-layer { position: fixed; inset: 0; z-index: 2147483646; cursor: crosshair; }
.crop-frame { position: fixed; outline: 2px dashed rgba(255,255,255,0.9); outline-offset: -2px; box-shadow: 0 0 0 9999px rgba(42,36,51,0.35); pointer-events: none; }
.crop-sel { position: fixed; border: 2px dashed #FFFFFF; border-radius: 4px; box-shadow: 0 0 0 9999px rgba(42,36,51,0.55); cursor: move; }
.crop-sel[hidden] { display: none; }
.crop-handle { position: absolute; width: 16px; height: 16px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 0 0 2px #2A2433; }
.crop-handle.nw { left: -9px; top: -9px; cursor: nwse-resize; } .crop-handle.se { right: -9px; bottom: -9px; cursor: nwse-resize; }
.crop-handle.ne { right: -9px; top: -9px; cursor: nesw-resize; } .crop-handle.sw { left: -9px; bottom: -9px; cursor: nesw-resize; }
.crop-bar { position: fixed; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 14px; border-radius: 999px; background: #2A2433; color: #FFFFFF; font: 600 13px/1 system-ui, sans-serif; box-shadow: 0 8px 22px rgba(0,0,0,.3); cursor: default; }
.crop-cancel { height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: #FFFFFF; color: #2A2433; font: inherit; cursor: pointer; }
.crop-cancel:focus-visible { outline: 3px solid #FFB58F; outline-offset: 2px; }
`;

/** Lets the user draw, move and resize a crop box over an image on the page. */
export function openCropper(root: ShadowRoot | HTMLElement, box: Box, handlers: CropperHandlers) {
  const style = document.createElement('style');
  style.textContent = cropperCss;
  const layer = document.createElement('div');
  layer.className = 'crop-layer';
  const frame = document.createElement('div');
  frame.className = 'crop-frame';
  Object.assign(frame.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  const sel = document.createElement('div');
  sel.className = 'crop-sel';
  sel.hidden = true;
  for (const c of ['nw', 'ne', 'sw', 'se'] as Corner[]) {
    const h = document.createElement('span');
    h.className = `crop-handle ${c}`;
    h.dataset.corner = c;
    sel.append(h);
  }
  const bar = document.createElement('div');
  bar.className = 'crop-bar';
  bar.style.left = `${box.left}px`;
  bar.style.top = `${Math.max(8, box.top - 48)}px`;
  const hint = document.createElement('span');
  hint.textContent = 'Drag over the part you want';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'crop-cancel';
  cancel.textContent = 'Cancel';
  bar.append(hint, cancel);
  layer.append(frame, sel, bar);
  root.append(style, layer);

  const clampX = (x: number) => Math.min(box.left + box.width, Math.max(box.left, x));
  const clampY = (y: number) => Math.min(box.top + box.height, Math.max(box.top, y));
  let selectedHint = 'Edit and keep it in the moodoodle panel →';
  let rect: { x1: number; y1: number; x2: number; y2: number } | undefined;
  let mode: { kind: 'new' | 'resize'; fx: number; fy: number } | { kind: 'move'; sx: number; sy: number; start: NonNullable<typeof rect> } | undefined;

  function paint() {
    if (!rect) { sel.hidden = true; return; }
    const x = Math.min(rect.x1, rect.x2), y = Math.min(rect.y1, rect.y2);
    Object.assign(sel.style, { left: `${x}px`, top: `${y}px`, width: `${Math.abs(rect.x2 - rect.x1)}px`, height: `${Math.abs(rect.y2 - rect.y1)}px` });
    sel.hidden = false;
  }

  function onDown(e: MouseEvent) {
    if ((e.target as Element).closest('.crop-bar')) return;
    e.preventDefault();
    const t = e.target as HTMLElement;
    const corner = t.closest<HTMLElement>('.crop-handle')?.dataset.corner as Corner | undefined;
    if (corner && rect) {
      const l = Math.min(rect.x1, rect.x2), r = Math.max(rect.x1, rect.x2), tp = Math.min(rect.y1, rect.y2), b = Math.max(rect.y1, rect.y2);
      const fx = corner.includes('w') ? r : l;
      const fy = corner.includes('n') ? b : tp;
      mode = { kind: 'resize', fx, fy };
    } else if (t.closest('.crop-sel') && rect) {
      mode = { kind: 'move', sx: e.clientX, sy: e.clientY, start: { ...rect } };
    } else {
      const x = clampX(e.clientX), y = clampY(e.clientY);
      mode = { kind: 'new', fx: x, fy: y };
      rect = { x1: x, y1: y, x2: x, y2: y };
    }
    paint();
  }

  function onMove(e: MouseEvent) {
    if (!mode || !rect) return;
    if (mode.kind === 'move') {
      const w = mode.start.x2 - mode.start.x1, h = mode.start.y2 - mode.start.y1;
      const x1 = Math.min(box.left + box.width - Math.abs(w), Math.max(box.left, Math.min(mode.start.x1, mode.start.x2) + e.clientX - mode.sx));
      const y1 = Math.min(box.top + box.height - Math.abs(h), Math.max(box.top, Math.min(mode.start.y1, mode.start.y2) + e.clientY - mode.sy));
      rect = { x1, y1, x2: x1 + Math.abs(w), y2: y1 + Math.abs(h) };
    } else {
      rect = { x1: mode.fx, y1: mode.fy, x2: clampX(e.clientX), y2: clampY(e.clientY) };
    }
    paint();
  }

  function onUp() {
    if (!mode || !rect) return;
    const wasNew = mode.kind === 'new';
    mode = undefined;
    const frac = selectionToFraction({ x: rect.x1, y: rect.y1 }, { x: rect.x2, y: rect.y2 }, box);
    if (frac) {
      hint.textContent = selectedHint;
      handlers.onSelect(frac);
    } else if (wasNew) {
      rect = undefined;
      paint();
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      handlers.onCancel();
    }
  }
  // Keep the page from scrolling under the selection while cropping.
  const stopWheel = (e: WheelEvent) => e.preventDefault();

  layer.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('keydown', onKey, true);
  layer.addEventListener('wheel', stopWheel, { passive: false });
  cancel.addEventListener('click', () => { close(); handlers.onCancel(); });

  function close() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('keydown', onKey, true);
    layer.remove();
    style.remove();
  }

  /** Replaces the hint (and the one shown after selecting), e.g. when the panel must be opened by hand. */
  function setHint(text: string) {
    selectedHint = text;
    hint.textContent = text;
  }

  return { close, setHint };
}
