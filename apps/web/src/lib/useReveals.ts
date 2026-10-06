import { useEffect, useRef } from 'react';

const targets = [
  '.page-title',
  '.section-heading',
  '.venue-card',
  '.game-card',
  '.team-card',
  '.form-column > *',
  '.stats-grid > div',
  '.achievement-grid > div',
  '.profile-header',
  '.venue-detail-main > *',
  '.venue-games > *',
  '.countdown-panel',
  '.scoreboard',
  '.team-heading',
  '.member-row',
  '.match-chat',
  '.chat-message',
  '.game-info',
  '.host-controls',
  '.auth-form-wrap > *',
  '.admin-venue',
  '.admin-user',
  '.empty',
].join(',');

// Observe new route/query content once; live updates never restart existing cards.
export function useReveals() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const seen = new WeakSet<Element>();
    const running = new Set<Animation>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue;
          observer.unobserve(target);
          if (reduced.matches) continue;
          const siblings = target.parentElement?.children;
          const index = siblings ? Array.from(siblings).indexOf(target) : 0;
          const animation = target.animate(
            [
              { opacity: 0, transform: 'translateY(14px)' },
              { opacity: getComputedStyle(target).opacity, transform: 'translateY(0)' },
            ],
            {
              duration: 420,
              delay: Math.min(index * 45, 180),
              easing: 'cubic-bezier(.2,.8,.2,1)',
              fill: 'backwards',
            },
          );
          running.add(animation);
          void animation.finished.catch(() => {}).finally(() => running.delete(animation));
        }
      },
      { threshold: 0.08 },
    );
    const scan = (node: Element) => {
      const elements = [
        ...(node.matches(targets) ? [node] : []),
        ...node.querySelectorAll(targets),
      ];
      for (const element of elements) {
        if (seen.has(element)) continue;
        seen.add(element);
        if (!reduced.matches) observer.observe(element);
      }
    };
    scan(root);
    const changes = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof Element) scan(node);
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue;
          observer.unobserve(node);
          for (const child of node.querySelectorAll(targets)) observer.unobserve(child);
        }
      }
    });
    changes.observe(root, { childList: true, subtree: true });
    const stop = () => {
      if (reduced.matches) for (const animation of running) animation.cancel();
    };
    reduced.addEventListener('change', stop);
    return () => {
      observer.disconnect();
      changes.disconnect();
      reduced.removeEventListener('change', stop);
      for (const animation of running) animation.cancel();
    };
  }, []);
  return ref;
}
