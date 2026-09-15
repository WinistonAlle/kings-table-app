'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './OptionWheel.css';

// Adapted from the React Bits OptionWheel supplied for this project.
export default function OptionWheel({ items, defaultSelected = 2, onChange }: {
  items: string[];
  defaultSelected?: number;
  onChange?: (index: number, item: string) => void;
}) {
  const initial = Math.min(defaultSelected, Math.max(0, items.length - 1));
  const root = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const pos = useRef(initial);
  const target = useRef(initial);
  const frame = useRef<number | null>(null);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ y: number; start: number; id: number } | null>(null);
  const moved = useRef(false);
  const callback = useRef(onChange);
  const [selected, setSelected] = useState(initial);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { callback.current = onChange; }, [onChange]);

  const rowHeight = useCallback(() => {
    const el = refs.current[0];
    return el ? parseFloat(getComputedStyle(el).fontSize) * 1.4 : 67.2;
  }, []);

  const animate = useCallback(function tick(now: number) {
    const dt = Math.min((now - last.current) / 1000, 0.05);
    last.current = now;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pos.current += (target.current - pos.current) * (reduced ? 1 : 1 - Math.exp(-dt / 0.2));
    const settled = Math.abs(target.current - pos.current) < 0.001;
    if (settled) pos.current = target.current;
    const tilt = 6 * Math.PI / 180;
    const radius = rowHeight() / tilt;
    refs.current.forEach((el, i) => {
      if (!el) return;
      const distance = i - pos.current;
      const angle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, distance * tilt));
      const x = -radius * (1 - Math.cos(angle));
      const y = radius * Math.sin(angle);
      el.style.transform = `translate(${x}px, calc(${y}px - 50%)) rotate(${angle * 180 / Math.PI}deg)`;
      el.style.opacity = String(Math.max(0.05, 1 - Math.abs(distance) * 0.25));
      el.style.filter = `blur(${Math.abs(distance) * 2}px)`;
      el.style.setProperty('--ow-p', String(Math.max(0, 1 - Math.abs(distance))));
    });
    frame.current = settled ? null : requestAnimationFrame(tick);
  }, [rowHeight]);

  const select = useCallback((value: number, snap = true) => {
    if (!items.length) return;
    target.current = Math.min(items.length - 1, Math.max(0, snap ? Math.round(value) : value));
    const index = Math.round(target.current);
    setSelected(previous => previous === index ? previous : index);
    callback.current?.(index, items[index]);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    last.current = performance.now();
    frame.current = requestAnimationFrame(animate);
  }, [items, animate]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      const delta = event.deltaY * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? el.clientHeight : 1);
      if (!delta || (delta < 0 && target.current <= 0) || (delta > 0 && target.current >= items.length - 1)) return;
      event.preventDefault();
      event.stopPropagation();
      select(target.current + Math.max(-1, Math.min(1, delta / rowHeight())), false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => select(target.current), 140);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    const resize = () => select(target.current);
    window.addEventListener('resize', resize);
    select(target.current);
    return () => {
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('resize', resize);
      if (timer.current) clearTimeout(timer.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [select, rowHeight, items.length]);

  return (
    <div ref={root} role="listbox" tabIndex={0} aria-label="Funcionalidades do King's Table"
      aria-activedescendant={`feature-option-${selected}`}
      data-lenis-prevent-wheel
      className={`option-wheel${dragging ? ' option-wheel--dragging' : ''}`}
      onKeyDown={event => {
        const delta = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
        if (delta || event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          select(event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.round(target.current) + delta);
        }
      }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        root.current?.focus({ preventScroll: true });
        drag.current = { y: event.clientY, start: target.current, id: event.pointerId };
        moved.current = false;
        setDragging(true);
      }}
      onPointerMove={event => {
        if (!drag.current) return;
        const dy = event.clientY - drag.current.y;
        if (Math.abs(dy) > 4) { moved.current = true; root.current?.setPointerCapture(drag.current.id); }
        if (moved.current) select(drag.current.start - dy / rowHeight(), false);
      }}
      onPointerUp={() => { drag.current = null; setDragging(false); if (moved.current) select(target.current); }}
      onPointerCancel={() => { drag.current = null; setDragging(false); select(target.current); }}
    >
      {items.map((item, index) => (
        <div key={item} id={`feature-option-${index}`} ref={el => { refs.current[index] = el; }}
          role="option" aria-selected={index === selected}
          className={`option-wheel__item${index === selected ? ' option-wheel__item--selected' : ''}`}
          style={{ transform: `translateY(calc(${(index - initial) * 1.4}em - 50%))`, opacity: Math.max(0.05, 1 - Math.abs(index - initial) * 0.25) }}
          onClick={() => { if (!moved.current) select(index); }}>
          {item}
        </div>
      ))}
    </div>
  );
}
