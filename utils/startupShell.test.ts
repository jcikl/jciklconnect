import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
function boot(path: string, signedIn = false, storageFails = false) {
  const classes: string[] = [];
  const dataset: Record<string, string> = {};
  runInNewContext(script, {
    window: { location: { pathname: path } },
    document: { documentElement: { dataset, classList: { add: (name: string) => classes.push(name) } } },
    localStorage: { getItem: () => { if (storageFails) throw new Error('blocked'); return signedIn ? '1' : null; } },
  });
  return { dataset, classes };
}
describe('HTML startup shell', () => {
  it.each(['events', 'projects', 'about', 'enewsletters', 'partnerships'])('uses the %s layout before React loads', page => {
    expect(boot('/' + page).dataset.guestShellPage).toBe(page);
    expect(boot('/' + page + '/').dataset.guestShellPage).toBe(page);
  });
  it('retains the signed-in member shell hint', () => {
    expect(boot('/enewsletters', true).classes).toEqual(['si']);
  });
  it('still shows the guest shell when storage is unavailable', () => {
    expect(boot('/projects', false, true).classes).toEqual([]);
    expect(boot('/projects', false, true).dataset.guestShellPage).toBe('projects');
  });
  it('never uses arbitrary paths as markup or route tokens', () => {
    expect(boot('/private-example').dataset.guestShellPage).toBe('home');
  });
  it('uses the new guest palette and respects reduced motion', () => {
    expect(html).toContain('#hro{background:#f6f9fd');
    expect(html).not.toContain('#hro{background:linear-gradient');
    expect(html).toContain('@media(prefers-reduced-motion:reduce){#gsh');
  });
});
