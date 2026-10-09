// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openCropper } from './cropui';

const box = { left: 100, top: 50, width: 400, height: 200 };
const mouse = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.append(host);
});

function drag(from: [number, number], to: [number, number], start: EventTarget) {
  mouse(start, 'mousedown', ...from);
  mouse(document, 'mousemove', ...to);
  mouse(document, 'mouseup', ...to);
}

describe('openCropper', () => {
  it('follows the image when the page resizes (side panel opening) and keeps the same crop', () => {
    const onSelect = vi.fn();
    let geo = { box, image: box };
    openCropper(host, () => geo, { onSelect, onCancel: vi.fn() });
    drag([150, 100], [300, 150], host.querySelector('.crop-layer')!);
    const first = onSelect.mock.lastCall![0];
    // The panel narrows the page: the image shrinks to half size and moves left.
    const small = { left: 20, top: 40, width: 200, height: 100 };
    geo = { box: small, image: small };
    window.dispatchEvent(new Event('resize'));
    const frame = host.querySelector<HTMLElement>('.crop-frame')!;
    expect(frame.style.left).toBe('20px');
    expect(frame.style.width).toBe('200px');
    const sel = host.querySelector<HTMLElement>('.crop-sel')!;
    expect(sel.style.left).toBe('45px');
    expect(sel.style.width).toBe('75px');
    // Moving the selection afterwards is measured against the new position.
    drag([50, 60], [50, 60], sel);
    expect(onSelect).toHaveBeenLastCalledWith(first);
  });

  it('turns a drag over the image into a crop selection', () => {
    const onSelect = vi.fn();
    openCropper(host, box, { onSelect, onCancel: vi.fn() });
    drag([150, 100], [300, 150], host.querySelector('.crop-layer')!);
    expect(onSelect).toHaveBeenLastCalledWith({ x: 0.125, y: 0.25, w: 0.375, h: 0.25 });
    expect(host.querySelector<HTMLElement>('.crop-sel')!.hidden).toBe(false);
  });

  it('moves the selection when dragged from inside, staying within the image', () => {
    const onSelect = vi.fn();
    openCropper(host, box, { onSelect, onCancel: vi.fn() });
    drag([100, 50], [300, 150], host.querySelector('.crop-layer')!); // 0,0,.5,.5
    drag([200, 100], [600, 100], host.querySelector('.crop-sel')!); // push far right
    expect(onSelect).toHaveBeenLastCalledWith({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  it('resizes from a corner handle', () => {
    const onSelect = vi.fn();
    openCropper(host, box, { onSelect, onCancel: vi.fn() });
    drag([100, 50], [300, 150], host.querySelector('.crop-layer')!);
    drag([300, 150], [500, 250], host.querySelector('.crop-handle.se')!);
    expect(onSelect).toHaveBeenLastCalledWith({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('ignores tiny accidental drags', () => {
    const onSelect = vi.fn();
    openCropper(host, box, { onSelect, onCancel: vi.fn() });
    drag([150, 100], [152, 101], host.querySelector('.crop-layer')!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('cancels on Escape and on the Cancel button, and close() removes it', () => {
    const onCancel = vi.fn();
    const c = openCropper(host, box, { onSelect: vi.fn(), onCancel });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.crop-layer')).toBeNull();
    const onCancel2 = vi.fn();
    openCropper(host, box, { onSelect: vi.fn(), onCancel: onCancel2 });
    host.querySelector<HTMLButtonElement>('.crop-cancel')!.click();
    expect(onCancel2).toHaveBeenCalledTimes(1);
    const c3 = openCropper(host, box, { onSelect: vi.fn(), onCancel: vi.fn() });
    c3.close();
    expect(host.querySelector('.crop-layer')).toBeNull();
    void c;
  });
});

describe('cropper hint', () => {
  it('can change its hint, e.g. when the side panel could not open by itself', () => {
    const c = openCropper(host, box, { onSelect: vi.fn(), onCancel: vi.fn() });
    c.setHint('Click the kudoodle icon, then Open crop panel');
    expect(host.querySelector('.crop-bar')!.textContent).toContain('Click the kudoodle icon, then Open crop panel');
  });
});
