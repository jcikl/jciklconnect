export type ZoomBookingStatus = 'confirmed' | 'cancelled';

export interface ZoomBooking {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  topic: string;
  startTime: string;   // ISO 8601
  duration: number;    // minutes
  zoomMeetingId: number;
  zoomJoinUrl: string;
  zoomHostUrl: string;
  zoomPassword: string;
  alternativeHostSet: boolean;
  status: ZoomBookingStatus;
  createdAt: string;
}

export interface ZoomBookingCreateInput {
  topic: string;
  startTime: string;
  duration: number;
}
