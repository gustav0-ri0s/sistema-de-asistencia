import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Calendar,
    Check,
    Loader2,
    UserCheck,
    Save,
    User
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

const MeetingAttendanceSheet: React.FC<MeetingAttendanceSheetProps> = ({
    classroom,
    meetingId,
    meetingTitle,
    onBack,
    showToast
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await fetchStudents();
            if (meetingId) {
                await fetchExistingAttendance(meetingId);
            }
            setLoading(false);
        };
        loadData();
    }, [classroom, meetingId]);

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
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`
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
                ...prev[studentId],
                attended: true,
                familyMember: type,
                otherFamilyMemberName: prev[studentId]?.otherFamilyMemberName || ''
            }
        }));
    };

    const setOtherName = (studentId: string, name: string) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                attended: true,
                otherFamilyMemberName: name
            }
        }));
    };

    const saveAttendance = async () => {
        try {
            setSaving(true);

            // Delete existing records to avoid conflicts
            await supabase
                .from('meeting_attendance')
                .delete()
                .eq('meeting_id', meetingId);

            // Prepare records
            const records = (Object.values(attendance) as AttendanceRecord[])
                .filter(record => record.attended)
                .map(record => ({
                    meeting_id: meetingId,
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

            showToast('Asistencia guardada exitosamente', 'success');
            onBack();
        } catch (err: any) {
            console.error('Error saving attendance:', err);
            showToast('Error al guardar asistencia: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const attendedCount = (Object.values(attendance) as AttendanceRecord[]).filter(a => a.attended).length;

    return (
        <div className="min-h-full bg-slate-50 flex flex-col pb-24 animate-in fade-in duration-300">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-6 border-b border-slate-100">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 transition-all shadow-sm"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-2xl font-black text-slate-800">{meetingTitle}</h2>
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                        {classroom.name}
                                    </span>
                                </div>
                                <p className="text-xs text-brand-celeste font-bold tracking-widest uppercase flex items-center gap-2">
                                    <Calendar size={14} />
                                    Registro de Asistencia
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-fit">
                        <UserCheck size={16} className="text-emerald-500" />
                        <span className="text-xs font-black text-slate-500">
                            ASISTENCIAS: {attendedCount} / {students.length} FAMILIAS
                        </span>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <Loader2 className="animate-spin text-brand-celeste" size={48} />
                        <p className="text-slate-400 font-bold">Cargando alumnos...</p>
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
                                        {/* Student */}
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
                                                <h4 className="font-bold text-slate-800 text-base leading-tight">{student.name}</h4>
                                                <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">DNI: {student.dni}</p>
                                            </div>
                                        </div>

                                        {/* Controls */}
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

                                    {/* Input for Other Familiar */}
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
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-xl z-50">
                <button
                    onClick={saveAttendance}
                    disabled={saving || attendedCount === 0}
                    className="w-full bg-slate-800 text-white py-5 rounded-[2rem] font-black text-sm tracking-[0.1em] shadow-2xl flex items-center justify-center gap-3 hover:bg-slate-900 transition-all border-4 border-white disabled:opacity-70"
                >
                    {saving ? (
                        <Loader2 className="animate-spin text-brand-celeste" size={20} />
                    ) : (
                        <Save size={20} className="text-brand-celeste" />
                    )}
                    {saving ? 'GUARDANDO...' : `GUARDAR ASISTENCIA DE REUNIÓN (${attendedCount})`}
                </button>
            </div>
        </div>
    );
};

export default MeetingAttendanceSheet;
