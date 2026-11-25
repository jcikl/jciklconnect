import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { GuestContentSkeleton, GuestRouteSkeleton } from './GuestPageFrame';

describe('public page loading accessibility', () => {
  it.each(['events', 'projects', 'board', 'publications', 'partners', 'introduction'] as const)('%s exposes one loading announcement and hides decorative placeholders', variant => {
    const html = renderToStaticMarkup(<GuestContentSkeleton variant={variant} label="Loading public content" />);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Loading public content');
    expect(html).not.toMatch(/<(?:button|input|a)\b/);
  });
  it.each(['events', 'projects', 'about', 'enewsletters', 'partnerships'] as const)('%s keeps navigation available during a lazy-route load', page => {
    const html = renderToStaticMarkup(<HelmetProvider><MemoryRouter initialEntries={['/' + page]}><GuestRouteSkeleton page={page} onLogin={() => {}} onRegister={() => {}} onPageChange={() => {}} /></MemoryRouter></HelmetProvider>);
    expect(html).toContain('id="main-content" aria-busy="true"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Login / Join Now');
    expect(html).toContain('href="/events"');
    expect(html).toContain('jci-kl-white.png');
    if (page === 'about') {
      expect(html).toContain('gp-loading-introduction');
      expect(html).not.toContain('gp-loading-board-levels');
    }
  });
});
