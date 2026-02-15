import React, { useState, useRef, useEffect } from 'react';
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
  Loader2,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Classroom, AttendanceStatus, Student } from '../types.ts';
import { supabase } from '../lib/supabase';

interface FilledByInfo {
  name: string;
  time: string;
}

interface AttendanceSheetProps {
  classroom: Classroom;
  userId?: string;
  userName?: string;
  onBack: () => void;
  onViewReport: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AttendanceSheet: React.FC<AttendanceSheetProps> = ({ classroom, userId, userName, onBack, onViewReport, showToast }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filledByInfo, setFilledByInfo] = useState<FilledByInfo | null>(null);

  // Date navigation state
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [datesWithAttendance, setDatesWithAttendance] = useState<Set<string>>(new Set());
  const calendarRef = useRef<HTMLDivElement>(null);

  const isToday = selectedDate === today;

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchStudents();
      await fetchExistingAttendance(selectedDate);
      setLoading(false);
    };
    init();
  }, [classroom, selectedDate]);

  // Fetch which dates have attendance for this classroom (for calendar dots)
  useEffect(() => {
    fetchDatesWithAttendance();
  }, [classroom, calendarMonth]);

  const fetchDatesWithAttendance = async () => {
    try {
      const year = calendarMonth.getFullYear();
      const month = calendarMonth.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('attendance')
        .select('date')
        .eq('classroom_id', classroom.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      if (data) {
        const dates = new Set(data.map((d: any) => d.date));
        setDatesWithAttendance(dates);
      }
    } catch (err) {
      console.error('Error fetching dates with attendance:', err);
    }
  };

  const fetchStudents = async () => {
    try {
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
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.first_name + ' ' + s.last_name)}&background=random&color=fff&rounded=true&bold=true`
      }));

      setStudents(mappedStudents);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const fetchExistingAttendance = async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*, profiles:created_by(full_name)')
        .eq('classroom_id', classroom.id)
        .eq('date', date);

      if (error) throw error;

      if (data && data.length > 0) {
        const attendanceMap: Record<string, AttendanceStatus> = {};
        const notesMap: Record<string, string> = {};

        data.forEach((record: any) => {
          attendanceMap[record.student_id] = record.status as AttendanceStatus;
          if (record.notes) {
            notesMap[record.student_id] = record.notes;
          }
        });

        setAttendance(attendanceMap);
        setNotes(notesMap);

        // Get who filled the attendance and when
        const firstRecord = data[0];
        if (firstRecord.created_by) {
          const profileName = firstRecord.profiles?.full_name || 'Docente desconocido';
          const createdAt = new Date(firstRecord.created_at);
          const timeStr = createdAt.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          setFilledByInfo({ name: profileName, time: timeStr });
        } else {
          setFilledByInfo(null);
        }
      } else {
        setAttendance({});
        setNotes({});
        setFilledByInfo(null);
      }
    } catch (err) {
      console.error('Error fetching existing attendance:', err);
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
      return;
    }

    try {
      setSaving(true);

      const records = Object.entries(attendance).map(([studentId, status]) => {
        const statusMap: Record<string, number> = {
          [AttendanceStatus.PRESENT]: 1,
          [AttendanceStatus.LATE]: 2,
          [AttendanceStatus.ABSENT]: 3,
          [AttendanceStatus.JUSTIFIED]: 4
        };

        return {
          student_id: studentId,
          classroom_id: classroom.id,
          date: selectedDate,
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

      // Update filled-by info after saving
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      setFilledByInfo({ name: userName || 'Docente', time: timeStr });

      // Update the dates set
      setDatesWithAttendance(prev => new Set([...prev, selectedDate]));

      if (showToast) showToast(
        isToday ? 'Asistencia guardada exitosamente' : `Asistencia del ${formatDateDisplay(selectedDate)} actualizada`,
        'success'
      );

      if (isToday) {
        onBack();
      }
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      if (showToast) showToast('Error al guardar asistencia: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Date navigation helpers
  const goToPreviousDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const newDate = d.toISOString().split('T')[0];
    // Don't go past today
    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(today);
    setCalendarMonth(new Date());
    setShowCalendar(false);
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(d);
  };

  // Calendar rendering helpers
  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month's trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        date: prevDate.toISOString().split('T')[0],
        day: d,
        isCurrentMonth: false
      });
    }

    // Current month's days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(year, month, d);
      days.push({
        date: dateObj.toISOString().split('T')[0],
        day: d,
        isCurrentMonth: true
      });
    }

    // Next month's leading days
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        date: nextDate.toISOString().split('T')[0],
        day: d,
        isCurrentMonth: false
      });
    }

    return days;
  };

  const calendarMonthLabel = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric'
  }).format(calendarMonth);

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
        <div className="max-w-5xl mx-auto flex flex-col gap-5">
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

            <div className="flex items-center gap-2">
              <button
                onClick={onViewReport}
                className="hidden sm:flex items-center gap-3 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:border-brand-celeste hover:text-brand-celeste transition-all shadow-sm"
              >
                Ver Reporte Bimestral
              </button>
            </div>
          </div>

          {/* Date Navigation Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Day-by-day arrows + current date display */}
              <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <button
                  onClick={goToPreviousDay}
                  className="p-3 text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 transition-all"
                  title="Día anterior"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="px-4 py-2.5 min-w-[140px] text-center">
                  <span className={`font-black text-sm whitespace-nowrap ${isToday ? 'text-slate-700' : 'text-brand-celeste'}`}>
                    {isToday ? 'Hoy' : formatDateDisplay(selectedDate)}
                  </span>
                </div>

                <button
                  onClick={goToNextDay}
                  disabled={isToday}
                  className={`p-3 transition-all ${isToday
                    ? 'text-slate-200 cursor-not-allowed'
                    : 'text-slate-400 hover:text-brand-celeste hover:bg-cyan-50'
                    }`}
                  title="Día siguiente"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* BIG Calendar Button */}
              <div className="relative" ref={calendarRef}>
                <button
                  onClick={() => {
                    setShowCalendar(!showCalendar);
                    // Sync calendar month to selected date when opening
                    if (!showCalendar) {
                      setCalendarMonth(new Date(selectedDate + 'T00:00:00'));
                    }
                  }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-black transition-all shadow-sm border ${showCalendar
                    ? 'bg-brand-celeste text-white border-brand-celeste shadow-lg shadow-cyan-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-celeste hover:text-brand-celeste hover:shadow-md'
                    }`}
                >
                  <Calendar size={20} />
                  <span>Elegir Fecha</span>
                </button>

                {/* Calendar Popup */}
                {showCalendar && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 z-50 w-[320px] animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                        className="p-2 text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 rounded-xl transition-all"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-black text-slate-700 capitalize">{calendarMonthLabel}</span>
                      <button
                        onClick={() => {
                          const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
                          const todayDate = new Date();
                          if (nextMonth <= new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0)) {
                            setCalendarMonth(nextMonth);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 rounded-xl transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(day => (
                        <div key={day} className="text-center text-[10px] font-black text-slate-300 py-1">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7 gap-1">
                      {getCalendarDays().map((dayInfo, idx) => {
                        const isSelected = dayInfo.date === selectedDate;
                        const isTodayDate = dayInfo.date === today;
                        const hasAttendance = datesWithAttendance.has(dayInfo.date);
                        const isFuture = dayInfo.date > today;
                        const isWeekend = new Date(dayInfo.date + 'T00:00:00').getDay() === 0 || new Date(dayInfo.date + 'T00:00:00').getDay() === 6;

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (!isFuture && dayInfo.isCurrentMonth) {
                                setSelectedDate(dayInfo.date);
                                setShowCalendar(false);
                              }
                            }}
                            disabled={isFuture || !dayInfo.isCurrentMonth}
                            className={`relative w-9 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${isSelected
                              ? 'bg-brand-celeste text-white shadow-lg shadow-cyan-200 scale-110'
                              : isTodayDate
                                ? 'bg-cyan-50 text-brand-celeste ring-2 ring-brand-celeste/30'
                                : !dayInfo.isCurrentMonth || isFuture
                                  ? 'text-slate-200 cursor-not-allowed'
                                  : isWeekend
                                    ? 'text-slate-300 hover:bg-slate-50'
                                    : 'text-slate-600 hover:bg-cyan-50 hover:text-brand-celeste'
                              }`}
                          >
                            {dayInfo.day}
                            {/* Dot indicator for dates with attendance */}
                            {hasAttendance && dayInfo.isCurrentMonth && !isSelected && (
                              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-[9px] font-bold text-slate-400">Con asistencia</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-cyan-50 ring-1 ring-brand-celeste/30" />
                        <span className="text-[9px] font-bold text-slate-400">Hoy</span>
                      </div>
                    </div>

                    {/* Quick nav buttons */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={goToToday}
                        className="flex-1 text-[11px] font-black text-brand-celeste bg-cyan-50 px-3 py-2.5 rounded-xl hover:bg-brand-celeste hover:text-white transition-all"
                      >
                        Ir a Hoy
                      </button>
                      <button
                        onClick={() => setShowCalendar(false)}
                        className="text-[11px] font-black text-slate-400 bg-slate-50 px-3 py-2.5 rounded-xl hover:bg-slate-100 transition-all"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Today button when viewing a past date */}
              {!isToday && (
                <button
                  onClick={goToToday}
                  className="flex items-center gap-2 bg-brand-celeste/10 text-brand-celeste px-4 py-3 rounded-2xl text-xs font-black hover:bg-brand-celeste hover:text-white transition-all"
                >
                  <CalendarCheck size={14} />
                  Volver a Hoy
                </button>
              )}
            </div>

            {/* Past date full-width indicator */}
            {!isToday && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px] font-black text-amber-600 tracking-wide">
                  VIENDO ASISTENCIA DEL {formatDateShort(selectedDate).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Progress bar & mark all */}
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

          {/* Filled-by info banner */}
          {filledByInfo && (
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl px-5 py-3 flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-8 h-8 bg-brand-celeste/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-brand-celeste" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-700 truncate">
                  Registrada por: <span className="text-brand-celeste">{filledByInfo.name}</span>
                </p>
                <p className="text-[10px] text-slate-400 font-bold">
                  Hora de registro: {filledByInfo.time}
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full tracking-wider">
                  COMPLETADA
                </span>
              </div>
            </div>
          )}

          {/* No attendance for past date message */}
          {!isToday && !filledByInfo && Object.keys(attendance).length === 0 && !loading && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Info size={16} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-slate-700">
                  No se registró asistencia este día
                </p>
                <p className="text-[10px] text-slate-400 font-bold">
                  Puede registrar la asistencia retroactivamente si lo desea
                </p>
              </div>
            </div>
          )}
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
          className={`w-full py-5 rounded-[2rem] font-black text-sm tracking-[0.1em] shadow-2xl flex items-center justify-center gap-3 transition-all border-4 border-white disabled:opacity-70 disabled:cursor-not-allowed ${isToday
            ? 'bg-slate-800 text-white hover:bg-slate-900'
            : 'bg-gradient-to-r from-brand-celeste to-cyan-500 text-white hover:from-cyan-500 hover:to-brand-celeste'
            }`}
        >
          {saving ? (
            <Loader2 className="animate-spin text-white" size={20} />
          ) : (
            <CalendarCheck size={20} className={isToday ? 'text-brand-celeste' : 'text-white'} />
          )}
          {saving
            ? 'GUARDANDO...'
            : isToday
              ? 'FINALIZAR ASISTENCIA DE HOY'
              : `GUARDAR ASISTENCIA — ${formatDateDisplay(selectedDate).toUpperCase()}`
          }
        </button>
      </div>
    </div>
  );
};

export default AttendanceSheet;
