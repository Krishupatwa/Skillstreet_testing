import { useEffect } from 'react';

export function useDynamicStyleSheet(href) {
  useEffect(() => {
    const existing = document.querySelector(`link[data-href="${href}"]`);
    if (existing) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-href', href);
    document.head.appendChild(link);

    return () => {
      const found = document.querySelector(`link[data-href="${href}"]`);
      if (found) {
        document.head.removeChild(found);
      }
    };
  }, [href]);
}
