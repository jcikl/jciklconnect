import React from 'react';
import { AlertCircle, Briefcase, Users } from 'lucide-react';
import { Badge, Button, Modal } from '../../ui/Common';
import { Input } from '../../ui/Form';
import type { ToyyibCategory } from '../../../services/toyyibService';

type LinkCategoryType = 'membership' | 'project';

interface ToyyibCategoryModalsProps {
  isImportModalOpen: boolean;
  importCode: string;
  isImporting: boolean;
  detailsCat: any | null;
  linkCat: ToyyibCategory | null;
  linkType: LinkCategoryType;
  linkMembershipType: string;
  linkProjectId: string;
  projects: { id: string; title: string }[];
  isSavingLink: boolean;
  onCloseImport: () => void;
  onImportCodeChange: (code: string) => void;
  onImport: () => void;
  onCloseDetails: () => void;
  onCloseLink: () => void;
  onLinkTypeChange: (type: LinkCategoryType) => void;
  onLinkMembershipTypeChange: (type: string) => void;
  onLinkProjectIdChange: (projectId: string) => void;
  onSaveLink: () => void;
}

const MEMBERSHIP_TYPES = ['Guest', 'Probation', 'Official', 'Honorary', 'Senator', 'Visiting', 'Associate'] as const;
const LINK_TYPES = ['membership', 'project'] as const;

export const ToyyibCategoryModals: React.FC<ToyyibCategoryModalsProps> = ({
  isImportModalOpen,
  importCode,
  isImporting,
  detailsCat,
  linkCat,
  linkType,
  linkMembershipType,
  linkProjectId,
  projects,
  isSavingLink,
  onCloseImport,
  onImportCodeChange,
  onImport,
  onCloseDetails,
  onCloseLink,
  onLinkTypeChange,
  onLinkMembershipTypeChange,
  onLinkProjectIdChange,
  onSaveLink,
}) => (
  <>
    <Modal isOpen={isImportModalOpen} onClose={onCloseImport} title="Import Existing Category">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          Enter the ToyyibPay category code to re-link it to this system. The category must already exist in your account.
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Category Code</label>
          <Input
            value={importCode}
            onChange={e => onImportCodeChange(e.target.value)}
            placeholder="e.g. 6x9mw99z"
            onKeyDown={e => e.key === 'Enter' && onImport()}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCloseImport}>Cancel</Button>
          <Button variant="primary" isLoading={isImporting} onClick={onImport}>Import</Button>
        </div>
      </div>
    </Modal>

    <Modal isOpen={!!detailsCat} onClose={onCloseDetails} title="Category Details">
      {detailsCat && (
        <div className="divide-y divide-slate-100 text-sm">
          {[
            ['Code', <span className="font-mono text-slate-700">{detailsCat.categoryCode}</span>],
            ['Name', <span className="font-semibold">{detailsCat.CategoryName || detailsCat.categoryName}</span>],
            ['Description', detailsCat.categoryDescription || detailsCat.CategoryDescription || '-'],
            ['Status', <Badge variant={detailsCat.categoryStatus === '1' ? 'success' : 'neutral'}>{detailsCat.categoryStatus === '1' ? 'Active' : 'Inactive'}</Badge>],
          ].map(([label, val]) => (
            <div key={String(label)} className="flex items-center justify-between gap-4 py-3">
              <span className="text-slate-400 text-xs font-medium flex-shrink-0">{label}</span>
              <span className="text-right">{val as React.ReactNode}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>

    <Modal isOpen={!!linkCat} onClose={onCloseLink} title={`Link Category: ${linkCat?.categoryName}`}>
      {linkCat && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {LINK_TYPES.map(type => (
              <button
                key={type}
                onClick={() => onLinkTypeChange(type)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${linkType === type
                  ? 'border-jci-blue bg-jci-blue/5 text-jci-blue'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
              >
                {type === 'membership' ? <><Users size={14} /> Membership</> : <><Briefcase size={14} /> Project</>}
              </button>
            ))}
          </div>

          {linkType === 'membership' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Membership Type</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                value={linkMembershipType}
                onChange={e => onLinkMembershipTypeChange(e.target.value)}
              >
                <option value="">- Select type -</option>
                {MEMBERSHIP_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">Amount auto-resolved from membership config</p>
            </div>
          )}

          {linkType === 'project' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Select Project</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                value={linkProjectId}
                onChange={e => onLinkProjectIdChange(e.target.value)}
              >
                <option value="">- Select project -</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              {projects.length === 0 && <p className="text-[11px] text-slate-400">No projects found</p>}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onCloseLink}>Cancel</Button>
            <Button variant="primary" isLoading={isSavingLink} onClick={onSaveLink}>Save Link</Button>
          </div>
        </div>
      )}
    </Modal>
  </>
);
