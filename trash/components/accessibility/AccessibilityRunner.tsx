// AccessibilityRunner – runs axe-core in development, logs violations to console
// Only active when NODE_ENV=development and VITE_A11Y_SCAN=true
import React, { useEffect, useRef } from 'react';

const isDev = import.meta.env.DEV;
const enableScan = import.meta.env.VITE_A11Y_SCAN === 'true';

export const AccessibilityRunner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const runCount = useRef(0);

  useEffect(() => {
    if (!isDev || !enableScan || runCount.current > 0) return;
    runCount.current += 1;

    // Delay so axe runs after auth/async init and DOM has settled
    const t = setTimeout(() => {
    import('axe-core')
      .then((axe) => {
        const core = (axe as { default: typeof import('axe-core') }).default;
        core
          .run(document, { resultTypes: ['violations'] })
          .then((results) => {
            if (results.violations.length > 0) {
              console.group(
                `%c[A11y] ${results.violations.length} accessibility violation(s)`,
                'color: #c53030; font-weight: bold'
              );
              results.violations.forEach((v, i) => {
                console.groupCollapsed(`${i + 1}. ${v.id}: ${v.help}`);
                console.log('Impact:', v.impact);
                console.log('Description:', v.description);
                console.log('Help URL:', v.helpUrl);
                console.log('Nodes:', v.nodes?.map((n) => n.html).slice(0, 3));
                console.groupEnd();
              });
              console.groupEnd();
            } else {
              console.log('%c[A11y] No violations found', 'color: #38a169');
            }
          })
          .catch((err) => console.warn('[A11y] axe.run failed:', err));
      })
      .catch(() => {
        // axe-core not installed
      });
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return <>{children}</>;
};
