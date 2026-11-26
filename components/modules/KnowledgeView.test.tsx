import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ member: null }) }));
vi.mock('../../hooks/useKnowledge', () => ({ useKnowledge: vi.fn() }));
vi.mock('../../hooks/useLearningPaths', () => ({ useLearningPaths: vi.fn() }));
vi.mock('../../hooks/usePermissions', () => ({ usePermissions: vi.fn() }));
vi.mock('../../services/learningPathsService', () => ({ LearningPathsService: {} }));
vi.mock('../../services/documentsService', () => ({ DocumentsService: {} }));
vi.mock('../ui/Common', async importOriginal => ({
    ...await importOriginal<typeof import('../ui/Common')>(),
    useToast: () => ({ showToast: vi.fn() }),
    Drawer: () => null,
    ConfirmDialog: () => null,
}));

import { DocumentsTab } from './KnowledgeView';

const documents = [
    { id: 'sample-one', name: 'Meeting guide', purpose: 'Governance', currentVersion: { fileUrl: 'https://example.com/guide.pdf' } },
    { id: 'sample-two', name: 'Brand handbook', purpose: 'Brand assets', currentVersion: { fileUrl: 'javascript:alert(1)' } },
    { id: 'sample-three', name: 'Project checklist', purpose: 'Projects' },
];

describe('Document library', () => {
    it('shows only categories at the library entrance', () => {
        const html = renderToStaticMarkup(<DocumentsTab documents={documents} loading={false} canManage={false} onAdd={() => {}} />);
        expect(html).toContain('aria-label="Document categories"');
        expect(html).toContain('Governance');
        expect(html).toContain('Brand assets');
        expect(html).toContain('Projects');
        expect(html).not.toContain('Meeting guide');
        expect(html).not.toContain('aria-label="Files in category"');
        expect(html).not.toContain('Add file link');
    });
    it('retains the add link entry point for authorised users', () => {
        const html = renderToStaticMarkup(<DocumentsTab documents={documents} loading={false} canManage onAdd={() => {}} />);
        expect(html).toMatch(/<button[^>]*document-pos-create-tile[^>]*>[\s\S]*?Add file link<\/button>/);
    });
    it('uses global file search to find the matching categories', () => {
        const html = renderToStaticMarkup(<DocumentsTab documents={documents} searchQuery="MEETING" loading={false} canManage={false} />);
        expect(html).toContain('Governance');
        expect(html).not.toContain('Brand assets');
        expect(html).not.toContain('Projects');
        expect(html).not.toContain('Meeting guide');
    });
    it('distinguishes an empty library from a search without matches', () => {
        expect(renderToStaticMarkup(<DocumentsTab documents={[]} loading={false} canManage={false} />)).toContain('No files yet');
        expect(renderToStaticMarkup(<DocumentsTab documents={documents} searchQuery="no-match" loading={false} canManage={false} />)).toContain('No matching files');
    });
    it('renders a list-shaped loading state without interactive placeholders', () => {
        const html = renderToStaticMarkup(<DocumentsTab documents={[]} loading canManage={false} />);
        expect(html).toContain('role="status"');
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toMatch(/<(button|input|a)\b/);
    });
});
