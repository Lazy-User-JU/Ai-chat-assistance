import { useEffect, useRef, useState } from "react";

/**
 * Reveals `target` one character at a time, independent of how the network
 * chunks arrive. Speeds up when it falls far behind so it never lags much.
 */
export function useTypewriter(target, active) {
  const [count, setCount] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (!active) {
      setCount(0);
      return;
    }
    let raf;
    const tick = () => {
      setCount((c) => {
        const backlog = targetRef.current.length - c;
        return backlog > 0 ? c + Math.max(1, Math.ceil(backlog / 40)) : c;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return { text: target.slice(0, count), caughtUp: count >= target.length };
}
