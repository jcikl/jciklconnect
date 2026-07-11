import React, { useState } from 'react';
import { Modal, Button, useToast } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { Event } from '../../../types';
import { EventBudgetService, EventBudget, BudgetItem } from '../../../services/eventBudgetService';

interface EventBudgetEditModalProps {
  event: Event;
  budget: EventBudget | null;
  onClose: () => void;
}

export const EventBudgetEditModal: React.FC<EventBudgetEditModalProps> = ({
  event,
  budget,
  onClose,
}) => {
  const [allocatedBudget, setAllocatedBudget] = useState(budget?.allocatedBudget || 0);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(budget?.budgetItems || []);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await EventBudgetService.saveEventBudget({
        eventId: event.id,
        eventTitle: event.title,
        allocatedBudget,
        spent: budget?.spent || 0,
        income: budget?.income || 0,
        currency: 'USD',
        budgetItems,
        status: budget?.status || 'Draft',
      });
      showToast('Budget saved successfully', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to save budget', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit Budget: ${event.title}`} size="lg" drawerOnMobile>
      <div className="space-y-4">
        <Input
          label="Allocated Budget"
          type="number"
          step="0.01"
          value={allocatedBudget.toString()}
          onChange={(e) => setAllocatedBudget(parseFloat(e.target.value) || 0)}
          required
        />
        <div className="pt-4 flex gap-3">
          <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Budget'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};
