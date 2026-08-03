import { useState, useEffect, useCallback } from 'react';
import { ZoomBookingService } from '../services/zoomBookingService';
import type { ZoomBooking, ZoomBookingCreateInput } from '../types/zoomBooking';

export function useZoomBookings(memberId: string) {
  const [bookings, setBookings] = useState<ZoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await ZoomBookingService.getMyBookings(memberId));
      setError(null);
    } catch {
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { if (memberId) load(); }, [memberId, load]);

  const createBooking = async (
    input: ZoomBookingCreateInput,
    member: { id: string; name: string; email: string }
  ): Promise<ZoomBooking> => {
    const booking = await ZoomBookingService.createBooking(input, member);
    setBookings(prev => [booking, ...prev]);
    return booking;
  };

  const updateBooking = async (
    existing: ZoomBooking,
    input: import('../types/zoomBooking').ZoomBookingCreateInput,
    member: { id: string; name: string; email: string }
  ): Promise<ZoomBooking> => {
    const updated = await ZoomBookingService.updateBooking(existing, input, member);
    setBookings(prev => prev.map(b => b.id === existing.id ? updated : b));
    return updated;
  };

  const cancelBooking = async (booking: ZoomBooking) => {
    await ZoomBookingService.cancelBooking(booking);
    setBookings(prev =>
      prev.map(b => b.id === booking.id ? { ...b, status: 'cancelled' as const } : b)
    );
  };

  return { bookings, loading, error, createBooking, updateBooking, cancelBooking, reload: load };
}
