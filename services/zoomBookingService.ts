import { collection, addDoc, updateDoc, doc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import type { ZoomBooking, ZoomBookingCreateInput } from '../types/zoomBooking';

const COL = COLLECTIONS.ZOOM_BOOKINGS;

const MOCK_BOOKINGS: ZoomBooking[] = [
  {
    id: 'mock-1',
    memberId: 'mock-member',
    memberName: 'Test Member',
    memberEmail: 'test@jcikl.cc',
    topic: 'Mentor Session',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    duration: 60,
    zoomMeetingId: 123456789,
    zoomJoinUrl: 'https://zoom.us/j/123456789',
    zoomHostUrl: 'https://zoom.us/s/123456789',
    zoomPassword: 'abc123',
    alternativeHostSet: true,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
];

async function getIdToken(): Promise<string> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

export class ZoomBookingService {
  static async createBooking(
    input: ZoomBookingCreateInput,
    member: { id: string; name: string; email: string }
  ): Promise<ZoomBooking> {
    if (isDevMode()) {
      const mock: ZoomBooking = {
        id: `mock-${Date.now()}`,
        memberId: member.id,
        memberName: member.name,
        memberEmail: member.email,
        ...input,
        zoomMeetingId: Math.floor(Math.random() * 1e9),
        zoomJoinUrl: 'https://zoom.us/j/mock',
        zoomHostUrl: 'https://zoom.us/s/mock',
        zoomPassword: 'devmode',
        alternativeHostSet: false,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };
      return mock;
    }

    const token = await getIdToken();

    const res = await fetch('/.netlify/functions/zoom-create-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        topic: input.topic,
        startTime: input.startTime,
        duration: input.duration,
        alternativeHostEmail: member.email,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create Zoom meeting');
    }

    const zoom = await res.json();

    const docData = {
      memberId: member.id,
      memberName: member.name,
      memberEmail: member.email,
      topic: input.topic,
      startTime: input.startTime,
      duration: input.duration,
      zoomMeetingId: zoom.meetingId,
      zoomJoinUrl: zoom.joinUrl,
      zoomHostUrl: zoom.hostUrl,
      zoomPassword: zoom.password,
      alternativeHostSet: zoom.alternativeHostSet,
      status: 'confirmed' as const,
      createdAt: new Date().toISOString(),
    };

    const ref = await addDoc(collection(db, COL), docData);
    return { id: ref.id, ...docData };
  }

  static async cancelBooking(booking: ZoomBooking): Promise<void> {
    if (isDevMode()) return;

    const token = await getIdToken();

    await fetch('/.netlify/functions/zoom-cancel-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ meetingId: booking.zoomMeetingId }),
    });

    await updateDoc(doc(db, COL, booking.id), { status: 'cancelled' });
  }

  static async getMyBookings(memberId: string): Promise<ZoomBooking[]> {
    if (isDevMode()) return MOCK_BOOKINGS;

    const q = query(
      collection(db, COL),
      where('memberId', '==', memberId),
      orderBy('startTime', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ZoomBooking));
  }

  static async getAllBookings(): Promise<ZoomBooking[]> {
    if (isDevMode()) return MOCK_BOOKINGS;

    const q = query(collection(db, COL), orderBy('startTime', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ZoomBooking));
  }
}
