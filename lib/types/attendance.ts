export interface AttendanceDisciplineEvent {
  id?: string;
  points: number;
  reason: string;
  appliedBy?: string | null;
  appliedByName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AttendanceRule {
  id: string;
  sourceRuleId?: string | null;
  variantKind?: "declared" | "legacy_observed";
  name: string;
  category: "frequencia" | "participacao" | "espiritual" | "atividade";
  points: number;
}

export interface AttendanceStudentSummary {
  id: string;
  class_id: string;
  full_name: string;
  photo_url: string | null;
  birth_date: string | null;
  sex: "masculino" | "feminino" | null;
  guardian_name: string | null;
  whatsapp: string | null;
}

export interface AttendanceStudentListItem {
  full_name: string;
  student: AttendanceStudentSummary;
  initialSelectedRuleIds: string[];
  initialExtraActivityPoints: number;
  initialDisciplineEvents: AttendanceDisciplineEvent[];
  initialTotalPoints: number | null;
}
