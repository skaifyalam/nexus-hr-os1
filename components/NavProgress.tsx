'use client';
import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// A thin top progress bar that appears on every route change, giving instant
// feedback that a click/navigation registered. Purely visual; no dependencies.
export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<any[]>([]);
  const firstRender = useRef(true);

  // Intercept any click on a link/button that leads to navigation to start the bar.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      // Only for internal navigations (not new-tab, not external, not hashes)
      if (!href || href.startsWith('http') || href.startsWith('#') || target.target === '_blank') return;
      if (href === pathname) return;
      start();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const start = () => {
    clearTimers();
    setVisible(true);
    setWidth(8);
    // Ease the bar up toward ~80% while the page loads
    timers.current.push(setTimeout(() => setWidth(35), 120));
    timers.current.push(setTimeout(() => setWidth(65), 350));
    timers.current.push(setTimeout(() => setWidth(80), 800));
  };

  const finish = () => {
    clearTimers();
    setWidth(100);
    timers.current.push(setTimeout(() => { setVisible(false); setWidth(0); }, 250));
  };

  // When the path (or query) actually changes, the new page has rendered → finish.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999, pointerEvents: 'none' }}>
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'linear-gradient(90deg, #2563eb, #06b6d4)',
          boxShadow: '0 0 8px rgba(37,99,235,0.5)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
