import { useEffect, useRef } from 'react';

export function AnimatedNumber({ value }: { value: string | number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = ref.current?.animate(
      [
        { transform: 'translateY(-5px) scale(1.12)', opacity: 0.55 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    return () => animation?.cancel();
  }, [value]);
  return (
    <span className="animated-number" ref={ref}>
      {value}
    </span>
  );
}
