import React, { useMemo } from 'react';
import { CheckCircle, Clock, Copy, DollarSign, Edit, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button } from '../../ui/Common';
import { Select } from '../../ui/Form';
import { LoadingState } from '../../ui/Loading';
import { formatCurrency } from '../../../utils/formatUtils';
import type { EventTemplate } from '../../../services/templatesService';

interface ProjectsTemplatesTabProps {
  templates: EventTemplate[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  filterType: string;
  canManageTemplates: boolean;
  compact?: boolean;
  onSearchTermChange: (value: string) => void;
  onFilterTypeChange: (value: string) => void;
  onCreateTemplate: () => void;
  onPreviewTemplate: (template: EventTemplate) => void;
  onUseTemplate: (template: EventTemplate) => void;
  onEditTemplate: (template: EventTemplate) => void;
  onDeleteTemplate: (template: EventTemplate) => void;
}

const TEMPLATE_TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Meeting', value: 'Meeting' },
  { label: 'Training', value: 'Training' },
  { label: 'Social', value: 'Social' },
  { label: 'Project', value: 'Project' },
  { label: 'International', value: 'International' },
];

export const ProjectsTemplatesTab: React.FC<ProjectsTemplatesTabProps> = ({
  templates,
  loading,
  error,
  searchTerm,
  filterType,
  canManageTemplates,
  compact = false,
  onSearchTermChange,
  onFilterTypeChange,
  onCreateTemplate,
  onPreviewTemplate,
  onUseTemplate,
  onEditTemplate,
  onDeleteTemplate,
}) => {
  const filteredTemplates = useMemo(() => templates.filter(template => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      template.name.toLowerCase().includes(term) ||
      (template.description?.toLowerCase().includes(term) ?? false);
    const matchesType = filterType === 'all' || template.type === filterType;
    return matchesSearch && matchesType;
  }), [templates, searchTerm, filterType]);

  const renderTemplateRow = (template: EventTemplate) => (
    <div
      key={template.id}
      className={`${compact ? 'flex items-center gap-3 py-3 px-1' : 'flex items-center gap-4 px-2 py-3 hover:bg-slate-50/50 transition-colors group'}`}
    >
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 ${compact ? 'flex-wrap' : ''}`}>
          <p className={`font-semibold text-slate-900 text-sm ${compact ? '' : 'group-hover:text-jci-blue transition-colors'}`}>{template.name}</p>
          <Badge variant="neutral">{template.type}</Badge>
        </div>
        <div className={`flex items-center flex-wrap ${compact ? 'gap-2 mt-1' : 'gap-3 mt-0.5'}`}>
          {template.description && (
            <span className={`text-xs text-slate-400 line-clamp-1 ${compact ? 'basis-full mt-0.5' : 'max-w-xs'}`}>
              {template.description}
            </span>
          )}
          {template.estimatedDuration && (
            <span className={`inline-flex items-center gap-0.5 ${compact ? 'text-[10px] text-slate-500' : 'text-[11px] text-slate-400'}`}>
              <Clock size={compact ? 9 : 10} />{template.estimatedDuration}h
            </span>
          )}
          {template.defaultBudget && (
            <span className={`inline-flex items-center gap-0.5 ${compact ? 'text-[10px] text-slate-500' : 'text-[11px] text-slate-400'}`}>
              <DollarSign size={compact ? 9 : 10} />{formatCurrency(template.defaultBudget)}
            </span>
          )}
          {template.checklist?.length > 0 && (
            <span className={`inline-flex items-center gap-0.5 ${compact ? 'text-[10px] text-slate-500' : 'text-[11px] text-slate-400'}`}>
              <CheckCircle size={compact ? 9 : 10} />{template.checklist.length} tasks
            </span>
          )}
        </div>
      </div>
      <div className={`flex items-center gap-0.5 shrink-0 ${compact ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
        <Button variant="ghost" size="sm" onClick={() => onPreviewTemplate(template)} title="Preview"><Eye size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onUseTemplate(template)} title="Use"><Copy size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onEditTemplate(template)} title="Edit"><Edit size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onDeleteTemplate(template)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={14} /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jci-blue"
          />
        </div>
        <Select
          value={filterType}
          onChange={(event) => onFilterTypeChange(event.target.value)}
          options={TEMPLATE_TYPE_OPTIONS}
          className="w-48"
        />
      </div>
      <LoadingState loading={loading} error={error} empty={filteredTemplates.length === 0} emptyMessage="No templates found. Create your first template to get started.">
        <div className="divide-y divide-slate-100">
          {canManageTemplates && (
            <div
              onClick={onCreateTemplate}
              className={`flex items-center gap-3 ${compact ? 'px-1' : 'px-2'} py-3 text-slate-400 hover:text-jci-blue transition-colors cursor-pointer group`}
            >
              <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                <Plus size={16} />
              </div>
              <span className="text-sm font-semibold">New Template</span>
            </div>
          )}
          {filteredTemplates.map(renderTemplateRow)}
        </div>
      </LoadingState>
    </div>
  );
};
