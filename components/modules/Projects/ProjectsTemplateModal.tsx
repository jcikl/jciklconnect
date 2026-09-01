import React from 'react';
import { Button, Modal } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import type { EventTemplate } from '../../../services/templatesService';

interface ProjectsTemplateModalProps {
  isOpen: boolean;
  selectedTemplate: EventTemplate | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

const EVENT_TYPE_OPTIONS = [
  { label: 'Meeting', value: 'Meeting' },
  { label: 'Training', value: 'Training' },
  { label: 'Social', value: 'Social' },
  { label: 'Project', value: 'Project' },
  { label: 'International', value: 'International' },
];

export const ProjectsTemplateModal: React.FC<ProjectsTemplateModalProps> = ({
  isOpen,
  selectedTemplate,
  onClose,
  onSubmit,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={selectedTemplate ? 'Edit Template' : 'Create Event Template'}
    size="lg"
    drawerOnMobile
    footer={
      <div className="flex gap-3 w-full">
        <Button className="flex-1" type="submit" form="create-template-form">
          {selectedTemplate ? 'Update Template' : 'Create Template'}
        </Button>
        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
      </div>
    }
  >
    <form id="create-template-form" onSubmit={onSubmit} className="space-y-4">
      <Input name="name" label="Template Name" placeholder="e.g. Monthly Networking Event" defaultValue={selectedTemplate?.name} required />
      <Textarea name="description" label="Description" placeholder="Template description..." defaultValue={selectedTemplate?.description} rows={3} />
      <Select name="type" label="Event Type" options={EVENT_TYPE_OPTIONS} defaultValue={selectedTemplate?.type} required />
      <div className="grid grid-cols-2 gap-4">
        <Input name="defaultBudget" label="Default Budget (RM)" type="number" step="0.01" defaultValue={selectedTemplate?.defaultBudget?.toString()} />
        <Input name="estimatedDuration" label="Estimated Duration (hours)" type="number" step="0.5" defaultValue={selectedTemplate?.estimatedDuration?.toString()} />
      </div>
      <Textarea name="checklist" label="Checklist (one item per line)" placeholder={`Venue booking\nCatering\nRegistration setup`} defaultValue={selectedTemplate?.checklist?.join('\n')} rows={4} helperText="Enter each checklist item on a new line" />
      <Textarea name="resources" label="Required Resources (one item per line)" placeholder={`Projector\nSound system\nTables`} defaultValue={selectedTemplate?.requiredResources?.join('\n')} rows={3} helperText="Enter each resource on a new line" />
    </form>
  </Modal>
);
