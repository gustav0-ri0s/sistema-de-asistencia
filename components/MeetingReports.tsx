import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Classroom, StaffMember, Meeting, FamilyMemberType } from '../types';
import {
    Calendar,
    ArrowLeft,
    Printer,
    Users,
    Search,
    Loader2,
    ChevronRight,
    TrendingUp,
    FileText,
    Filter,
    PieChart,
    Building2,
    Award
} from 'lucide-react';

interface MeetingReportsProps {
    user: StaffMember;
    onBack: () => void;
    onViewDetail: (meeting: Meeting) => void;
}

interface ConsolidatedStats {
    totalMeetings: number;
    totalStudents: number;
    attendedCount: number;
    fatherCount: number;
    motherCount: number;
    bothCount: number;
    otherCount: number;
    attendancePercentage: number;
}

const MeetingReports: React.FC<MeetingReportsProps> = ({ user, onBack, onViewDetail }) => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'LIST' | 'CONSOLIDATED'>('LIST');

    // Filters for consolidated report
    const [filterLevel, setFilterLevel] = useState<string>('all');
    const [filterClassroom, setFilterClassroom] = useState<string>('all');
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [consolidatedStats, setConsolidatedStats] = useState<ConsolidatedStats | null>(null);

    useEffect(() => {
        fetchData();
    }, [user, filterLevel, filterClassroom]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([
            fetchMeetings(),
            fetchClassrooms()
        ]);
        setLoading(false);
    };

    const fetchClassrooms = async () => {
        try {
            let query = supabase.from('classrooms').select('*').eq('active', true);

            if (user.role !== 'Administrador' && user.role !== 'Supervisor') {
                const assignedIds = user.assignments.map(a => a.classroomId).filter(Boolean);
                if (assignedIds.length > 0) {
                    query = query.in('id', assignedIds.map(id => parseInt(id!)));
                } else {
                    setClassrooms([]);
                    return;
                }
            } else if (filterLevel !== 'all') {
                query = query.eq('level', filterLevel);
            }

            const { data, error } = await query.order('name', { ascending: true });
            if (error) throw error;
            setClassrooms(data.map((c: any) => ({
                id: c.id.toString(),
                name: c.name,
                level: c.level,
                studentCount: c.capacity || 0
            })));
        } catch (err) {
            console.error('Error fetching classrooms:', err);
        }
    };

    const fetchMeetings = async () => {
        try {
            let selectStr = `
                id,
                title,
                date,
                classroom_id,
                created_at,
                classrooms${filterLevel !== 'all' && (user.role === 'Administrador' || user.role === 'Supervisor') ? '!inner' : ''} (
                    id,
                    name,
                    level,
                    grade
                )
            `;

            let query = supabase
                .from('meetings')
                .select(selectStr);

            if (user.role !== 'Administrador' && user.role !== 'Supervisor') {
                const assignedClassroomIds = user.assignments.map(a => a.classroomId).filter(Boolean);
                if (assignedClassroomIds.length > 0) {
                    query = query.in('classroom_id', assignedClassroomIds.map(id => parseInt(id!)));
                } else {
                    setMeetings([]);
                    return;
                }
            } else {
                if (filterLevel !== 'all') {
                    query = query.eq('classrooms.level', filterLevel);
                }
                if (filterClassroom !== 'all') {
                    query = query.eq('classroom_id', parseInt(filterClassroom));
                }
            }

            const { data, error } = await query.order('date', { ascending: false });

            if (error) throw error;

            // Helper to handle the filtered data (if classroom level filter was applied joinedly)
            const filteredData = data.filter((m: any) => m.classrooms !== null);

            let totalAtt = 0;
            let totalStud = 0;
            let totalFathers = 0;
            let totalMothers = 0;
            let totalBoth = 0;
            let totalOthers = 0;

            const meetingsWithCounts = await Promise.all(
                filteredData.map(async (meeting: any) => {
                    const { data: attendanceData } = await supabase
                        .from('meeting_attendance')
                        .select('family_member_type')
                        .eq('meeting_id', meeting.id);

                    const { count: totalStudents } = await supabase
                        .from('students')
                        .select('*', { count: 'exact', head: true })
                        .eq('classroom_id', meeting.classroom_id);

                    const attData = attendanceData || [];
                    const attCount = attData.length;
                    const studCount = totalStudents || 0;

                    // Aggregate for consolidated
                    totalAtt += attCount;
                    totalStud += studCount;

                    attData.forEach((a: any) => {
                        if (a.family_member_type === 'padre') totalFathers++;
                        else if (a.family_member_type === 'madre') totalMothers++;
                        else if (a.family_member_type === 'ambos') totalBoth++;
                        else if (a.family_member_type === 'otro_familiar') totalOthers++;
                    });

                    return {
                        id: meeting.id,
                        title: meeting.title,
                        date: meeting.date,
                        classroom_id: meeting.classroom_id,
                        classroom_name: meeting.classrooms?.name || 'Sin aula',
                        created_at: meeting.created_at,
                        attendance_count: attCount,
                        total_students: studCount
                    };
                })
            );

            setMeetings(meetingsWithCounts);

            setConsolidatedStats({
                totalMeetings: filteredData.length,
                totalStudents: totalStud,
                attendedCount: totalAtt,
                fatherCount: totalFathers,
                motherCount: totalMothers,
                bothCount: totalBoth,
                otherCount: totalOthers,
                attendancePercentage: totalStud > 0 ? Math.round((totalAtt / totalStud) * 100) : 0
            });

        } catch (err) {
            console.error('Error fetching meetings for reports:', err);
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
                <div className="flex items-center gap-2">
                    <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-100 flex items-center">
                        <button
                            onClick={() => setView('LIST')}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${view === 'LIST' ? 'bg-white text-brand-celeste shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            REUNIONES
                        </button>
                        <button
                            onClick={() => setView('CONSOLIDATED')}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${view === 'CONSOLIDATED' ? 'bg-white text-brand-celeste shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            CONSOLIDADO
                        </button>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-3 px-6 py-4 bg-slate-800 text-white rounded-2xl text-[10px] font-black shadow-xl hover:bg-slate-900 transition-all tracking-widest"
                    >
                        <Printer size={18} className="text-brand-celeste" />
                        IMPRIMIR
                    </button>
                </div>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:flex flex-col items-center justify-center bg-slate-800 text-white py-10 px-8 mb-8 rounded-b-[2rem]">
                <h1 className="text-2xl font-black mb-1">I.E.P. VALORES Y CIENCIAS</h1>
                <h2 className="text-sm font-bold opacity-80 uppercase tracking-[0.2em]">Reporte Consolidado de Reuniones</h2>
                <div className="flex gap-4 mt-2 text-[10px] opacity-60">
                    <p>Filtro: {filterLevel === 'all' ? 'Institucional' : filterLevel.toUpperCase()}</p>
                    <p>Aula: {filterClassroom === 'all' ? 'Todas' : classrooms.find(c => c.id === filterClassroom)?.name}</p>
                    <p>Fecha de Emisión: {new Date().toLocaleDateString('es-PE')}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-50 shadow-sm print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {(user.role === 'Administrador' || user.role === 'Supervisor') && (
                        <>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Building2 size={12} /> Nivel Educativo
                                </label>
                                <select
                                    value={filterLevel}
                                    onChange={(e) => {
                                        setFilterLevel(e.target.value);
                                        setFilterClassroom('all');
                                    }}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-celeste shadow-inner"
                                >
                                    <option value="all">TODOS LOS NIVELES</option>
                                    <option value="inicial">INICIAL</option>
                                    <option value="primaria">PRIMARIA</option>
                                    <option value="secundaria">SECUNDARIA</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Filter size={12} /> Aula / Grado
                                </label>
                                <select
                                    value={filterClassroom}
                                    onChange={(e) => setFilterClassroom(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-celeste shadow-inner"
                                >
                                    <option value="all">TODAS LAS AULAS</option>
                                    {classrooms.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    <div className="space-y-2 md:col-start-4">
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Search size={12} /> Buscar
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                            <input
                                type="text"
                                placeholder="Título reunión..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-3 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-celeste shadow-inner"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <Loader2 className="animate-spin text-brand-celeste" size={48} />
                    <p className="text-slate-400 font-bold">Generando informes...</p>
                </div>
            ) : view === 'LIST' ? (
                /* Individual Meetings View */
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
            ) : (
                /* Consolidated Report View */
                <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500">
                    {/* Main Stats Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-3">
                            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total Reuniones</p>
                                <p className="text-3xl font-black text-slate-800">{consolidatedStats?.totalMeetings}</p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-3">
                            <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center">
                                <Users size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Asistencias Totales</p>
                                <p className="text-3xl font-black text-slate-800">{consolidatedStats?.attendedCount}</p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-3">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">% Gral Asistencia</p>
                                <p className="text-3xl font-black text-emerald-500">{consolidatedStats?.attendancePercentage}%</p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-3">
                            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                                <Award size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Meta Institucional</p>
                                <p className="text-3xl font-black text-slate-800">95%</p>
                            </div>
                        </div>
                    </div>

                    {/* Composition Chart Section */}
                    <div className="bg-slate-800 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <PieChart size={24} className="text-brand-celeste" />
                                </div>
                                <h3 className="text-xl font-black tracking-tight italic">COMPOSICIÓN DE ASISTENCIA FAMILIAR</h3>
                            </div>

                            <div className="flex flex-col lg:flex-row items-center justify-around gap-12">
                                {/* SVG Donut Chart */}
                                <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        {(() => {
                                            const stats = consolidatedStats;
                                            if (!stats || stats.attendedCount === 0) return (
                                                <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                                            );

                                            const total = stats.attendedCount;
                                            const fP = (stats.fatherCount / total) * 100;
                                            const mP = (stats.motherCount / total) * 100;
                                            const bP = (stats.bothCount / total) * 100;
                                            const oP = (stats.otherCount / total) * 100;

                                            let currentOffset = 0;
                                            const radius = 40;
                                            const circumference = 2 * Math.PI * radius;

                                            const createSegment = (percent: number, color: string) => {
                                                const strokeDash = (percent * circumference) / 100;
                                                const offset = currentOffset;
                                                currentOffset += strokeDash;
                                                if (percent === 0) return null;
                                                return (
                                                    <circle
                                                        cx="50" cy="50" r={radius}
                                                        fill="transparent"
                                                        stroke={color}
                                                        strokeWidth="12"
                                                        strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                                                        strokeDashoffset={-offset}
                                                        strokeLinecap="round"
                                                        className="transition-all duration-1000 ease-out"
                                                    />
                                                );
                                            };

                                            return (
                                                <>
                                                    {createSegment(fP, '#22d3ee')} {/* Cyan - Father */}
                                                    {createSegment(mP, '#f472b6')} {/* Pink - Mother */}
                                                    {createSegment(bP, '#10b981')} {/* Emerald - Both */}
                                                    {createSegment(oP, '#a855f7')} {/* Purple - Others */}
                                                </>
                                            );
                                        })()}
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Total</p>
                                        <p className="text-4xl md:text-5xl font-black">{consolidatedStats?.attendedCount}</p>
                                        <p className="text-[10px] font-bold text-brand-celeste mt-1">ASISTENTES</p>
                                    </div>
                                </div>

                                {/* Legend and Detailed Stats */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                                    <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10 backdrop-blur-sm flex items-center gap-4 group hover:bg-white/10 transition-all">
                                        <div className="w-3 h-12 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">SÓLO PADRES</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-black">{consolidatedStats?.fatherCount}</span>
                                                <span className="text-xs font-bold text-cyan-400">
                                                    {consolidatedStats ? Math.round((consolidatedStats.fatherCount / Math.max(1, consolidatedStats.attendedCount)) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10 backdrop-blur-sm flex items-center gap-4 group hover:bg-white/10 transition-all">
                                        <div className="w-3 h-12 bg-pink-400 rounded-full shadow-[0_0_15px_rgba(244,114,182,0.5)]"></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">SÓLO MADRES</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-black">{consolidatedStats?.motherCount}</span>
                                                <span className="text-xs font-bold text-pink-400">
                                                    {consolidatedStats ? Math.round((consolidatedStats.motherCount / Math.max(1, consolidatedStats.attendedCount)) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10 backdrop-blur-sm flex items-center gap-4 group hover:bg-white/10 transition-all">
                                        <div className="w-3 h-12 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">AMBOS (P Y M)</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-black">{consolidatedStats?.bothCount}</span>
                                                <span className="text-xs font-bold text-emerald-400">
                                                    {consolidatedStats ? Math.round((consolidatedStats.bothCount / Math.max(1, consolidatedStats.attendedCount)) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10 backdrop-blur-sm flex items-center gap-4 group hover:bg-white/10 transition-all">
                                        <div className="w-3 h-12 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">OTROS FAMILIARES</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-black">{consolidatedStats?.otherCount}</span>
                                                <span className="text-xs font-bold text-purple-400">
                                                    {consolidatedStats ? Math.round((consolidatedStats.otherCount / Math.max(1, consolidatedStats.attendedCount)) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Decorative background glow */}
                        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-brand-celeste/20 rounded-full blur-3xl"></div>
                        <div className="absolute -left-20 -top-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
                    </div>
                </div>
            )}

            {!loading && filteredMeetings.length === 0 && view === 'LIST' && (
                <div className="flex flex-col items-center justify-center p-20 text-slate-300 text-center">
                    <Calendar size={64} className="mb-4 opacity-10" />
                    <p className="font-bold">No se encontraron reuniones registradas.</p>
                </div>
            )}
        </div>
    );
};

export default MeetingReports;
