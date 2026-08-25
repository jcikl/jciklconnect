import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Modal, useToast } from '../../ui/Common';
import { usePermissions } from '../../../hooks/usePermissions';
import type { Event, EventRegistration, Member } from '../../../types';
import { EventBudgetService, type EventBudget, type BudgetItem } from '../../../services/eventBudgetService';
import { EventRegistrationService } from '../../../services/eventRegistrationService';
import { EventsService } from '../../../services/eventsService';
import { MembersService } from '../../../services/membersService';
import { FinanceService } from '../../../services/financeService';
import { formatCurrency } from '../../../utils/formatUtils';
import { formatDate } from '../../../utils/dateUtils';
import { EventStatsTab } from './EventStatsTab';
import { EventBudgetTab } from './EventBudgetTab';
import { AsyncErrorBoundary } from '../../ui/AsyncErrorBoundary';
import { EventBudgetEditModal } from './EventBudgetEditModal';
import type { EventAddParticipantFormData } from './EventAddParticipantForm';
import { EventCancelRegistrationConfirm } from './EventCancelRegistrationConfirm';
import { EventDetailHero } from './EventDetailHero';
import { EventDetailTabsNav, type EventDetailActiveTab } from './EventDetailTabsNav';
import { EventDetailsTab } from './EventDetailsTab';
import { EventDesktopInfoPanel } from './EventDesktopInfoPanel';
import { useEventDerivedDetails } from './useEventDerivedDetails';
import { EventFeedbackTab } from './EventFeedbackTab';
import { EventFeedbackModal } from './EventFeedbackModal';
import { EventMarkPaidModal } from './EventMarkPaidModal';
import { EventMobileRegistrationFooter } from './EventMobileRegistrationFooter';
import { EventQrCheckInModal } from './EventQrCheckInModal';
import { EventRegistrationFormModal, type RegistrationFormData } from './EventRegistrationFormModal';
import { EventRegisterButton } from './EventRegisterButton';
import { EventParticipantsTab } from './EventParticipantsTab';
import type { EventParticipantSubTab } from './EventParticipantsSubTabs';
import { getInitialsColor, getMemberAvatar, getMemberInitials } from './eventParticipantUtils';
import { useEventBoardRoles } from './useEventBoardRoles';
import { useEventFeedbackSummary } from './useEventFeedbackSummary';
import { useEventParticipations } from './useEventParticipations';
import { useEventRegistrationForm } from './useEventRegistrationForm';
import { useEventRegistrationStatus } from './useEventRegistrationStatus';
import { useFreshEvent } from './useFreshEvent';
export interface EventDetailModalProps {
  event: Event;
  onClose: () => void;
  onRegister: (formData: RegistrationFormData) => void;
  onCheckIn: () => void;
  onCancelRegistration?: (memberId: string, cancelledBy: string, cancelledByName: string, cancelledByRole: 'self' | 'admin' | 'board' | 'committee') => Promise<void>;
  member: any;
  members: Member[];
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onRegister,
  onCheckIn,
  onCancelRegistration,
  member,
  members,
}) => {
  const [activeTab, setActiveTab] = useState<EventDetailActiveTab>('details');
  const localEvent = useFreshEvent(event);
  const [updatingRegId, setUpdatingRegId] = useState<string | null>(null);
  const [markPaidReg, setMarkPaidReg] = useState<EventRegistration | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [participantSubTab, setParticipantSubTab] = useState<EventParticipantSubTab>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [addForm, setAddForm] = useState<EventAddParticipantFormData>({ dietary: 'normal', tshirtSize: '' });
  const [cancelConfirmReg, setCancelConfirmReg] = useState<EventRegistration | null>(null);
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const {
    participations,
    setParticipations,
    loadingParticipants,
    loadParticipations,
  } = useEventParticipations(event, showToast);
  const {
    eventFeedback,
    loadingFeedback,
    loadEventFeedback,
  } = useEventFeedbackSummary(event.id, showToast);
  const {
    myRegistration,
    setMyRegistration,
    setLocalRegistered,
    isRegistered,
    isSelfCancelled,
    canSelfCancel,
  } = useEventRegistrationStatus({
    event,
    member,
    canCancelRegistration: !!onCancelRegistration,
  });
  const {
    getBoardPosition,
    shortBoardPosition,
    isBoardMember,
    isDirector,
  } = useEventBoardRoles();
  const {
    showRegForm,
    isRegSubmitting,
    regForm,
    setRegForm,
    handleOpenRegForm,
    handleCloseRegForm,
    handleRegFormSubmit,
  } = useEventRegistrationForm({
    member,
    onRegister,
    onRegisteredOptimistic: () => setLocalRegistered(true),
  });

  const getBoardPos = getBoardPosition;
  const shortPos = shortBoardPosition;

  const nameInitials = getMemberInitials;
  const initialsColor = getInitialsColor;
  const memberAvatar = getMemberAvatar;

  const isCommitteeMember = useMemo(() => {
    if (!member) return false;
    if (isAdmin || isBoard) return true;
    if (event.organizerId === member.id) return true;
    return event.committee?.some(c => c.memberId === member.id) ?? false;
  }, [event.committee, event.organizerId, member, isAdmin, isBoard]);

  const availableTabs = useMemo(() => {
    const tabs = [{ id: 'Event Details', label: 'Details' }];
    if (isCommitteeMember) {
      tabs.push({ id: 'Participants', label: 'Participants' });
      tabs.push({ id: 'Stats', label: 'Stats' });
    }
    tabs.push({ id: 'Feedback', label: 'Feedback' });
    return tabs;
  }, [isCommitteeMember]);

  useEffect(() => {
    if (activeTab === 'feedback') {
      loadEventFeedback();
    } else if (activeTab === 'participants' || activeTab === 'stats') {
      loadParticipations();
    }
  }, [activeTab, event.id, loadEventFeedback, loadParticipations]);

  const handleRegister = () => {
    handleOpenRegForm();
  };

  const handleSelfCancel = async () => {
    if (!member || !onCancelRegistration) return;
    setLocalRegistered(false);
    setUpdatingRegId('self');
    try {
      await onCancelRegistration(member.id, member.id, (member.general?.name ?? member.general?.name) ?? member.id, 'self');
      setMyRegistration((prev) => prev ? { ...prev, status: 'cancelled', cancelledByRole: 'self' } : { id: '', eventId: event.id, memberId: member.id, status: 'cancelled', cancelledByRole: 'self', createdAt: new Date().toISOString() });
      showToast('Registration cancelled', 'success');
    } catch {
      setLocalRegistered(null);
      showToast('Cancellation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleAdminCancel = async (reg: EventRegistration) => {
    if (!member || !onCancelRegistration) return;
    setUpdatingRegId(reg.id);
    const role: 'admin' | 'board' | 'committee' = isAdmin ? 'admin' : isBoard ? 'board' : 'committee';
    try {
      await onCancelRegistration(reg.memberId, member.id, (member.general?.name ?? member.general?.name) ?? member.id, role);
      setParticipations((prev) =>
        prev.map((r) =>
          r.id === reg.id
            ? { ...r, status: 'cancelled' as const, cancelledByRole: role, cancelledByName: (member.general?.name ?? member.general?.name) ?? member.id, cancelledAt: new Date().toISOString() }
            : r
        )
      );
      // If the cancelled member is the current user, update the register button immediately
      if (reg.memberId === member.id) {
        setLocalRegistered(false);
        setMyRegistration((prev) => prev ? { ...prev, status: 'cancelled' as const, cancelledByRole: role } : prev);
      }
      showToast('Member registration cancelled', 'success');
    } catch {
      showToast('Cancellation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleAddParticipant = async () => {
    if (!addMemberId) return;
    setAddingParticipant(true);
    try {
      const added = members.find(m => m.id === addMemberId);
      await EventsService.registerForEvent(event.id, addMemberId, {
        memberName: added?.general?.name,
        registeredBy: member?.id,
        registeredByName: member?.general?.name ?? member?.id,
        dietary: addForm.dietary,
        tshirtSize: addForm.tshirtSize || undefined,
      });
      const profileUpdate: Record<string, unknown> = { dietaryPreference: addForm.dietary, 'general.dietaryPreference': addForm.dietary };
      if (addForm.tshirtSize) profileUpdate['others.tshirtSize'] = addForm.tshirtSize;
      MembersService.updateMember(addMemberId, profileUpdate as Parameters<typeof MembersService.updateMember>[1]).catch(() => {
        showToast('Member added, but failed to update their dietary/t-shirt preference — please update manually.', 'warning');
      });
      await loadParticipations();
      showToast(`${added?.general?.name ?? 'Member'} added`, 'success');
      setAddMemberId('');
      setAddForm({ dietary: 'normal', tshirtSize: '' });
      setShowAddParticipant(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add participant', 'error');
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleMarkPaid = (reg: EventRegistration) => {
    setMarkPaidReg(reg);
  };

  const handleConfirmMarkPaid = async (paymentMethod: 'bank_transfer' | 'cash') => {
    const reg = markPaidReg;
    if (!reg) return;
    setMarkPaidReg(null);
    setUpdatingRegId(reg.id);
    try {
      const now = new Date().toISOString();
      const actorName = member?.general?.name ?? member?.id ?? 'Admin';
      const today = now.split('T')[0];

      // Create income transaction (Pending) — only for paid events (amount > 0).
      // Let createTransaction throw so a DB failure aborts the whole operation
      // and EventReg is never left in 'paid' state without a finance record.
      let financeTransactionId: string | undefined;
      const amount = event?.price ?? 0;
      if (amount > 0) {
        financeTransactionId = await FinanceService.createTransaction({
          type: 'Income',
          category: 'Projects & Activities',
          status: 'Pending',
          paymentMethod,
          projectId: event?.id,
          memberId: reg.memberId,
          eventRegistrationId: reg.id,
          amount,
          description: `Event ticket — ${event?.title ?? reg.eventId}`,
          date: today,
          source: 'manual',
        } as Parameters<typeof FinanceService.createTransaction>[0]);
      }

      try {
        await EventRegistrationService.updateStatus(reg.id, 'paid', {
          paidAt: now,
          paidByName: actorName,
          paymentMethod,
          ...(financeTransactionId ? { financeTransactionId } : {}),
        });
      } catch (statusErr) {
        // Registration update failed — delete the finance transaction we just created
        // so we don't leave a dangling income record with no linked registration.
        if (financeTransactionId) {
          await FinanceService.deleteTransaction(financeTransactionId).catch(() => {});
        }
        throw statusErr;
      }
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: 'paid' as const, paidAt: now, paidByName: actorName, paymentMethod } : r)));
      showToast('Marked as paid', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleUndoPaid = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    const nextStatus = reg.status === 'checked_in' ? 'checked_in' : 'registered';
    try {
      // Guard: if the linked finance transaction has already cleared, abort early.
      if (reg.financeTransactionId) {
        const tx = await FinanceService.getTransactionById(reg.financeTransactionId);
        if (tx && (tx.status === 'Cleared' || tx.status === 'Reconciled' || tx.status === 'Partially Reconciled')) {
          showToast('Cannot undo — the linked transaction has already cleared/reconciled. Ask finance to void it first.', 'error');
          return;
        }
      }
      // Step 1: update registration status first so the record is always consistent.
      await EventRegistrationService.updateStatus(reg.id, nextStatus, { paidAt: null, paidByName: null, financeTransactionId: null });
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: nextStatus as EventRegistration['status'], paidAt: null, paidByName: null } : r)));
      // Step 2: delete the finance transaction. If this fails, registration is already corrected
      // — warn the user so finance can clean up manually rather than silently double-counting.
      if (reg.financeTransactionId) {
        try {
          await FinanceService.deleteTransaction(reg.financeTransactionId);
        } catch {
          showToast('Registration reverted, but finance transaction could not be deleted — please remove it manually.', 'warning');
        }
      }
      showToast('Payment reverted', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleMarkCheckedIn = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    try {
      const now = new Date().toISOString();
      const actorName = member?.general?.name ?? member?.id ?? 'Admin';
      await EventRegistrationService.updateStatus(reg.id, 'checked_in', { checkedInAt: now, checkedInByName: actorName });
      EventsService.invalidateEventsCache();
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: 'checked_in' as const, checkedInAt: now, checkedInByName: actorName } : r)));
      showToast('Marked as checked in', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleUndoCheckedIn = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    try {
      // P0 fix: call undoAttendance instead of bare updateStatus so that the batch
      // write (status revert + attendanceList removal) and points reversal all run.
      await EventsService.undoAttendance(reg.eventId, reg.memberId);
      EventsService.invalidateEventsCache();
      const prevStatus = reg.paidAt ? 'paid' : 'registered';
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: prevStatus as EventRegistration['status'], checkedInAt: null, checkedInByName: null } : r)));
      showToast('Check-in reverted', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };


  const {
    date,
    endDate,
    isMultiDay,
    formatDay,
    formatWeekday,
    eventTimeRange,
    formatDayShort,
    priceMin,
    priceMax,
    attendancePercent,
    isFull,
  } = useEventDerivedDetails(event, localEvent);

  const registerButton = (
    <EventRegisterButton
      status={event.status}
      isRegistered={!!isRegistered}
      canSelfCancel={canSelfCancel}
      isFull={isFull}
      onRegister={handleRegister}
      onSelfCancel={handleSelfCancel}
    />
  );

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={null}
        size="2xl"
        drawerOnMobile
        mobileHeight={isExpanded ? "h-screen" : "h-[85vh] md:h-auto"}
        scrollInBody={true}
        onScroll={(e) => {
          const scrollTop = e.currentTarget.scrollTop;
          if (scrollTop > 10 && !isExpanded) setIsExpanded(true);
          else if (scrollTop <= 0 && isExpanded) setIsExpanded(false);
        }}
        className="premium-event-modal"
        footerClassName="md:hidden flex-none px-5 py-4 bg-white border-t border-slate-100 z-30 pb-safe shadow-[0_-4px_16px_-2px_rgba(0,0,0,0.08)]"
        footer={activeTab === 'details' ? (
          <EventMobileRegistrationFooter
            priceMin={priceMin}
            priceMax={priceMax}
            registerButton={registerButton}
          />
        ) : null}
      >
        <div className="-m-4 md:-m-6 relative">
          <EventDetailHero event={event} onClose={onClose} />

          {/* Content — 2-col on desktop, single col on mobile */}
          <div className="relative bg-white rounded-t-[28px] md:rounded-none -mt-6 md:mt-0 md:grid md:grid-cols-[1fr_300px] md:gap-0">

            {/* Left column: tabs + tab content */}
            <div className="px-5 pt-5 pb-4 md:px-6 md:pt-6 md:pb-8 md:border-r md:border-slate-100">
              <EventDetailTabsNav
                tabs={availableTabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {activeTab === 'details' && (
                <EventDetailsTab
                  event={event}
                  localEvent={localEvent}
                  date={date}
                  endDate={endDate}
                  isMultiDay={isMultiDay}
                  eventTimeRange={eventTimeRange}
                  attendancePercent={attendancePercent}
                  descExpanded={descExpanded}
                  onDescExpandedChange={setDescExpanded}
                  formatDay={formatDay}
                  formatDayShort={formatDayShort}
                  formatWeekday={formatWeekday}
                />
              )}

              {activeTab === 'participants' && (
                <EventParticipantsTab
                  event={event}
                  member={member}
                  members={members}
                  participations={participations}
                  loadingParticipants={loadingParticipants}
                  participantSubTab={participantSubTab}
                  isCommitteeMember={isCommitteeMember}
                  showAddParticipant={showAddParticipant}
                  addMemberId={addMemberId}
                  addForm={addForm}
                  addingParticipant={addingParticipant}
                  updatingRegId={updatingRegId}
                  expandedRows={expandedRows}
                  canCancelRegistration={!!onCancelRegistration}
                  onTabChange={setParticipantSubTab}
                  onShowQr={() => setShowQrModal(true)}
                  onShowAddParticipant={() => setShowAddParticipant(true)}
                  onSetAddMemberId={setAddMemberId}
                  onSetAddForm={setAddForm}
                  onSetShowAddParticipant={setShowAddParticipant}
                  onAddParticipant={handleAddParticipant}
                  onSetUpdatingRegId={setUpdatingRegId}
                  onSetExpandedRows={setExpandedRows}
                  onSetParticipations={setParticipations}
                  onMarkPaid={handleMarkPaid}
                  onUndoPaid={handleUndoPaid}
                  onMarkCheckedIn={handleMarkCheckedIn}
                  onUndoCheckedIn={handleUndoCheckedIn}
                  onCancelRegistration={setCancelConfirmReg}
                  showToast={showToast}
                  getBoardPos={getBoardPos}
                  shortPos={shortPos}
                  isBoardMember={isBoardMember}
                  isDirector={isDirector}
                  nameInitials={nameInitials}
                  initialsColor={initialsColor}
                  memberAvatar={memberAvatar}
                />
              )}

              {activeTab === 'stats' && (
                <AsyncErrorBoundary>
                  <EventStatsTab participations={participations} members={members} showToast={showToast} />
                </AsyncErrorBoundary>
              )}

              {activeTab === 'feedback' && (
                <div className="animate-fade-in">
                  <AsyncErrorBoundary>
                    <EventFeedbackTab
                      event={event}
                      feedback={eventFeedback}
                      loading={loadingFeedback}
                      onRefresh={loadEventFeedback}
                      onSubmitFeedback={() => setIsFeedbackModalOpen(true)}
                    />
                  </AsyncErrorBoundary>
                </div>
              )}
            </div>

            <EventDesktopInfoPanel
              event={event}
              localEvent={localEvent}
              registerButton={registerButton}
              priceMin={priceMin}
              priceMax={priceMax}
              date={date}
              endDate={endDate}
              isMultiDay={isMultiDay}
              eventTimeRange={eventTimeRange}
              attendancePercent={attendancePercent}
              formatDay={formatDay}
              formatDayShort={formatDayShort}
              formatWeekday={formatWeekday}
            />
          </div>
        </div>
      </Modal>

      <EventQrCheckInModal
        isOpen={showQrModal}
        eventId={event.id}
        eventName={event.title}
        checkedInCount={participations.filter(r => r.status === 'checked_in').length}
        onClose={() => setShowQrModal(false)}
      />

      {isFeedbackModalOpen && (
        <EventFeedbackModal
          event={event}
          onClose={() => {
            setIsFeedbackModalOpen(false);
            loadEventFeedback();
          }}
        />
      )}

      <EventRegistrationFormModal
        isOpen={showRegForm}
        form={regForm}
        submitting={isRegSubmitting}
        onClose={handleCloseRegForm}
        onSubmit={handleRegFormSubmit}
        onFormChange={setRegForm}
      />

      <EventMarkPaidModal
        registration={markPaidReg}
        onClose={() => setMarkPaidReg(null)}
        onConfirm={handleConfirmMarkPaid}
      />

      <EventCancelRegistrationConfirm
        registration={cancelConfirmReg}
        onConfirm={(registration) => {
          setCancelConfirmReg(null);
          handleAdminCancel(registration);
        }}
        onCancel={() => setCancelConfirmReg(null)}
      />
    </>
  );
};

