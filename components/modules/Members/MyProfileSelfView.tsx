import * as React from 'react';
import { useState, useEffect } from 'react';
import { CalendarCheck, UserCog } from 'lucide-react';
import { Button, Card, Badge, useToast } from '../../ui/Common';
import { Input, Textarea } from '../../ui/Form';
import type { Member } from '../../../types';
import type { EventRegistration } from '../../../types';
import type { Event } from '../../../types';
import { MEMBER_SELF_EDITABLE_FIELDS } from '../../../config/constants';
import { EventRegistrationService } from '../../../services/eventRegistrationService';
import { EventsService } from '../../../services/eventsService';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';

/** Dues status labels (Story 8.1) */
const DUES_STATUS_LABEL: Record<string, string> = { Paid: 'Paid', Pending: 'Pending', Overdue: 'Overdue' };

/** My Profile: Only shows self and allows editing MEMBER_SELF_EDITABLE_FIELDS (Story 1.3); Dues status and participation history (Story 8.1) */
export const MyProfileSelfView: React.FC<{ member: Member; onSave: (updates: Partial<Member>) => Promise<void> }> = ({ member, onSave }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [participations, setParticipations] = useState<EventRegistration[]>([]);
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, Event>>({});
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    MEMBER_SELF_EDITABLE_FIELDS.forEach((key) => {
      const v = (member as unknown as Record<string, unknown>)[key];
      init[key] = v != null ? String(v) : '';
    });
    return init;
  });

  const handleChange = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingExtra(true);
      try {
        const [regs, allEvents] = await Promise.all([
          EventRegistrationService.listByMember(member.id),
          EventsService.getAllEvents(),
        ]);
        if (cancelled) return;
        setParticipations(regs);
        setOrganizerEvents(allEvents.filter((e) => (e as Event).organizerId === member.id));
        const byId: Record<string, Event> = {};
        allEvents.forEach((e) => { byId[e.id] = e as Event; });
        setEventsById(byId);
      } catch {
        if (!cancelled) setParticipations([]);
        if (!cancelled) setOrganizerEvents([]);
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();
    return () => { cancelled = true; };
  }, [member.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Partial<Member> = {};
      MEMBER_SELF_EDITABLE_FIELDS.forEach((key) => {
        (updates as Record<string, unknown>)[key] = form[key]?.trim() || null;
      });
      await onSave(updates);
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const labels: Record<string, string> = {
    phone: 'Phone', alternatePhone: 'Alt Phone', email: 'Email', address: 'Address',
    linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', wechat: 'WeChat',
    emergencyContactName: 'Emergency Contact', emergencyContactPhone: 'Emergency Phone', emergencyContactRelationship: 'Relationship',
    cutStyle: 'Cut Style', tshirtSize: 'T-Shirt Size', jacketSize: 'Jacket Size', embroideredName: 'Embroidered Name',
  };

  const statusLabel = (s: string) => (s === 'registered' ? 'Registered' : s === 'paid' ? 'Paid' : 'Checked In');

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><span className="text-slate-500">Name</span><p className="font-medium">{member.name}</p></div>
          <div><span className="text-slate-500">Role</span><p className="font-medium">{member.role}</p></div>
          <div><span className="text-slate-500">Join date</span><p className="font-medium">{formatDateToDDMMMYYYY(member.joinDate)}</p></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {MEMBER_SELF_EDITABLE_FIELDS.map((key) => (
            <div key={key}>
              <label className="block text-sm text-slate-600 mb-1">{labels[key] ?? key}</label>
              {key === 'address' ? (
                <Textarea value={form[key] ?? ''} onChange={(e) => handleChange(key, e.target.value)} rows={2} />
              ) : (
                <Input value={form[key] ?? ''} onChange={(e) => handleChange(key, e.target.value)} />
              )}
            </div>
          ))}
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </form>
      </Card>

      {/* Story 8.1：会费状态与活动参与、筹委经历 */}
      <Card className="p-4">
        <h3 className="font-semibold text-slate-800 mb-4">Dues Status & Participation History</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-slate-500 text-sm">Dues Status ({new Date().getFullYear()})</span>
            <p className="font-medium capitalize">{member.membership?.[String(new Date().getFullYear())]?.status || 'pending'}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Total Paid This Year</span>
            <p className="font-medium">RM {member.membership?.[String(new Date().getFullYear())]?.amount || 0}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Last Payment Date</span>
            <p className="font-medium">{formatDateToDDMMMYYYY(member.membership?.[String(new Date().getFullYear())]?.paymentDate)}</p>
          </div>
        </div>
        {loadingExtra ? (
          <p className="text-slate-500 text-sm">Loading records...</p>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2"><CalendarCheck size={16} /> Activity Participation History</h4>
              {participations.length === 0 ? (
                <p className="text-slate-500 text-sm">No records found</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {participations.slice(0, 20).map((r) => (
                    <li key={r.id} className="py-2 flex justify-between items-center">
                      <span className="text-slate-700">{eventsById[r.eventId]?.title ?? r.eventId}</span>
                      <Badge variant={r.status === 'checked_in' ? 'success' : r.status === 'paid' ? 'warning' : 'neutral'}>{statusLabel(r.status)}</Badge>
                    </li>
                  ))}
                  {participations.length > 20 && <li className="py-2 text-slate-500">Total {participations.length}, showing latest 20</li>}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2"><UserCog size={16} /> Committee Experience</h4>
              {organizerEvents.length === 0 ? (
                <p className="text-slate-500 text-sm">No records found</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {organizerEvents.slice(0, 10).map((e) => (
                    <li key={e.id} className="py-2 text-slate-700">{e.title}（{e.date?.slice(0, 10)}）</li>
                  ))}
                  {organizerEvents.length > 10 && <li className="py-2 text-slate-500">Total {organizerEvents.length}, showing latest 10</li>}
                </ul>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
