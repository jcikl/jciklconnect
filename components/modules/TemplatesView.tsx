import React, { useState, useMemo } from 'react';
import { FileText, Plus, Edit, Trash2, Copy, Calendar, DollarSign, Target, CheckSquare, X } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useTemplates } from '../../hooks/useTemplates';
import { usePermissions } from '../../hooks/usePermissions';
import { EventTemplate, ActivityPlanTemplate, EventBudgetTemplate } from '../../services/templatesService';
import { formatDate } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';

export const TemplatesView: React.FC = () => {
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isActivityPlanModalOpen, setIsActivityPlanModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [selectedEventTemplate, setSelectedEventTemplate] = useState<EventTemplate | null>(null);
  const [selectedActivityPlanTemplate, setSelectedActivityPlanTemplate] = useState<ActivityPlanTemplate | null>(null);
  const [selectedBudgetTemplate, setSelectedBudgetTemplate] = useState<EventBudgetTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'activityPlans' | 'budgets'>('events');
  const {
    eventTemplates,
    activityPlanTemplates,
    eventBudgetTemplates,
    loading,
    error,
    createEventTemplate,
    updateEventTemplate,
    deleteEventTemplate,
    createActivityPlanTemplate,
    updateActivityPlanTemplate,
    deleteActivityPlanTemplate,
    createEventBudgetTemplate,
    updateEventBudgetTemplate,
    deleteEventBudgetTemplate,
  } = useTemplates();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();

  const canManage = isBoard || isAdmin;

  const handleEventTemplateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const templateData: Omit<EventTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      type: formData.get('type') as any,
      defaultLocation: formData.get('defaultLocation') as string || undefined,
      defaultMaxAttendees: formData.get('defaultMaxAttendees') ? parseInt(formData.get('defaultMaxAttendees') as string) : undefined,
      defaultBudget: formData.get('defaultBudget') ? parseFloat(formData.get('defaultBudget') as string) : undefined,
      checklist: formData.get('checklist') ? (formData.get('checklist') as string).split(',').map(s => s.trim()) : undefined,
      requiredResources: formData.get('requiredResources') ? (formData.get('requiredResources') as string).split(',').map(s => s.trim()) : undefined,
      estimatedDuration: formData.get('estimatedDuration') ? parseFloat(formData.get('estimatedDuration') as string) : undefined,
    };

    try {
      if (selectedEventTemplate) {
        await updateEventTemplate(selectedEventTemplate.id!, templateData);
      } else {
        await createEventTemplate(templateData);
      }
      setIsEventModalOpen(false);
      setSelectedEventTemplate(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleActivityPlanTemplateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const templateData: Omit<ActivityPlanTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      type: formData.get('type') as any,
      defaultObjectives: formData.get('defaultObjectives') as string || undefined,
      defaultExpectedImpact: formData.get('defaultExpectedImpact') as string || undefined,
      defaultResources: formData.get('defaultResources') ? (formData.get('defaultResources') as string).split(',').map(s => s.trim()) : undefined,
      defaultTimeline: formData.get('defaultTimeline') as string || undefined,
    };

    try {
      if (selectedActivityPlanTemplate) {
        await updateActivityPlanTemplate(selectedActivityPlanTemplate.id!, templateData);
      } else {
        await createActivityPlanTemplate(templateData);
      }
      setIsActivityPlanModalOpen(false);
      setSelectedActivityPlanTemplate(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleBudgetTemplateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBudgetTemplate && !e.currentTarget.querySelector('[name="budgetCategories"]')) {
      showToast('Please add at least one budget category', 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const categoriesJson = formData.get('budgetCategories') as string;
    let budgetCategories: Array<{ category: string; estimatedAmount: number; description?: string }> = [];

    try {
      budgetCategories = JSON.parse(categoriesJson || '[]');
    } catch {
      showToast('Invalid budget categories format', 'error');
      return;
    }

    const totalEstimatedBudget = budgetCategories.reduce((sum, cat) => sum + cat.estimatedAmount, 0);

    const templateData: Omit<EventBudgetTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      eventType: formData.get('eventType') as any || undefined,
      budgetCategories,
      totalEstimatedBudget,
    };

    try {
      if (selectedBudgetTemplate) {
        await updateEventBudgetTemplate(selectedBudgetTemplate.id!, templateData);
      } else {
        await createEventBudgetTemplate(templateData);
      }
      setIsBudgetModalOpen(false);
      setSelectedBudgetTemplate(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Templates</h2>
          <p className="text-slate-500">Manage reusable templates for events, activity plans, and budgets.</p>
        </div>
        {canManage && (
          <Button onClick={() => {
            if (activeTab === 'events') {
              setSelectedEventTemplate(null);
              setIsEventModalOpen(true);
            } else if (activeTab === 'activityPlans') {
              setSelectedActivityPlanTemplate(null);
              setIsActivityPlanModalOpen(true);
            } else {
              setSelectedBudgetTemplate(null);
              setIsBudgetModalOpen(true);
            }
          }}>
            <Plus size={16} className="mr-2" />
            Create Template
          </Button>
        )}
      </div>

      <Card noPadding>
        <div className="px-4 md:px-6 pt-4">
          <Tabs
            tabs={['Event Templates', 'Activity Plan Templates', 'Budget Templates']}
            activeTab={
              activeTab === 'events' ? 'Event Templates' :
                activeTab === 'activityPlans' ? 'Activity Plan Templates' :
                  'Budget Templates'
            }
            onTabChange={(tab) => {
              if (tab === 'Event Templates') setActiveTab('events');
              else if (tab === 'Activity Plan Templates') setActiveTab('activityPlans');
              else setActiveTab('budgets');
            }}
          />
        </div>
        <div className="p-4">
          {activeTab === 'events' && (
            <LoadingState loading={loading} error={error} empty={eventTemplates.length === 0} emptyMessage="No event templates found">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventTemplates.map(template => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 mb-1">{template.name}</h3>
                        <Badge variant="info">{template.type}</Badge>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEventTemplate(template);
                              setIsEventModalOpen(true);
                            }}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this template?')) {
                                await deleteEventTemplate(template.id!);
                              }
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                    )}
                    <div className="space-y-2 text-xs text-slate-500">
                      {template.defaultLocation && (
                        <div className="flex items-center gap-2">
                          <Calendar size={12} />
                          <span>{template.defaultLocation}</span>
                        </div>
                      )}
                      {template.defaultBudget && (
                        <div className="flex items-center gap-2">
                          <DollarSign size={12} />
                          <span>{formatCurrency(template.defaultBudget)}</span>
                        </div>
                      )}
                      {template.checklist && template.checklist.length > 0 && (
                        <div className="flex items-start gap-2">
                          <CheckSquare size={12} className="mt-0.5" />
                          <span>{template.checklist.length} checklist items</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          showToast('Template copied to clipboard', 'success');
                        }}
                      >
                        <Copy size={14} className="mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </LoadingState>
          )}

          {activeTab === 'activityPlans' && (
            <LoadingState loading={loading} error={error} empty={activityPlanTemplates.length === 0} emptyMessage="No activity plan templates found">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activityPlanTemplates.map(template => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 mb-1">{template.name}</h3>
                        <Badge variant="info">{template.type}</Badge>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedActivityPlanTemplate(template);
                              setIsActivityPlanModalOpen(true);
                            }}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this template?')) {
                                await deleteActivityPlanTemplate(template.id!);
                              }
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                    )}
                    {template.defaultObjectives && (
                      <div className="mb-2">
                        <p className="text-xs text-slate-500 mb-1">Objectives:</p>
                        <p className="text-sm text-slate-700">{template.defaultObjectives}</p>
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          showToast('Template copied to clipboard', 'success');
                        }}
                      >
                        <Copy size={14} className="mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </LoadingState>
          )}

          {activeTab === 'budgets' && (
            <LoadingState loading={loading} error={error} empty={eventBudgetTemplates.length === 0} emptyMessage="No budget templates found">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventBudgetTemplates.map(template => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 mb-1">{template.name}</h3>
                        {template.eventType && <Badge variant="info">{template.eventType}</Badge>}
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBudgetTemplate(template);
                              setIsBudgetModalOpen(true);
                            }}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this template?')) {
                                await deleteEventBudgetTemplate(template.id!);
                              }
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                    )}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Total Budget:</span>
                        <span className="font-bold text-slate-900">{formatCurrency(template.totalEstimatedBudget)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {template.budgetCategories.length} categories
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          showToast('Template copied to clipboard', 'success');
                        }}
                      >
                        <Copy size={14} className="mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </LoadingState>
          )}
        </div>
      </Card>

      {/* Event Template Modal */}
      <Modal
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEventTemplate(null);
        }}
        title={selectedEventTemplate ? 'Edit Event Template' : 'Create Event Template'}
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleEventTemplateSubmit} className="space-y-4">
          <Input
            name="name"
            label="Template Name"
            placeholder="e.g. Monthly Networking Event"
            defaultValue={selectedEventTemplate?.name}
            required
          />
          <Textarea
            name="description"
            label="Description"
            placeholder="Template description..."
            defaultValue={selectedEventTemplate?.description}
            rows={3}
          />
          <Select
            name="type"
            label="Event Type"
            defaultValue={selectedEventTemplate?.type}
            options={[
              { label: 'Meeting', value: 'Meeting' },
              { label: 'Training', value: 'Training' },
              { label: 'Social', value: 'Social' },
              { label: 'Project', value: 'Project' },
              { label: 'International', value: 'International' },
            ]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="defaultLocation"
              label="Default Location"
              placeholder="e.g. JCI KL Office"
              defaultValue={selectedEventTemplate?.defaultLocation}
            />
            <Input
              name="defaultMaxAttendees"
              label="Default Max Attendees"
              type="number"
              min="1"
              defaultValue={selectedEventTemplate?.defaultMaxAttendees?.toString()}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="defaultBudget"
              label="Default Budget (RM)"
              type="number"
              min="0"
              step="0.01"
              defaultValue={selectedEventTemplate?.defaultBudget?.toString()}
            />
            <Input
              name="estimatedDuration"
              label="Estimated Duration (hours)"
              type="number"
              min="0"
              step="0.5"
              defaultValue={selectedEventTemplate?.estimatedDuration?.toString()}
            />
          </div>
          <Input
            name="checklist"
            label="Checklist (comma-separated)"
            placeholder="e.g. Venue booking, Catering, Registration"
            defaultValue={selectedEventTemplate?.checklist?.join(', ')}
          />
          <Input
            name="requiredResources"
            label="Required Resources (comma-separated)"
            placeholder="e.g. Projector, Sound system, Tables"
            defaultValue={selectedEventTemplate?.requiredResources?.join(', ')}
          />
          <div className="flex gap-3 pt-4">
            <Button className="flex-1" type="submit">
              {selectedEventTemplate ? 'Update Template' : 'Create Template'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsEventModalOpen(false);
                setSelectedEventTemplate(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Activity Plan Template Modal */}
      <Modal
        onClose={() => {
          setIsActivityPlanModalOpen(false);
          setSelectedActivityPlanTemplate(null);
        }}
        title={selectedActivityPlanTemplate ? 'Edit Activity Plan Template' : 'Create Activity Plan Template'}
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleActivityPlanTemplateSubmit} className="space-y-4">
          <Input
            name="name"
            label="Template Name"
            placeholder="e.g. Community Service Project Template"
            defaultValue={selectedActivityPlanTemplate?.name}
            required
          />
          <Textarea
            name="description"
            label="Description"
            placeholder="Template description..."
            defaultValue={selectedActivityPlanTemplate?.description}
            rows={3}
          />
          <Select
            name="type"
            label="Activity Type"
            defaultValue={selectedActivityPlanTemplate?.type}
            options={[
              { label: 'Community', value: 'Community' },
              { label: 'Business', value: 'Business' },
              { label: 'Individual', value: 'Individual' },
              { label: 'International', value: 'International' },
            ]}
            required
          />
          <Textarea
            name="defaultObjectives"
            label="Default Objectives"
            placeholder="Default objectives for this activity type..."
            defaultValue={selectedActivityPlanTemplate?.defaultObjectives}
            rows={3}
          />
          <Textarea
            name="defaultExpectedImpact"
            label="Default Expected Impact"
            placeholder="Default expected impact..."
            defaultValue={selectedActivityPlanTemplate?.defaultExpectedImpact}
            rows={3}
          />
          <Input
            name="defaultResources"
            label="Default Resources (comma-separated)"
            placeholder="e.g. Venue, Volunteers, Materials"
            defaultValue={selectedActivityPlanTemplate?.defaultResources?.join(', ')}
          />
          <Textarea
            name="defaultTimeline"
            label="Default Timeline"
            placeholder="Default timeline and milestones..."
            defaultValue={selectedActivityPlanTemplate?.defaultTimeline}
            rows={3}
          />
          <div className="flex gap-3 pt-4">
            <Button className="flex-1" type="submit">
              {selectedActivityPlanTemplate ? 'Update Template' : 'Create Template'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsActivityPlanModalOpen(false);
                setSelectedActivityPlanTemplate(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Budget Template Modal */}
      <BudgetTemplateModal
        isOpen={isBudgetModalOpen}
        onClose={() => {
          setIsBudgetModalOpen(false);
          setSelectedBudgetTemplate(null);
        }}
        onSubmit={handleEventTemplateSubmit}
        drawerOnMobile
      />
    </div>
  );
};

// Budget Template Modal Component
interface BudgetTemplateModalProps {
  isOpen: boolean; // Added missing prop
  template: EventBudgetTemplate | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  drawerOnMobile?: boolean;
}

const BudgetTemplateModal: React.FC<BudgetTemplateModalProps> = ({ isOpen, onClose, template, onSubmit, drawerOnMobile }) => {
  const [categories, setCategories] = useState<Array<{ category: string; estimatedAmount: number; description?: string }>>(
    template?.budgetCategories || []
  );
  const [newCategory, setNewCategory] = useState({ category: '', estimatedAmount: 0, description: '' });

  React.useEffect(() => {
    if (template) {
      setCategories(template.budgetCategories);
    } else {
      setCategories([]);
    }
  }, [template]);

  const handleAddCategory = () => {
    if (newCategory.category && newCategory.estimatedAmount > 0) {
      setCategories([...categories, { ...newCategory, description: newCategory.description || undefined }]);
      setNewCategory({ category: '', estimatedAmount: 0, description: '' });
    }
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template ? 'Edit Budget Template' : 'Create Budget Template'}
      size="lg"
      drawerOnMobile={drawerOnMobile}
    >
      <form onSubmit={(e) => {
        const form = e.currentTarget;
        const categoriesInput = document.createElement('input');
        categoriesInput.type = 'hidden';
        categoriesInput.name = 'budgetCategories';
        categoriesInput.value = JSON.stringify(categories);
        form.appendChild(categoriesInput);
        onSubmit(e);
        form.removeChild(categoriesInput);
      }} className="space-y-4">
        <Input
          name="name"
          label="Template Name"
          placeholder="e.g. Standard Event Budget Template"
          defaultValue={template?.name}
          required
        />
        <Textarea
          name="description"
          label="Description"
          placeholder="Template description..."
          defaultValue={template?.description}
          rows={3}
        />
        <Select
          name="eventType"
          label="Event Type (Optional)"
          defaultValue={template?.eventType}
          options={[
            { label: 'None', value: '' },
            { label: 'Meeting', value: 'Meeting' },
            { label: 'Training', value: 'Training' },
            { label: 'Social', value: 'Social' },
            { label: 'Project', value: 'Project' },
            { label: 'International', value: 'International' },
          ]}
        />

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Budget Categories</label>
          {categories.map((cat, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{cat.category}</div>
                  {cat.description && (
                    <div className="text-sm text-slate-600 mt-1">{cat.description}</div>
                  )}
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    {formatCurrency(cat.estimatedAmount)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCategory(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={14} />
                </Button>
              </div>
            </Card>
          ))}

          <div className="border-t pt-3 space-y-2">
            <Input
              label="Category Name"
              value={newCategory.category}
              onChange={(e) => setNewCategory({ ...newCategory, category: e.target.value })}
              placeholder="e.g. Venue"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Estimated Amount (RM)"
                type="number"
                min="0"
                step="0.01"
                value={newCategory.estimatedAmount || ''}
                onChange={(e) => setNewCategory({ ...newCategory, estimatedAmount: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label="Description (Optional)"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Description"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddCategory}
              disabled={!newCategory.category || newCategory.estimatedAmount <= 0}
            >
              <Plus size={14} className="mr-2" />
              Add Category
            </Button>
          </div>

          {categories.length > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">Total Estimated Budget:</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(categories.reduce((sum, cat) => sum + cat.estimatedAmount, 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button className="flex-1" type="submit" disabled={categories.length === 0}>
            {template ? 'Update Template' : 'Create Template'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};

