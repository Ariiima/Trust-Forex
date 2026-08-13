/**
 * Circular crop, for images the Mini App renders in a round frame.
 *
 * A broker logo picked from disk is almost never square, and the Mini App
 * clips it to a circle. Uploading the raw file meant the operator found out
 * what got cut off only after it was live, so the file is held here until the
 * framing is confirmed: the preview IS the circle the user sees.
 *
 * The output is a square canvas of exactly what the circle contains, so the
 * stored image needs no further cropping anywhere downstream.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Modal } from './index';

/** Longest edge of the preview frame, and of the image it exports. */
const FRAME = 260;
const EXPORT = 512;

export function ImageCrop({
  src, onCancel, onApply, shape = 'circle', aspect = 1, title, subtitle,
}: {
  /** Object URL or data URL of the file the operator just chose. */
  src: string;
  onCancel: () => void;
  /** Receives a data URL containing exactly the framed area. */
  onApply: (dataUrl: string) => void;
  /** The frame the destination renders in. A broker logo is clipped to a
   *  circle; an in-app card is a plain rectangle. */
  shape?: 'circle' | 'rect';
  /** width / height of the frame. Ignored when shape is 'circle'. */
  aspect?: number;
  title?: string;
  subtitle?: string;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  // Offset of the image centre from the frame centre, in frame pixels.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);

  /* The frame, sized so its longest edge is FRAME. A circle is the 1:1 case. */
  const ratio = shape === 'circle' ? 1 : aspect;
  const frame = ratio >= 1
    ? { w: FRAME, h: Math.round(FRAME / ratio) }
    : { w: Math.round(FRAME * ratio), h: FRAME };

  /* The scale at which the image just covers the frame. Everything is measured
     against this, so zoom=1 always means "no gap", whatever the source size. */
  const cover = img ? Math.max(frame.w / img.width, frame.h / img.height) : 1;
  const scale = cover * zoom;
  const drawn = img ? { w: img.width * scale, h: img.height * scale } : { w: 0, h: 0 };

  /* Never let the frame show through: the image cannot be dragged past its
     own edge, so there is no way to save a logo with a bald corner. */
  const clamp = (o: { x: number; y: number }) => {
    const maxX = Math.max(0, (drawn.w - frame.w) / 2);
    const maxY = Math.max(0, (drawn.h - frame.h) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  };

  useEffect(() => { setOffset((o) => clamp(o)); /* eslint-disable-next-line */ }, [zoom, img]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setOffset(clamp({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    }));
  };
  const onUp = () => { drag.current = null; };

  const apply = () => {
    if (!img) return;
    // Frame pixels -> export pixels. The same transform the preview applies,
    // so what was inside the frame is exactly what lands on the canvas.
    const k = EXPORT / Math.max(frame.w, frame.h);
    const out = { w: Math.round(frame.w * k), h: Math.round(frame.h * k) };
    const canvas = document.createElement('canvas');
    canvas.width = out.w;
    canvas.height = out.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = drawn.w * k;
    const h = drawn.h * k;
    ctx.drawImage(
      img,
      (out.w - w) / 2 + offset.x * k,
      (out.h - h) / 2 + offset.y * k,
      w,
      h,
    );
    onApply(canvas.toDataURL('image/png'));
  };

  return (
    <Modal
      title={title ?? 'Position the logo'}
      subtitle={subtitle ?? `Drag to move, and zoom until it sits the way you want. The ${shape === 'circle' ? 'circle' : 'frame'} is what users see.`}
      width={Math.max(420, frame.w + 120)}
      onClose={onCancel}
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={!img} onClick={apply}>Use this image</Button>
        </>
      )}
    >
      <div className="a-crop">
        <div
          className={`a-crop__frame${shape === 'rect' ? ' a-crop__frame--rect' : ''}`}
          style={{ width: frame.w, height: frame.h }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                width: drawn.w,
                height: drawn.h,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        <label className="a-crop__zoom">
          <span className="a-field__label">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
          />
        </label>
      </div>
    </Modal>
  );
}
