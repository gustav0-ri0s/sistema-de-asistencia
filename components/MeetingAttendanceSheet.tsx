import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft,
    Calendar,
    Check,
    Loader2,
    UserCheck,
    Save,
    User,
    ChevronLeft,
    ChevronRight,
    CalendarCheck,
    Info
} from 'lucide-react';
import { Classroom, Student } from '../types';
import { supabase } from '../lib/supabase';

interface MeetingAttendanceSheetProps {
    classroom: Classroom;
    meetingId: string;
    meetingTitle: string;
    onBack: () => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type FamilyMemberType = 'padre' | 'madre' | 'otro_familiar';

interface AttendanceRecord {
    studentId: string;
    attended: boolean;
    familyMember: FamilyMemberType;
    otherFamilyMemberName: string;
}

interface ActiveMeeting {
    id: string;
    title: string;
    date: string;
}

const MeetingAttendanceSheet: React.FC<MeetingAttendanceSheetProps> = ({
    classroom,
    meetingId: initialMeetingId,
    meetingTitle: initialMeetingTitle,
    onBack,
    showToast
}) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [activeMeeting, setActiveMeeting] = useState<ActiveMeeting | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Calendar state
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
    const [datesWithMeetings, setDatesWithMeetings] = useState<Set<string>>(new Set());
    const calendarRef = useRef<HTMLDivElement>(null);

    const isToday = selectedDate === today;

    // Load initial meeting and set date
    useEffect(() => {
        const init = async () => {
            if (initialMeetingId) {
                const { data } = await supabase
                    .from('meetings')
                    .select('id, title, date')
                    .eq('id', initialMeetingId)
                    .single();

                if (data) {
                    setActiveMeeting(data);
                    setSelectedDate(data.date);
                    setCalendarMonth(new Date(data.date + 'T00:00:00'));
                }
            }
        };
        init();
    }, [initialMeetingId]);

    // Fetch meeting for selected date
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await fetchStudents();

            // Look for meeting on this date
            const { data, error } = await supabase
                .from('meetings')
                .select('id, title, date')
                .eq('classroom_id', classroom.id)
                .eq('date', selectedDate)
                .maybeSingle();

            if (data) {
                setActiveMeeting(data);
                await fetchExistingAttendance(data.id);
            } else {
                setActiveMeeting(null);
                setAttendance({});
            }

            setLoading(false);
        };
        loadData();
    }, [classroom, selectedDate]);

    // Fetch which dates have meetings for this classroom
    useEffect(() => {
        fetchDatesWithMeetings();
    }, [classroom, calendarMonth]);

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

    const fetchDatesWithMeetings = async () => {
        try {
            const year = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth();
            const startDate = new Date(year, month, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('meetings')
                .select('date')
                .eq('classroom_id', classroom.id)
                .gte('date', startDate)
                .lte('date', endDate);

            if (error) throw error;

            if (data) {
                const dates = new Set(data.map((d: any) => d.date));
                setDatesWithMeetings(dates);
            }
        } catch (err) {
            console.error('Error fetching dates with meetings:', err);
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
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.first_name + ' ' + s.last_name.split(' ')[0])}&background=random&color=fff&rounded=true&bold=true`
            }));

            setStudents(mappedStudents);
        } catch (err) {
            console.error('Error fetching students:', err);
        }
    };

    const fetchExistingAttendance = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('meeting_attendance')
                .select('*')
                .eq('meeting_id', id);

            if (error) throw error;

            const attendanceMap: Record<string, AttendanceRecord> = {};
            data.forEach((record: any) => {
                attendanceMap[record.student_id] = {
                    studentId: record.student_id,
                    attended: true,
                    familyMember: record.family_member_type as FamilyMemberType,
                    otherFamilyMemberName: record.other_family_member_name || ''
                };
            });

            setAttendance(attendanceMap);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        }
    };

    const toggleAttendance = (studentId: string) => {
        if (!activeMeeting) return;
        setAttendance(prev => {
            const current = prev[studentId];
            if (current?.attended) {
                const newAttendance = { ...prev };
                delete newAttendance[studentId];
                return newAttendance;
            } else {
                return {
                    ...prev,
                    [studentId]: {
                        studentId,
                        attended: true,
                        familyMember: 'padre',
                        otherFamilyMemberName: ''
                    }
                };
            }
        });
    };

    const setFamilyMember = (studentId: string, type: FamilyMemberType) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { studentId, attended: true, otherFamilyMemberName: '' }),
                familyMember: type,
            }
        }));
    };

    const setOtherName = (studentId: string, name: string) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { studentId, attended: true, familyMember: 'otro_familiar' }),
                otherFamilyMemberName: name
            }
        }));
    };

    const saveAttendance = async () => {
        if (!activeMeeting) return;
        try {
            setSaving(true);

            // Delete existing records for this meeting to avoid conflicts
            await supabase
                .from('meeting_attendance')
                .delete()
                .eq('meeting_id', activeMeeting.id);

            // Prepare records
            const records = (Object.values(attendance) as AttendanceRecord[])
                .filter(record => record.attended)
                .map(record => ({
                    meeting_id: activeMeeting.id,
                    student_id: record.studentId,
                    family_member_type: record.familyMember,
                    other_family_member_name: record.familyMember === 'otro_familiar' ? record.otherFamilyMemberName : null,
                    attended_at: new Date().toISOString()
                }));

            if (records.length > 0) {
                const { error } = await supabase
                    .from('meeting_attendance')
                    .insert(records);

                if (error) throw error;
            }

            showToast('Asistencia de reunión guardada exitosamente', 'success');
            if (isToday) onBack();
        } catch (err: any) {
            console.error('Error saving attendance:', err);
            showToast('Error al guardar asistencia: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Helper functions for date/calendar
    const formatDateDisplay = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const formatter = new Intl.DateTimeFormat('es-PE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        const formatted = formatter.format(date);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    const formatDateShort = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return new Intl.DateTimeFormat('es-PE', {
            day: 'numeric',
            month: 'short'
        }).format(date);
    }

    const goToPreviousDay = () => {
        const [y, m, d] = selectedDate.split('-');
        const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        current.setDate(current.getDate() - 1);
        setSelectedDate(current.toISOString().split('T')[0]);
    };

    const goToNextDay = () => {
        const [y, m, d] = selectedDate.split('-');
        const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        current.setDate(current.getDate() + 1);
        const nextDate = current.toISOString().split('T')[0];
        if (nextDate <= today) {
            setSelectedDate(nextDate);
        }
    };

    const goToToday = () => {
        setSelectedDate(today);
        setCalendarMonth(new Date());
    };

    const getCalendarDays = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();

        const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

        // Trailing days from prev month
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

        // Current month days
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateObj = new Date(year, month, d);
            days.push({
                date: dateObj.toISOString().split('T')[0],
                day: d,
                isCurrentMonth: true
            });
        }

        // Leading days for next month
        const remaining = 42 - days.length;
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

    const attendedCount = (Object.values(attendance) as AttendanceRecord[]).filter(a => a.attended).length;

    return (
        <div className="min-h-full bg-slate-50 flex flex-col pb-24 animate-in fade-in duration-300">
            {/* Dynamic Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-6 border-b border-slate-100">
                <div className="max-w-5xl mx-auto flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 transition-all shadow-sm"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-2xl font-black text-slate-800">{activeMeeting?.title || initialMeetingTitle}</h2>
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                        {classroom.name}
                                    </span>
                                </div>
                                <p className="text-xs text-brand-celeste font-bold tracking-widest uppercase flex items-center gap-2">
                                    <Calendar size={14} />
                                    Registro de Asistencia de Reunión
                                </p>
                            </div>
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
                                                    if (nextMonth <= new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)) {
                                                        setCalendarMonth(nextMonth);
                                                    }
                                                }}
                                                className="p-2 text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 rounded-xl transition-all"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-7 gap-1 mb-2">
                                            {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(day => (
                                                <div key={day} className="text-center text-[10px] font-black text-slate-300 py-1">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-7 gap-1">
                                            {getCalendarDays().map((dayInfo, idx) => {
                                                const isSelected = dayInfo.date === selectedDate;
                                                const isTodayDate = dayInfo.date === today;
                                                const hasMeeting = datesWithMeetings.has(dayInfo.date);
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
                                                        {hasMeeting && dayInfo.isCurrentMonth && !isSelected && (
                                                            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                                <span className="text-[9px] font-bold text-slate-400">Hay reunión</span>
                                            </div>
                                        </div>

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

                        {!isToday && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-[11px] font-black text-amber-600 tracking-wide">
                                    VIENDO REUNIÓN DEL {formatDateShort(selectedDate).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-fit">
                            <UserCheck size={16} className="text-emerald-500" />
                            <span className="text-xs font-black text-slate-500">
                                ASISTENCIAS: {attendedCount} / {students.length} FAMILIAS
                            </span>
                        </div>
                    </div>

                    {/* No meeting for past date message */}
                    {!activeMeeting && !loading && (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 animate-in fade-in duration-300">
                            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Info size={16} className="text-amber-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black text-slate-700">
                                    No hay reunión programada para este día
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold">
                                    Cree una nueva reunión en el módulo principal si desea registrar asistencia.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <Loader2 className="animate-spin text-brand-celeste" size={48} />
                        <p className="text-slate-400 font-bold">Cargando datos...</p>
                    </div>
                ) : !activeMeeting ? (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-300">
                        <Calendar size={64} className="mb-4 opacity-20" />
                        <p className="font-bold">Seleccione un día con reunión para ver o modificar</p>
                    </div>
                ) : (
                    students.map((student, idx) => {
                        const record = attendance[student.id];
                        const isAttended = record?.attended || false;

                        return (
                            <div
                                key={student.id}
                                className={`neumorphic-card rounded-3xl p-5 transition-all ${isAttended ? 'border-l-[6px] border-l-emerald-500 bg-white' : 'border-l-[6px] border-l-transparent'
                                    }`}
                            >
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="relative">
                                                <img
                                                    src={student.avatar}
                                                    className="w-14 h-14 rounded-2xl object-cover shadow-sm border-2 border-white"
                                                    alt=""
                                                />
                                                <div className="absolute -top-1 -left-1 w-6 h-6 bg-slate-800 text-white text-[10px] font-black flex items-center justify-center rounded-lg border-2 border-white">
                                                    {idx + 1}
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-slate-800 text-base leading-tight">{student.name}</h4>
                                                <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">DNI: {student.dni}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleAttendance(student.id)}
                                                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isAttended
                                                    ? 'bg-emerald-500 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-300 hover:text-slate-400'
                                                    }`}
                                            >
                                                <Check size={20} />
                                            </button>

                                            {isAttended && (
                                                <select
                                                    value={record.familyMember}
                                                    onChange={(e) => setFamilyMember(student.id, e.target.value as FamilyMemberType)}
                                                    className="px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-celeste outline-none text-sm font-bold text-slate-700 bg-white"
                                                >
                                                    <option value="padre">Padre</option>
                                                    <option value="madre">Madre</option>
                                                    <option value="otro_familiar">Otro Familiar</option>
                                                </select>
                                            )}
                                        </div>
                                    </div>

                                    {isAttended && record.familyMember === 'otro_familiar' && (
                                        <div className="pl-0 sm:pl-[4.5rem] animate-in slide-in-from-top-2">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                                    <User size={14} className="text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={record.otherFamilyMemberName}
                                                    onChange={(e) => setOtherName(student.id, e.target.value)}
                                                    placeholder="¿Quién asistió? (Ej: Abuela, Tío...)"
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-brand-celeste focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            {activeMeeting && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-xl z-50">
                    <button
                        onClick={saveAttendance}
                        disabled={saving}
                        className={`w-full py-5 rounded-[2rem] font-black text-sm tracking-[0.1em] shadow-2xl flex items-center justify-center gap-3 transition-all border-4 border-white disabled:opacity-70 ${isToday ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-gradient-to-r from-brand-celeste to-cyan-500 text-white'
                            }`}
                    >
                        {saving ? (
                            <Loader2 className="animate-spin text-white" size={20} />
                        ) : (
                            <Save size={20} className={isToday ? 'text-brand-celeste' : 'text-white'} />
                        )}
                        {saving ? 'GUARDANDO...' : isToday ? `GUARDAR ASISTENCIA DE REUNIÓN (${attendedCount})` : `GUARDAR ASISTENCIA — ${formatDateDisplay(selectedDate).toUpperCase()}`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MeetingAttendanceSheet;
