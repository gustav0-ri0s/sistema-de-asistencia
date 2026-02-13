
import { Classroom, Student, StaffMember } from './types.ts';

export const MOCK_CLASSROOMS: Classroom[] = [
  { id: '1', name: '3 años - Abejitas', level: 'Inicial', studentCount: 15 },
  { id: '2', name: '4 años - Delfines', level: 'Inicial', studentCount: 18 },
  { id: '3', name: '1ro Primaria A', level: 'Primaria', studentCount: 25 },
  { id: '4', name: '2do Primaria B', level: 'Primaria', studentCount: 22 },
  { id: '5', name: '5to Secundaria A', level: 'Secundaria', studentCount: 20 },
  { id: '6', name: '5to Secundaria B', level: 'Secundaria', studentCount: 18 },
];

export const MOCK_STAFF: StaffMember[] = [
  { id: 'T1', name: 'Rios Quevedo, Gustavo', role: 'Administrador', assignments: [] },
  { id: 'T2', name: 'Mendoza Paredes, Ana', role: 'Docente', assignments: [{ classroomId: '3' }] },
  { id: 'T3', name: 'Soto Lucas, Carlos', role: 'Auxiliar', assignments: [{ level: 'Inicial' }] },
];

export const MOCK_STUDENTS: Student[] = [
  { id: 'S1', name: 'Alvarez Quispe, Juan', dni: '72345678', avatar: 'https://picsum.photos/seed/s1/100' },
  { id: 'S2', name: 'Bellido Castro, Maria', dni: '74567890', avatar: 'https://picsum.photos/seed/s2/100' },
  { id: 'S3', name: 'Cardenas Ruiz, Carlos', dni: '75678901', avatar: 'https://picsum.photos/seed/s3/100' },
  { id: 'S4', name: 'Diaz Morales, Elena', dni: '76789012', avatar: 'https://picsum.photos/seed/s4/100' },
  { id: 'S5', name: 'Espinoza Vera, Roberto', dni: '77890123', avatar: 'https://picsum.photos/seed/s5/100' },
  { id: 'S6', name: 'Flores Luna, Sofia', dni: '78901234', avatar: 'https://picsum.photos/seed/s6/100' },
];

export const BIMESTERS = ['I Bimestre', 'II Bimestre', 'III Bimestre', 'IV Bimestre'];
