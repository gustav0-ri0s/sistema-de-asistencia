import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Classroom, StaffMember, Meeting } from '../types';
import {
    Calendar,
    ArrowLeft,
    Printer,
    Users,
    Search,
    Loader2,
    ChevronRight,
    TrendingUp,
    FileText
} from 'lucide-react';

interface MeetingReportsProps {
    user: StaffMember;
    onBack: () => void;
    onViewDetail: (meeting: Meeting) => void;
}

const MeetingReports: React.FC<MeetingReportsProps> = ({ user, onBack, onViewDetail }) => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMeetings();
    }, [user]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('meetings')
                .select(`
                    id,
                    title,
                    date,
                    classroom_id,
                    created_at,
                    classrooms (
                        name,
                        level
                    )
                `);

            if (user.role !== 'Administrador' && user.role !== 'Supervisor') {
                const assignedClassroomIds = user.assignments.map(a => a.classroomId).filter(Boolean);
                if (assignedClassroomIds.length > 0) {
                    query = query.in('classroom_id', assignedClassroomIds.map(id => parseInt(id!)));
                } else {
                    setMeetings([]);
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await query.order('date', { ascending: false });

            if (error) throw error;

            const meetingsWithCounts = await Promise.all(
                data.map(async (meeting: any) => {
                    const { count: attendanceCount } = await supabase
                        .from('meeting_attendance')
                        .select('*', { count: 'exact', head: true })
                        .eq('meeting_id', meeting.id);

                    const { count: totalStudents } = await supabase
                        .from('students')
                        .select('*', { count: 'exact', head: true })
                        .eq('classroom_id', meeting.classroom_id);

                    return {
                        id: meeting.id,
                        title: meeting.title,
                        date: meeting.date,
                        classroom_id: meeting.classroom_id,
                        classroom_name: meeting.classrooms?.name || 'Sin aula',
                        created_at: meeting.created_at,
                        attendance_count: attendanceCount || 0,
                        total_students: totalStudents || 0
                    };
                })
            );

            setMeetings(meetingsWithCounts);
        } catch (err) {
            console.error('Error fetching meetings for reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredMeetings = meetings.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.classroom_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 print:p-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div className="flex items-center gap-5">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-brand-celeste shadow-sm transition-all hover:bg-cyan-50"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Reportes de Reuniones</h2>
                        <p className="text-slate-400 text-sm font-medium tracking-tight flex items-center gap-2">
                            <Calendar size={14} />
                            Consolidado de asistencia de padres de familia
                        </p>
                    </div>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-3 px-7 py-4 bg-slate-800 text-white rounded-2xl text-xs font-black shadow-xl hover:bg-slate-900 transition-all tracking-widest"
                >
                    <Printer size={18} className="text-brand-celeste" />
                    IMPRIMIR REPORTE
                </button>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:flex flex-col items-center justify-center bg-slate-800 text-white py-10 px-8 mb-8 rounded-b-[2rem]">
                <h1 className="text-2xl font-black mb-1">I.E.P. VALORES Y CIENCIAS</h1>
                <h2 className="text-sm font-bold opacity-80 uppercase tracking-[0.2em]">Reporte Consolidado de Reuniones</h2>
                <p className="text-[10px] mt-2 opacity-60">Fecha de Emisión: {new Date().toLocaleDateString('es-PE')}</p>
            </div>

            {/* Search and Stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar reunión o aula..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-celeste outline-none shadow-sm transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-slate-50 shadow-sm text-slate-500 font-bold text-xs uppercase tracking-wider">
                    <FileText size={16} className="text-brand-celeste" />
                    Total Reuniones: {filteredMeetings.length}
                </div>
            </div>

            {/* Grid of Meeting Reports */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <Loader2 className="animate-spin text-brand-celeste" size={48} />
                    <p className="text-slate-400 font-bold">Cargando reportes...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMeetings.map((meeting) => {
                        const percentage = meeting.total_students > 0
                            ? Math.round((meeting.attendance_count / meeting.total_students) * 100)
                            : 0;

                        return (
                            <div
                                key={meeting.id}
                                onClick={() => onViewDetail(meeting)}
                                className="neumorphic-card bg-white rounded-[2rem] p-6 border border-slate-50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-brand-celeste uppercase tracking-widest">{meeting.classroom_name}</p>
                                        <h3 className="font-black text-slate-800 tracking-tight group-hover:text-brand-celeste transition-colors">{meeting.title}</h3>
                                    </div>
                                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-brand-celeste group-hover:text-white transition-all">
                                        <ChevronRight size={18} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider text-center">Asistentes</p>
                                        <div className="flex items-center justify-center gap-2">
                                            <Users size={14} className="text-slate-400" />
                                            <p className="text-lg font-black text-slate-700">{meeting.attendance_count}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider text-center">Cumplimiento</p>
                                        <div className="flex items-center justify-center gap-2">
                                            <TrendingUp size={14} className="text-emerald-500" />
                                            <p className={`text-lg font-black ${percentage >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                {percentage}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-2">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-tighter">
                                        <span>PROGRESO DE ASISTENCIA</span>
                                        <span>{meeting.attendance_count}/{meeting.total_students}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${percentage >= 80 ? 'bg-emerald-500' : 'bg-amber-400'
                                                }`}
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="mt-5 flex items-center justify-between text-[10px] font-black text-slate-300">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        {new Date(meeting.date + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && filteredMeetings.length === 0 && (
                <div className="flex flex-col items-center justify-center p-20 text-slate-300 text-center">
                    <Calendar size={64} className="mb-4 opacity-10" />
                    <p className="font-bold">No se encontraron reuniones registradas.</p>
                </div>
            )}
        </div>
    );
};

export default MeetingReports;
