import React, { useState, useMemo } from 'react';
import { FileText, Plus, Edit, Trash2, Send, CheckCircle, XCircle, Clock, History, Users, Calendar, DollarSign, Target, Eye } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs, Pagination } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useActivityPlans } from '../../hooks/useActivityPlans';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ActivityPlan } from '../../services/activityPlansService';
import { formatDate } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';

export const ActivityPlansView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ActivityPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const { plans, loading, error, createPlan, updatePlan, submitPlan, reviewPlan, createNewVersion, deletePlan } = useActivityPlans();
  const { member } = useAuth();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();

  const canManage = isBoard || isAdmin;

  const filteredPlans = useMemo(() => {
    if (activeTab === 'all') return plans;
    return plans.filter(plan => {
      if (activeTab === 'draft') return plan.status === 'Draft';
      if (activeTab === 'submitted') return plan.status === 'Submitted' || plan.status === 'Under Review';
      if (activeTab === 'approved') return plan.status === 'Approved' || plan.status === 'Active';
      if (activeTab === 'rejected') return plan.status === 'Rejected';
      return true;
    });
  }, [plans, activeTab]);

  const paginatedPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPlans.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPlans, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) {
      showToast('Please login to create activity plans', 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const planData: Omit<ActivityPlan, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'submittedDate'> = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      type: formData.get('type') as any,
      proposedDate: formData.get('proposedDate') as string,
      proposedBudget: parseFloat(formData.get('proposedBudget') as string) || 0,
      objectives: formData.get('objectives') as string,
      expectedImpact: formData.get('expectedImpact') as string,
      targetAudience: formData.get('targetAudience') as string || undefined,
      resources: formData.get('resources') ? (formData.get('resources') as string).split(',').map(r => r.trim()) : undefined,
      timeline: formData.get('timeline') as string || undefined,
      status: 'Draft',
      submittedBy: member.name,
    };

    try {
      if (selectedPlan) {
        await updatePlan(selectedPlan.id!, planData);
      } else {
        await createPlan(planData);
      }
      setIsModalOpen(false);
      setSelectedPlan(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleSubmitForReview = async (planId: string) => {
    if (!member) {
      showToast('Please login to submit plans', 'error');
      return;
    }
    try {
      await submitPlan(planId, member.name);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlan || !member) return;

    const formData = new FormData(e.currentTarget);
    const decision = formData.get('decision') as 'Approved' | 'Rejected';
    const comments = formData.get('comments') as string;

    try {
      await reviewPlan(selectedPlan.id!, decision, member.name, comments);
      setIsReviewModalOpen(false);
      setSelectedPlan(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleCreateVersion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlan || !member) return;

    const formData = new FormData(e.currentTarget);
    const updates: Partial<ActivityPlan> = {
      title: formData.get('title') as string || selectedPlan.title,
      description: formData.get('description') as string || selectedPlan.description,
      proposedDate: formData.get('proposedDate') as string || selectedPlan.proposedDate,
      proposedBudget: parseFloat(formData.get('proposedBudget') as string) || selectedPlan.proposedBudget,
      objectives: formData.get('objectives') as string || selectedPlan.objectives,
      expectedImpact: formData.get('expectedImpact') as string || selectedPlan.expectedImpact,
    };

    try {
      await createNewVersion(selectedPlan.id!, updates, member.name);
      setIsVersionModalOpen(false);
      setSelectedPlan(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  const getStatusBadge = (status: ActivityPlan['status']) => {
    const variants: Record<ActivityPlan['status'], 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
      'Draft': 'neutral',
      'Submitted': 'info',
      'Under Review': 'warning',
      'Approved': 'success',
      'Rejected': 'error',
      'Active': 'success',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activity Plans</h2>
          <p className="text-slate-500">Propose, review, and manage activity plans.</p>
        </div>
        {member && (
          <Button onClick={() => {
            setSelectedPlan(null);
            setIsModalOpen(true);
          }}>
            <Plus size={16} className="mr-2" />
            Create Activity Plan
          </Button>
        )}
      </div>

      <Card noPadding>
        <div className="">
          <Tabs
            tabs={['All', 'Draft', 'Submitted', 'Approved', 'Rejected']}
            activeTab={
              activeTab === 'all' ? 'All' :
                activeTab === 'draft' ? 'Draft' :
                  activeTab === 'submitted' ? 'Submitted' :
                    activeTab === 'approved' ? 'Approved' : 'Rejected'
            }
            onTabChange={(tab) => {
              if (tab === 'All') setActiveTab('all');
              else if (tab === 'Draft') setActiveTab('draft');
              else if (tab === 'Submitted') setActiveTab('submitted');
              else if (tab === 'Approved') setActiveTab('approved');
              else setActiveTab('rejected');
              setCurrentPage(1);
            }}
            className="px-4 md:px-6"
          />
        </div>
        <div className="p-4">
          <LoadingState loading={loading} error={error} empty={filteredPlans.length === 0} emptyMessage="No activity plans found">
            <div className="space-y-4">
              {paginatedPlans.map(plan => (
                <Card key={plan.id} className="hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{plan.title}</h3>
                        {getStatusBadge(plan.status)}
                        {plan.version > 1 && (
                          <Badge variant="info">v{plan.version}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-4">{plan.description}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar size={16} />
                          <span>{formatDate(plan.proposedDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <DollarSign size={16} />
                          <span>{formatCurrency(plan.proposedBudget)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Target size={16} />
                          <span className="capitalize">{plan.type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Users size={16} />
                          <span>{plan.submittedBy}</span>
                        </div>
                      </div>

                      {plan.reviewComments && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">Review Comments:</p>
                          <p className="text-sm text-slate-700">{plan.reviewComments}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPlan(plan);
                          setIsModalOpen(true);
                        }}
                      >
                        <Eye size={14} />
                      </Button>
                      {plan.status === 'Draft' && member && plan.submittedBy === member.name && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubmitForReview(plan.id!)}
                          >
                            <Send size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPlan(plan);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit size={14} />
                          </Button>
                        </>
                      )}
                      {canManage && (plan.status === 'Submitted' || plan.status === 'Under Review') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPlan(plan);
                            setIsReviewModalOpen(true);
                          }}
                        >
                          <CheckCircle size={14} />
                        </Button>
                      )}
                      {plan.status === 'Rejected' && member && plan.submittedBy === member.name && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPlan(plan);
                            setIsVersionModalOpen(true);
                          }}
                        >
                          <History size={14} />
                        </Button>
                      )}
                      {member && plan.submittedBy === member.name && plan.status === 'Draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this activity plan?')) {
                              await deletePlan(plan.id!);
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredPlans.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </LoadingState>
        </div>
      </Card>

      {/* Create/Edit Activity Plan Modal */}
      <Modal
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPlan(null);
        }}
        title={selectedPlan ? 'Edit Activity Plan' : 'Create Activity Plan'}
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Title"
            placeholder="e.g. Summer Leadership Summit"
            defaultValue={selectedPlan?.title}
            required
          />
          <Textarea
            name="description"
            label="Description"
            placeholder="Detailed description of the activity plan..."
            defaultValue={selectedPlan?.description}
            rows={4}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="type"
              label="Type"
              defaultValue={selectedPlan?.type}
              options={[
                { label: 'Community', value: 'Community' },
                { label: 'Business', value: 'Business' },
                { label: 'Individual', value: 'Individual' },
                { label: 'International', value: 'International' },
              ]}
              required
            />
            <Input
              name="proposedDate"
              label="Proposed Date"
              type="date"
              defaultValue={selectedPlan?.proposedDate}
              required
            />
          </div>
          <Input
            name="proposedBudget"
            label="Proposed Budget (RM)"
            type="number"
            min="0"
            step="0.01"
            defaultValue={selectedPlan?.proposedBudget?.toString()}
            required
          />
          <Textarea
            name="objectives"
            label="Objectives"
            placeholder="What are the main objectives of this activity?"
            defaultValue={selectedPlan?.objectives}
            rows={3}
            required
          />
          <Textarea
            name="expectedImpact"
            label="Expected Impact"
            placeholder="What impact do you expect this activity to have?"
            defaultValue={selectedPlan?.expectedImpact}
            rows={3}
            required
          />
          <Input
            name="targetAudience"
            label="Target Audience (Optional)"
            placeholder="e.g. All Members, Board Members, etc."
            defaultValue={selectedPlan?.targetAudience}
          />
          <Input
            name="resources"
            label="Required Resources (Optional, comma-separated)"
            placeholder="e.g. Venue, Catering, Equipment"
            defaultValue={selectedPlan?.resources?.join(', ')}
          />
          <Textarea
            name="timeline"
            label="Timeline (Optional)"
            placeholder="Activity timeline and milestones..."
            defaultValue={selectedPlan?.timeline}
            rows={3}
          />
          <div className="flex gap-3 pt-4">
            <Button className="flex-1" type="submit">
              {selectedPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedPlan(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Review Modal */}
      {selectedPlan && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedPlan(null);
          }}
          title="Review Activity Plan"
          drawerOnMobile
        >
          <form onSubmit={handleReview} className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-900 mb-2">{selectedPlan.title}</h4>
              <p className="text-sm text-slate-600">{selectedPlan.description}</p>
            </div>
            <Select
              name="decision"
              label="Decision"
              options={[
                { label: 'Approve', value: 'Approved' },
                { label: 'Reject', value: 'Rejected' },
              ]}
              required
            />
            <Textarea
              name="comments"
              label="Review Comments"
              placeholder="Provide feedback and comments..."
              rows={4}
            />
            <div className="flex gap-3 pt-4">
              <Button className="flex-1" type="submit">
                Submit Review
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setSelectedPlan(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create New Version Modal */}
      {selectedPlan && (
        <Modal
          isOpen={isVersionModalOpen}
          onClose={() => {
            setIsVersionModalOpen(false);
            setSelectedPlan(null);
          }}
          title="Create New Version"
          drawerOnMobile
        >
          <form onSubmit={handleCreateVersion} className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Create a new version based on version {selectedPlan.version}. Update the fields below.
            </p>
            <Input
              name="title"
              label="Title"
              defaultValue={selectedPlan.title}
              required
            />
            <Textarea
              name="description"
              label="Description"
              defaultValue={selectedPlan.description}
              rows={4}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                name="proposedDate"
                label="Proposed Date"
                type="date"
                defaultValue={selectedPlan.proposedDate}
                required
              />
              <Input
                name="proposedBudget"
                label="Proposed Budget (RM)"
                type="number"
                min="0"
                step="0.01"
                defaultValue={selectedPlan.proposedBudget?.toString()}
                required
              />
            </div>
            <Textarea
              name="objectives"
              label="Objectives"
              defaultValue={selectedPlan.objectives}
              rows={3}
              required
            />
            <Textarea
              name="expectedImpact"
              label="Expected Impact"
              defaultValue={selectedPlan.expectedImpact}
              rows={3}
              required
            />
            <div className="flex gap-3 pt-4">
              <Button className="flex-1" type="submit">
                Create New Version
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsVersionModalOpen(false);
                  setSelectedPlan(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

