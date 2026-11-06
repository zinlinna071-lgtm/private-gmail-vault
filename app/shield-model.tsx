"use client";

import { useRef, useState } from "react";

export default function ShieldModel() {
  const [rotation, setRotation] = useState({ x: -12, y: 24 });
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointer.current = { x: event.clientX, y: event.clientY, rx: rotation.x, ry: rotation.y };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointer.current) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    setRotation({
      x: Math.max(-48, Math.min(48, pointer.current.rx - dy * 0.42)),
      y: pointer.current.ry + dx * 0.55
    });
  }

  function stopDragging() {
    pointer.current = null;
    setDragging(false);
  }

  function nudge(y: number, x: number) {
    setRotation(current => ({ x: Math.max(-48, Math.min(48, current.x + x)), y: current.y + y }));
  }

  return (
    <section className="entry-visual" aria-label="Interactive security shield model">
      <div className="visual-topline"><span>PRIVATE SECURITY SYSTEM</span><span className="visual-topline-right"><i /> INTERACTIVE MODEL</span></div>
      <div
        className={dragging ? "shield-stage is-dragging" : "shield-stage"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        role="img"
        aria-label="A three-dimensional layered shield. Drag to rotate it; use the arrow buttons for precise rotation."
      >
        <div className="shield-orbit orbit-a" />
        <div className="shield-orbit orbit-b" />
        <div className="shield-orbit orbit-c" />
        <div className="shield-beam beam-a" />
        <div className="shield-beam beam-b" />
        <div className="shield-model" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
          <div className="shield-depth depth-3" />
          <div className="shield-depth depth-2" />
          <div className="shield-depth depth-1" />
          <svg className="shield-face" viewBox="0 0 260 300" aria-hidden="true">
            <defs>
              <linearGradient id="shieldMetal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e0fff7" />
                <stop offset=".35" stopColor="#54dcb9" />
                <stop offset="1" stopColor="#176e83" />
              </linearGradient>
              <linearGradient id="shieldInner" x1="0" y1="0" x2="0.9" y2="1">
                <stop offset="0" stopColor="#143c4b" />
                <stop offset="1" stopColor="#091b31" />
              </linearGradient>
              <filter id="shieldGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <path d="M130 10 232 48v78c0 72-42 124-102 159C70 250 28 198 28 126V48Z" fill="#0b2635" stroke="#1b6e77" strokeWidth="8"/>
            <path d="M130 23 218 56v69c0 64-36 110-88 143-52-33-88-79-88-143V56Z" fill="url(#shieldMetal)" opacity=".96"/>
            <path d="M130 38 203 66v58c0 54-29 94-73 123-44-29-73-69-73-123V66Z" fill="url(#shieldInner)" stroke="#b7fff0" strokeOpacity=".72" strokeWidth="2"/>
            <path d="M130 57 185 78v45c0 42-21 74-55 98-34-24-55-56-55-98V78Z" fill="none" stroke="#4eddb8" strokeOpacity=".58" strokeWidth="1.5"/>
            <path d="m91 145 25 25 54-60" fill="none" stroke="#baffed" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" filter="url(#shieldGlow)"/>
            <path d="M130 10v13M28 48l-12-5M232 48l12-5" stroke="#c6fff1" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <div className="shield-reflection" />
        </div>
        <span className="model-label model-label-a">AUTHENTICATED ACCESS</span>
        <span className="model-label model-label-b">PRIVATE DATA BOUNDARY</span>
        <span className="model-crosshair crosshair-a">+</span>
        <span className="model-crosshair crosshair-b">+</span>
      </div>
      <div className="visual-controls">
        <span>DRAG TO ROTATE</span>
        <div className="rotation-buttons">
          <button type="button" aria-label="Rotate shield left" onClick={() => nudge(-18, 0)}>↶</button>
          <button type="button" aria-label="Tilt shield up" onClick={() => nudge(0, -10)}>↑</button>
          <button type="button" aria-label="Tilt shield down" onClick={() => nudge(0, 10)}>↓</button>
          <button type="button" aria-label="Rotate shield right" onClick={() => nudge(18, 0)}>↷</button>
          <button type="button" aria-label="Reset shield position" onClick={() => setRotation({ x: -12, y: 24 })}>RESET</button>
        </div>
      </div>
      <div className="visual-bottomline"><span>ACCESS CONTROL</span><span>·</span><span>ENCRYPTED STORAGE</span><span>·</span><span>PRIVATE BY DESIGN</span></div>
    </section>
  );
}
