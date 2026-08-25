import React from 'react';
import { CheckCircle, Edit, Plus, Wrench } from 'lucide-react';
import { Badge, Button, Card, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import type { InventoryItem, MaintenanceSchedule } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';

interface InventoryMaintenanceTabProps {
  schedules: MaintenanceSchedule[];
  items: InventoryItem[];
  members: any[];
  loading: boolean;
  onCompleteMaintenance: (scheduleId: string, notes?: string) => Promise<void>;
  onSelectSchedule: (schedule: MaintenanceSchedule) => void;
  onOpenModal: () => void;
  canOperateFinance: boolean;
}

export const InventoryMaintenanceTab: React.FC<InventoryMaintenanceTabProps> = ({
  schedules,
  items,
  members,
  loading,
  onCompleteMaintenance,
  onSelectSchedule,
  onOpenModal,
  canOperateFinance,
}) => {
  const { showToast } = useToast();

  const handleCompleteMaintenance = async (scheduleId: string) => {
    try {
      await onCompleteMaintenance(scheduleId);
      showToast('Maintenance completed', 'success');
    } catch (err) {
      showToast('Failed to complete maintenance', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">Maintenance Schedules</h3>
        {canOperateFinance && (
          <Button onClick={onOpenModal} size="sm">
            <Plus size={15} className="mr-1.5" />
            Schedule Maintenance
          </Button>
        )}
      </div>

      <LoadingState loading={loading} error={null} empty={schedules.length === 0} emptyMessage="No maintenance schedules">
        <div className="space-y-3">
          {schedules.map(schedule => {
            const scheduleId = schedule.id ?? `maint-${schedule.itemId}-${schedule.scheduledDate ?? ''}`;
            const item = items.find(i => i.id === schedule.itemId);
            const nextDate = schedule.nextMaintenanceDate ? new Date(schedule.nextMaintenanceDate) : null;
            const isOverdue = nextDate && nextDate < new Date();
            const daysUntil = nextDate ? Math.ceil((nextDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

            return (
              <Card key={scheduleId} className="hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench size={16} className="text-slate-400" />
                      <h4 className="font-semibold text-slate-900">{item?.name || 'Unknown Item'}</h4>
                      <Badge variant={isOverdue ? 'error' : daysUntil != null && daysUntil <= 7 ? 'warning' : 'info'}>
                        {schedule.type}{schedule.frequency ? ` - ${schedule.frequency}` : ''}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                      <div>
                        <span className="font-medium">Next Maintenance:</span>{' '}
                        {nextDate ? formatDate(nextDate) : 'Not scheduled'}
                        {daysUntil !== null && (
                          <span className={`ml-2 ${isOverdue ? 'text-red-600 font-semibold' : daysUntil <= 7 ? 'text-amber-600' : ''}`}>
                            ({isOverdue ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days`})
                          </span>
                        )}
                      </div>
                      {schedule.lastMaintained && (
                        <div>
                          <span className="font-medium">Last Maintained:</span>{' '}
                          {formatDate(new Date(schedule.lastMaintained))}
                        </div>
                      )}
                      {schedule.assignedTo && (
                        <div>
                          <span className="font-medium">Assigned To:</span>{' '}
                          {(members ?? []).find(m => m.id === schedule.assignedTo)?.name || schedule.assignedTo}
                        </div>
                      )}
                    </div>
                    {schedule.notes && (
                      <p className="text-sm text-slate-500 mt-2">{schedule.notes}</p>
                    )}
                  </div>
                  {canOperateFinance && (
                    <div className="flex gap-2 ml-4">
                      {!isOverdue && schedule.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCompleteMaintenance(schedule.id)}
                        >
                          <CheckCircle size={14} className="mr-1" />
                          Complete
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onSelectSchedule(schedule);
                          onOpenModal();
                        }}
                      >
                        <Edit size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </LoadingState>
    </div>
  );
};
