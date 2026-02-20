// Events Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import { Event } from '../types';
import { EventRegistrationService } from './eventRegistrationService';
import { PointsService } from './pointsService';
import { isDevMode } from '../utils/devMode';
import { MOCK_EVENTS } from './mockData';

export class EventsService {
  private static mockEvents: Event[] = [...MOCK_EVENTS];

  private static projectDocToEvent(d: { id: string; data: () => Record<string, unknown> }): Event {
    const data = d.data() ?? {};
    // Use eventStartDate as primary date, fallback to date for backward compatibility
    const dateVal = data.eventStartDate ?? data.date;
    const dateStr = (dateVal && typeof dateVal === 'object' && 'toDate' in dateVal) 
      ? (dateVal as Timestamp).toDate().toISOString() 
      : (typeof dateVal === 'string' ? dateVal : '');
    const endDateVal = data.eventEndDate ?? data.endDate;
    const endDateStr = (endDateVal && typeof endDateVal === 'object' && 'toDate' in endDateVal)
      ? (endDateVal as Timestamp).toDate().toISOString()
      : (typeof endDateVal === 'string' ? endDateVal : undefined);
    // Use eventStartTime as primary time, fallback to time for backward compatibility
    const timeVal = data.eventStartTime ?? data.time;
    return {
      id: d.id,
      title: data.title ?? data.name ?? '',
      description: data.description ?? undefined,
      date: dateStr,
      endDate: endDateStr,
      time: timeVal ?? undefined,
      type: (data.eventType ?? data.type) ?? 'Meeting',
      attendees: data.attendees ?? 0,
      maxAttendees: data.maxAttendees ?? undefined,
      status: data.status ?? 'Upcoming',
      predictedDemand: data.predictedDemand ?? undefined,
      location: data.location ?? '',
      organizerId: data.organizerId ?? undefined,
      registeredMembers: data.registeredMembers as string[] ?? [],
      committee: data.committee as any[] ?? undefined,
    } as Event;
  }

  /** Approved projects with eventStartDate (for Event List: Upcoming + Completed) */
  static async getAllEvents(): Promise<Event[]> {
    if (isDevMode()) {
      return [...this.mockEvents];
    }

    try {
      // Only fetch projects with status='Active' (published by member)
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.PROJECTS),
          where('status', '==', 'Active')
        )
      );

      // Filter to ones that have an eventStartDate/date and map to Event
      const events = snapshot.docs
        .filter(d => {
          const data = d.data();
          return data.eventStartDate != null || data.date != null;
        })
        .map(d => this.projectDocToEvent({ id: d.id, data: () => d.data() }));

      // Sort in-memory by date descending so UI is stable
      return events.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
    } catch (error) {
      if (isDevMode()) {
        return [...this.mockEvents];
      }
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // Get event by ID (from projects collection)
  static async getEventById(eventId: string): Promise<Event | null> {
    if (isDevMode()) {
      return this.mockEvents.find(e => e.id === eventId) || null;
    }

    try {
      const docRef = doc(db, COLLECTIONS.PROJECTS, eventId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const d = docSnap.data();
        const hasDate = d?.eventStartDate != null || d?.date != null;
        const isBannedStatus = ['Planning', 'Draft', 'Submitted', 'Under Review', 'Rejected', 'Cancelled'].includes(d?.status);
        if (hasDate && !isBannedStatus) {
          return this.projectDocToEvent({ id: docSnap.id, data: () => d });
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  }

  // Create new event
  static async createEvent(eventData: Omit<Event, 'id'>): Promise<string> {
    if (isDevMode()) {
      const newId = `mock-event-${Date.now()}`;
      const newEvent: Event = {
        id: newId,
        ...eventData,
        attendees: 0,
        status: 'Upcoming',
      };
      this.mockEvents.unshift(newEvent);
      console.log(`[DEV MODE] Created event: ${newId}`);
      return newId;
    }

    try {
      const payload: Record<string, unknown> = {
        title: eventData.title,
        description: eventData.description ?? null,
        eventType: eventData.type,
        date: Timestamp.fromDate(new Date(eventData.date)),
        location: eventData.location,
        attendees: 0,
        status: 'Upcoming' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      if (eventData.maxAttendees != null) payload.maxAttendees = eventData.maxAttendees;
      if (eventData.endDate != null) payload.endDate = eventData.endDate;
      if (eventData.time != null) payload.time = eventData.time;
      if (eventData.organizerId != null && eventData.organizerId !== '') payload.organizerId = eventData.organizerId;
      if (eventData.predictedDemand != null) payload.predictedDemand = eventData.predictedDemand;
      payload.type = eventData.type;

      const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), payload);
      return docRef.id;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  // Update event
  static async updateEvent(eventId: string, updates: Partial<Event>): Promise<void> {
    if (isDevMode()) {
      const index = this.mockEvents.findIndex(e => e.id === eventId);
      if (index !== -1) {
        this.mockEvents[index] = { ...this.mockEvents[index], ...updates };
        console.log(`[DEV MODE] Updated event: ${eventId}`);
      }
      return;
    }

    try {
      const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
      const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) {
          if (k === 'type') updateData.eventType = v;
          else if (k === 'date') updateData.date = Timestamp.fromDate(new Date(v as string));
          else updateData[k] = v;
        }
      }

      await updateDoc(eventRef, updateData);
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  // Delete event
  static async deleteEvent(eventId: string): Promise<void> {
    if (isDevMode()) {
      this.mockEvents = this.mockEvents.filter(e => e.id !== eventId);
      return;
    }

    try {
      await deleteDoc(doc(db, COLLECTIONS.PROJECTS, eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  // Register member for event
  static async registerForEvent(eventId: string, memberId: string): Promise<void> {
    if (isDevMode()) {
      // In dev mode, just return without doing anything
      return;
    }

    try {
      const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
      const event = await this.getEventById(eventId);

      if (!event) throw new Error('Event not found');

      const existing = await EventRegistrationService.getByEventAndMember(eventId, memberId);
      if (existing) throw new Error('You have already registered for this event');

      if (event.maxAttendees && event.attendees >= event.maxAttendees) {
        throw new Error('Event is full');
      }

      // Add member to attendees list
      await updateDoc(eventRef, {
        attendees: event.attendees + 1,
        registeredMembers: arrayUnion(memberId),
      });
      // 报名/缴费/签到统一名单（Story 8.1）
      await EventRegistrationService.create(eventId, memberId, DEFAULT_LO_ID);
    } catch (error) {
      console.error('Error registering for event:', error);
      throw error;
    }
  }

  // Cancel event registration
  static async cancelRegistration(eventId: string, memberId: string): Promise<void> {
    try {
      const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
      const event = await this.getEventById(eventId);

      if (!event) throw new Error('Event not found');

      await updateDoc(eventRef, {
        attendees: Math.max(0, event.attendees - 1),
        registeredMembers: arrayRemove(memberId),
      });
    } catch (error) {
      console.error('Error canceling registration:', error);
      throw error;
    }
  }

  // Mark attendance (check-in)
  static async markAttendance(
    eventId: string,
    memberId: string,
    checkInTime?: Date
  ): Promise<void> {
    if (isDevMode()) {
      // In dev mode, just return without doing anything
      return;
    }

    try {
      const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
      const event = await this.getEventById(eventId);

      if (!event) throw new Error('Event not found');

      // Add to attendance list
      await updateDoc(eventRef, {
        attendanceList: arrayUnion({
          memberId,
          checkInTime: checkInTime ? Timestamp.fromDate(checkInTime) : Timestamp.now(),
        }),
      });
      // 报名/缴费/签到一致：更新 EventRegistration 为已签到（Story 8.1）
      const reg = await EventRegistrationService.getByEventAndMember(eventId, memberId);
      if (reg) {
        const at = (checkInTime ?? new Date()).toISOString();
        await EventRegistrationService.updateStatus(reg.id, 'checked_in', { checkedInAt: at });
      }

      // Award points for attendance
      await PointsService.awardEventAttendancePoints(
        memberId,
        eventId,
        event.type,
        undefined // Duration can be calculated later
      );
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  }

  // Get upcoming events (approved, date >= now)
  static async getUpcomingEvents(limitCount: number = 10): Promise<Event[]> {
    try {
      const allEvents = await this.getAllEvents();
      const now = new Date().getTime();
      return allEvents
        .filter(e => e.date && new Date(e.date).getTime() >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      throw error;
    }
  }

  // Get events by type
  static async getEventsByType(type: Event['type']): Promise<Event[]> {
    try {
      const allEvents = await this.getAllEvents();
      return allEvents.filter(e => e.type === type);
    } catch (error) {
      console.error('Error fetching events by type:', error);
      throw error;
    }
  }

  // Register guest for event (public registration)
  static async registerGuestForEvent(
    eventId: string,
    guestData: {
      name: string;
      email: string;
      phone: string;
      organization?: string;
      notes?: string;
    }
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Would register guest for event ${eventId}:`, guestData);
      return;
    }

    try {
      const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
      const event = await this.getEventById(eventId);

      if (!event) throw new Error('Event not found');

      // Check if event is full
      if (event.maxAttendees && event.attendees >= event.maxAttendees) {
        throw new Error('Event is full');
      }

      // Store guest registration in a separate collection (Firestore rejects undefined)
      const guestRegistration: Record<string, unknown> = {
        eventId,
        eventTitle: event.title,
        name: guestData.name,
        email: guestData.email,
        phone: guestData.phone,
        registeredAt: Timestamp.now(),
        status: 'Pending' as const,
      };
      if (guestData.organization != null) guestRegistration.organization = guestData.organization;
      if (guestData.notes != null) guestRegistration.notes = guestData.notes;

      await addDoc(collection(db, COLLECTIONS.GUEST_REGISTRATIONS || 'guestRegistrations'), guestRegistration);

      // Increment attendee count (or keep separate count for guests)
      await updateDoc(eventRef, {
        attendees: event.attendees + 1,
        guestRegistrations: arrayUnion({
          name: guestData.name,
          email: guestData.email,
          phone: guestData.phone,
          registeredAt: Timestamp.now(),
        }),
      });

      // Optionally send confirmation email
      const { EmailService } = await import('./emailService');
      await EmailService.sendEmail({
        to: guestData.email,
        subject: `Registration Confirmation: ${event.title}`,
        html: `
          <p>Dear ${guestData.name},</p>
          <p>Thank you for registering for "${event.title}".</p>
          <p><strong>Event Details:</strong></p>
          <ul>
            <li>Date: ${new Date(event.date).toLocaleString()}</li>
            <li>Location: ${event.location}</li>
          </ul>
          <p>We will contact you soon with more details.</p>
          <p>Best regards,<br>JCI Kuala Lumpur</p>
        `,
        text: `Thank you for registering for ${event.title}. We will contact you soon.`,
        tags: ['event-registration', 'guest'],
        metadata: { eventId, guestName: guestData.name },
      });
    } catch (error) {
      console.error('Error registering guest for event:', error);
      throw error;
    }
  }
}

