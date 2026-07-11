import React from 'react';
import { MapPin, Clock, Users, DollarSign, CheckCircle, FileText, Copy } from 'lucide-react';
import { Modal, Button, Badge } from '../../ui/Common';
import { formatCurrency } from '../../../utils/formatUtils';
import { EventTemplate } from '../../../services/templatesService';

interface TemplatePreviewModalProps {
  template: EventTemplate;
  onClose: () => void;
  onUse: () => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ template, onClose, onUse }) => (
  <Modal
    isOpen={true}
    onClose={onClose}
    title={`Template Preview: ${template.name}`}
    size="lg"
    footer={
      <div className="flex gap-3 w-full">
        <Button onClick={onUse} className="flex-1"><Copy size={16} className="mr-2" />Use This Template</Button>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    }
  >
    <div className="space-y-6">
      <div>
        <Badge variant="neutral" className="mb-2">{template.type}</Badge>
        {template.description && <p className="text-slate-600">{template.description}</p>}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {template.defaultLocation && (
          <div className="flex items-start gap-2">
            <MapPin className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Default Location</div><div className="font-medium">{template.defaultLocation}</div></div>
          </div>
        )}
        {template.estimatedDuration && (
          <div className="flex items-start gap-2">
            <Clock className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Estimated Duration</div><div className="font-medium">{template.estimatedDuration} hours</div></div>
          </div>
        )}
        {template.defaultMaxAttendees && (
          <div className="flex items-start gap-2">
            <Users className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Max Attendees</div><div className="font-medium">{template.defaultMaxAttendees}</div></div>
          </div>
        )}
        {template.defaultBudget && (
          <div className="flex items-start gap-2">
            <DollarSign className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Default Budget</div><div className="font-medium">{formatCurrency(template.defaultBudget)}</div></div>
          </div>
        )}
      </div>
      {template.checklist && template.checklist.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2"><CheckCircle size={18} className="text-green-500" />Checklist ({template.checklist.length} items)</h4>
          <ul className="space-y-2">{template.checklist.map((item, i) => <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle size={16} className="text-slate-300 mt-0.5" /><span className="text-slate-700">{item}</span></li>)}</ul>
        </div>
      )}
      {template.requiredResources && template.requiredResources.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2"><FileText size={18} className="text-blue-500" />Required Resources ({template.requiredResources.length} items)</h4>
          <div className="flex flex-wrap gap-2">{template.requiredResources.map((r, i) => <Badge key={i} variant="neutral">{r}</Badge>)}</div>
        </div>
      )}
    </div>
  </Modal>
);
