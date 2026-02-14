import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Calendar,
    Users,
    FileText,
    Loader2,
    Download,
    CheckCircle2,
    XCircle,
    Pencil
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Meeting {
    id: string;
    title: string;
    date: string;
    classroom_id: string;
    classroom_name: string;
    created_at: string;
    attendance_count: number;
    total_students: number;
}

interface AttendanceDetail {
    student_id: string;
    student_name: string;
    student_dni: string;
    family_member_type: 'padre' | 'madre' | 'otro_familiar' | null;
    attended_at: string | null;
}

interface MeetingDetailProps {
    meeting: Meeting;
    onBack: () => void;
    onEditAttendance: (meeting: Meeting) => void;
}

const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onBack, onEditAttendance }) => {
    const [attendanceDetails, setAttendanceDetails] = useState<AttendanceDetail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAttendanceDetails();
    }, [meeting.id]);

    const fetchAttendanceDetails = async () => {
        try {
            setLoading(true);

            // Get all students from the classroom
            const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('id, first_name, last_name, dni')
                .eq('classroom_id', meeting.classroom_id)
                .order('last_name', { ascending: true });

            if (studentsError) throw studentsError;

            // Get attendance records for this meeting
            const { data: attendance, error: attendanceError } = await supabase
                .from('meeting_attendance')
                .select('*')
                .eq('meeting_id', meeting.id);

            if (attendanceError) throw attendanceError;

            // Create attendance map
            const attendanceMap = new Map(
                attendance.map(a => [a.student_id, a])
            );

            // Combine data
            const details: AttendanceDetail[] = students.map((student: any) => {
                const attendanceRecord = attendanceMap.get(student.id);
                return {
                    student_id: student.id,
                    student_name: `${student.last_name}, ${student.first_name}`,
                    student_dni: student.dni || '---',
                    family_member_type: attendanceRecord?.family_member_type || null,
                    attended_at: attendanceRecord?.attended_at || null
                };
            });

            setAttendanceDetails(details);
        } catch (err) {
            console.error('Error fetching attendance details:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('es-PE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(new Date(dateString));
    };

    const getFamilyMemberLabel = (type: string | null) => {
        const labels: Record<string, string> = {
            'padre': 'Padre',
            'madre': 'Madre',
            'otro_familiar': 'Otro Familiar'
        };
        return type ? labels[type] : '-';
    };

    const getFamilyMemberColor = (type: string | null) => {
        const colors: Record<string, string> = {
            'padre': 'bg-blue-100 text-blue-700',
            'madre': 'bg-pink-100 text-pink-700',
            'otro_familiar': 'bg-purple-100 text-purple-700'
        };
        return type ? colors[type] : 'bg-slate-100 text-slate-400';
    };

    const attendedStudents = attendanceDetails.filter(a => a.attended_at);
    const absentStudents = attendanceDetails.filter(a => !a.attended_at);
    const attendanceRate = attendanceDetails.length > 0
        ? Math.round((attendedStudents.length / attendanceDetails.length) * 100)
        : 0;

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-full bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-brand-celeste" size={48} />
                    <p className="text-slate-400 font-bold">Cargando detalles...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-slate-50 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-6 py-6 print:border-0">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6 print:mb-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 transition-all shadow-sm print:hidden"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 mb-1">{meeting.title}</h1>
                                <p className="text-sm text-slate-500 font-medium">
                                    {meeting.classroom_name} • {formatDate(meeting.date)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 print:hidden">
                            <button
                                onClick={() => onEditAttendance(meeting)}
                                className="flex items-center gap-2 bg-brand-celeste/10 text-brand-celeste px-4 py-2 rounded-xl font-bold text-sm hover:bg-brand-celeste hover:text-white transition-all"
                            >
                                <Pencil size={18} />
                                Editar Asistencia
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-900 transition-all"
                            >
                                <Download size={18} />
                                Imprimir
                            </button>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-emerald-600 font-bold mb-1">Asistieron</p>
                                    <p className="text-2xl font-black text-emerald-700">{attendedStudents.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center text-white">
                                    <XCircle size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-rose-600 font-bold mb-1">Faltaron</p>
                                    <p className="text-2xl font-black text-rose-700">{absentStudents.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-brand-celeste/10 to-cyan-100 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-brand-celeste rounded-xl flex items-center justify-center text-white">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-cyan-600 font-bold mb-1">Porcentaje</p>
                                    <p className="text-2xl font-black text-cyan-700">{attendanceRate}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance List */}
            <div className="max-w-5xl mx-auto p-6">
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm print:shadow-none">
                    {/* Attended Students */}
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="text-emerald-500" size={20} />
                            Asistieron ({attendedStudents.length})
                        </h2>
                        <div className="space-y-3">
                            {attendedStudents.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No hay asistencias registradas</p>
                            ) : (
                                attendedStudents.map((detail, idx) => (
                                    <div
                                        key={detail.student_id}
                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 bg-slate-800 text-white text-xs font-black flex items-center justify-center rounded-lg">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{detail.student_name}</p>
                                                <p className="text-xs text-slate-500">DNI: {detail.student_dni}</p>
                                            </div>
                                        </div>
                                        <div className={`px-4 py-2 rounded-lg text-xs font-bold ${getFamilyMemberColor(detail.family_member_type)}`}>
                                            {getFamilyMemberLabel(detail.family_member_type)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Absent Students */}
                    <div className="p-6">
                        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <XCircle className="text-rose-500" size={20} />
                            Faltaron ({absentStudents.length})
                        </h2>
                        <div className="space-y-3">
                            {absentStudents.length === 0 ? (
                                <p className="text-sm text-emerald-600 italic font-medium">¡Todos asistieron!</p>
                            ) : (
                                absentStudents.map((detail, idx) => (
                                    <div
                                        key={detail.student_id}
                                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl opacity-60"
                                    >
                                        <div className="w-8 h-8 bg-slate-300 text-white text-xs font-black flex items-center justify-center rounded-lg">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-600">{detail.student_name}</p>
                                            <p className="text-xs text-slate-400">DNI: {detail.student_dni}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingDetail;
