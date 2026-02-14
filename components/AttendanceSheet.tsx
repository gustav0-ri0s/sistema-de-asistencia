import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  X as CloseIcon,
  MessageSquare,
  UserCheck,
  CalendarCheck,
  Info,
  MoreVertical,
  Loader2
} from 'lucide-react';
import { Classroom, AttendanceStatus, Student } from '../types.ts';
import { supabase } from '../lib/supabase';

interface AttendanceSheetProps {
  classroom: Classroom;
  userId?: string;
  onBack: () => void;
  onViewReport: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AttendanceSheet: React.FC<AttendanceSheetProps> = ({ classroom, userId, onBack, onViewReport, showToast }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    fetchStudents();
  }, [classroom]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('classroom_id', classroom.id)
        .order('last_name', { ascending: true });

      if (error) throw error;

      const mappedStudents: Student[] = data.map((s: any) => ({
        id: s.id,
        name: `${s.last_name}, ${s.first_name}`,
        dni: s.dni || '---',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}` // Use a stable avatar generator
      }));

      setStudents(mappedStudents);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (id: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [id]: status }));
  };

  const markAllPresent = () => {
    const newAttendance: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      newAttendance[s.id] = AttendanceStatus.PRESENT;
    });
    setAttendance(newAttendance);
  };

  const saveAttendance = async () => {
    if (Object.keys(attendance).length === 0) {
      if (showToast) showToast('Por favor, marque la asistencia de al menos un estudiante.', 'error');
      else alert('Por favor, marque la asistencia de al menos un estudiante.');
      return;
    }

    try {
      setSaving(true);
      const date = new Date().toISOString().split('T')[0];

      const records = Object.entries(attendance).map(([studentId, status]) => {
        // Map UI AttendanceStatus to DB type IDs
        const statusMap: Record<string, number> = {
          [AttendanceStatus.PRESENT]: 1,
          [AttendanceStatus.LATE]: 2,
          [AttendanceStatus.ABSENT]: 3,
          [AttendanceStatus.JUSTIFIED]: 4
        };

        return {
          student_id: studentId,
          classroom_id: classroom.id,
          date: date,
          status: status,
          attendance_type_id: statusMap[status as AttendanceStatus],
          notes: notes[studentId] || null,
          created_by: userId
        };
      });

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,date' });

      if (error) throw error;

      if (showToast) showToast('Asistencia guardada exitosamente', 'success');
      else alert('Asistencia guardada exitosamente');
      onBack();
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      if (showToast) showToast('Error al guardar asistencia: ' + err.message, 'error');
      else alert('Error al guardar asistencia: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusConfigs = [
    { type: AttendanceStatus.PRESENT, color: 'bg-emerald-500', icon: Check, label: 'P' },
    { type: AttendanceStatus.LATE, color: 'bg-amber-400', icon: Clock, label: 'T' },
    { type: AttendanceStatus.ABSENT, color: 'bg-rose-500', icon: CloseIcon, label: 'F' },
    { type: AttendanceStatus.JUSTIFIED, color: 'bg-slate-400', icon: Info, label: 'J' },
  ];

  return (
    <div className="min-h-full bg-slate-50 flex flex-col pb-24 animate-in fade-in duration-300">
      {/* Dynamic Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-6 border-b border-slate-100">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 transition-all shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-black text-slate-800">{classroom.name}</h2>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{classroom.level}</span>
                </div>
                <p className="text-xs text-brand-celeste font-bold tracking-widest uppercase flex items-center gap-2">
                  <CalendarCheck size={14} />
                  Registro de Asistencia Diaria
                </p>
              </div>
            </div>

            <button
              onClick={onViewReport}
              className="hidden sm:flex items-center gap-3 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:border-brand-celeste hover:text-brand-celeste transition-all shadow-sm"
            >
              Ver Reporte Bimestral
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="bg-slate-50 px-4 py-2 rounded-xl inline-flex items-center gap-2 border border-slate-100">
              <UserCheck size={16} className="text-emerald-500" />
              <span className="text-xs font-black text-slate-500">
                PROGRESO: {Object.keys(attendance).length} / {students.length} ALUMNOS
              </span>
            </div>
            <button
              onClick={markAllPresent}
              className="bg-brand-celeste text-white py-3 px-6 rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-cyan-100"
            >
              <Check size={18} />
              MARCAR TODOS COMO PRESENTE
            </button>
          </div>
        </div>
      </div>

      {/* List of Students */}
      <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="animate-spin text-brand-celeste" size={48} />
            <p className="text-slate-400 font-bold">Cargando alumnos...</p>
          </div>
        ) : students.map((student, idx) => {
          const currentStatus = attendance[student.id];
          return (
            <div
              key={student.id}
              className={`neumorphic-card rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-5 transition-all relative overflow-hidden group ${currentStatus ? 'border-l-[6px]' : 'border-l-[6px] border-l-transparent'
                } ${currentStatus === AttendanceStatus.PRESENT ? 'border-l-emerald-500' :
                  currentStatus === AttendanceStatus.LATE ? 'border-l-amber-400' :
                    currentStatus === AttendanceStatus.ABSENT ? 'border-l-rose-500' :
                      currentStatus === AttendanceStatus.JUSTIFIED ? 'border-l-slate-400' : ''
                }`}
            >
              <div className="flex items-center gap-5 flex-1">
                <div className="relative">
                  <img src={student.avatar} className="w-16 h-16 rounded-[1.5rem] object-cover shadow-md border-2 border-white" alt="" />
                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-800 text-white text-[10px] font-black flex items-center justify-center rounded-lg border-2 border-white">
                    {idx + 1}
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-slate-800 text-base mb-1 tracking-tight">{student.name}</h4>
                  <p className="text-[10px] text-slate-400 font-black tracking-widest">DNI: {student.dni}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-[1.25rem]">
                  {statusConfigs.map(cfg => (
                    <button
                      key={cfg.type}
                      onClick={() => setStatus(student.id, cfg.type)}
                      className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-all ${currentStatus === cfg.type
                        ? `${cfg.color} text-white shadow-lg scale-105`
                        : 'bg-white text-slate-300 hover:text-slate-500'
                        }`}
                    >
                      <cfg.icon size={16} className="mb-0.5" />
                      <span className="text-[8px] font-black">{cfg.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-brand-celeste transition-colors">
                    <MessageSquare size={18} />
                  </button>
                  <button className="p-3 text-slate-300 hover:text-slate-500 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Footer */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-xl z-50">
        <button
          onClick={saveAttendance}
          disabled={saving}
          className="w-full bg-slate-800 text-white py-5 rounded-[2rem] font-black text-sm tracking-[0.1em] shadow-2xl flex items-center justify-center gap-3 hover:bg-slate-900 transition-all border-4 border-white disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="animate-spin text-brand-celeste" size={20} />
          ) : (
            <CalendarCheck size={20} className="text-brand-celeste" />
          )}
          {saving ? 'GUARDANDO...' : 'FINALIZAR ASISTENCIA DE HOY'}
        </button>
      </div>
    </div>
  );
};

export default AttendanceSheet;
