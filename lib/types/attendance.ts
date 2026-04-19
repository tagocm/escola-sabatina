export interface AttendanceDisciplineEvent {
  id?: string;
  points: number;
  reason: string;
  appliedBy?: string | null;
  appliedByName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
