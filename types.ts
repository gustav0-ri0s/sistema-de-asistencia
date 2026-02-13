
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  JUSTIFIED = 'JUSTIFIED'
}

export type Level = 'Inicial' | 'Primaria' | 'Secundaria';

export type UserRole = 'Administrador' | 'Docente' | 'Auxiliar' | 'Supervisor' | 'Secretaria';

export interface Student {
  id: string;
  name: string;
  dni: string;
  avatar: string;
}

export interface Classroom {
  id: string;
  name: string;
  level: Level;
  studentCount: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: UserRole;
  assignments: {
    level?: Level;
    classroomId?: string;
  }[];
}

export type ViewState =
  | 'DASHBOARD'
  | 'ATTENDANCE_SHEET'
  | 'REPORTS'
  | 'MANAGEMENT'
  | 'BIMESTER_REPORT'
  | 'CLASSROOM_REPORT_DETAIL';
