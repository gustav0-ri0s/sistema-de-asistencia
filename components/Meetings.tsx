import React, { useState, useEffect } from 'react';
import {
    Plus,
    Calendar,
    Users,
    ChevronRight,
    Loader2,
    FileText,
    Clock,
    Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Classroom, StaffMember } from '../types';

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

interface MeetingsProps {
    user: StaffMember;
    onCreateMeeting: (classroom: Classroom, meetingId: string, meetingTitle: string) => void;
    onViewMeetingDetail: (meeting: Meeting) => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const Meetings: React.FC<MeetingsProps> = ({ user, onCreateMeeting, onViewMeetingDetail, showToast }) => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('');
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [creating, setCreating] = useState(false);
    const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            await Promise.all([fetchMeetings(), fetchClassrooms()]);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMeetings = async () => {
        try {
            // If admin, fetch all meetings. If teacher, fetch meetings of their assigned classrooms.
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
                    query = query.in('classroom_id', assignedClassroomIds.map(id => parseInt(id)));
                } else {
                    // No assignments, no meetings
                    setMeetings([]);
                    return;
                }
            }

            const { data, error } = await query.order('date', { ascending: false });

            if (error) throw error;

            // Get attendance counts for each meeting
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
            console.error('Error fetching meetings:', err);
        }
    };

    const fetchClassrooms = async () => {
        try {
            const { data: classroomsData, error } = await supabase
                .from('classrooms')
                .select('*')
                .eq('active', true)
                .order('name', { ascending: true });

            if (error) throw error;

            const mapped = classroomsData.map((c: any) => ({
                id: c.id.toString(),
                name: c.name,
                level: c.level.charAt(0).toUpperCase() + c.level.slice(1) as any,
                studentCount: 0
            }));

            // Filter classrooms like in Dashboard
            const filtered = (user.role === 'Administrador' || user.role === 'Supervisor')
                ? mapped
                : mapped.filter(classroom =>
                    user.assignments.some(assign =>
                        assign.classroomId === classroom.id || assign.level === classroom.level
                    )
                );

            setClassrooms(filtered);
        } catch (err) {
            console.error('Error fetching classrooms:', err);
        }
    };

    const handleCreateMeeting = async () => {
        if (!selectedClassroom || !meetingTitle.trim()) {
            showToast('Por favor complete todos los campos', 'error');
            return;
        }

        try {
            setCreating(true);

            const { data, error } = await supabase
                .from('meetings')
                .insert({
                    title: meetingTitle,
                    date: meetingDate,
                    classroom_id: parseInt(selectedClassroom)
                })
                .select()
                .single();

            if (error) throw error;

            showToast('Reunión creada exitosamente', 'success');
            setShowCreateModal(false);
            setMeetingTitle('');
            setSelectedClassroom('');
            setMeetingDate(new Date().toISOString().split('T')[0]);

            // Navigate to attendance registration
            const classroom = classrooms.find(c => c.id === selectedClassroom);
            if (classroom) {
                onCreateMeeting(classroom, data.id, meetingTitle);
            }

            fetchMeetings();
        } catch (err: any) {
            console.error('Error creating meeting:', err);
            showToast('Error al crear reunión: ' + err.message, 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteMeeting = async () => {
        if (!meetingToDelete) return;

        try {
            setDeleting(true);
            const { error } = await supabase
                .from('meetings')
                .delete()
                .eq('id', meetingToDelete.id);

            if (error) throw error;

            showToast('Reunión eliminada exitosamente', 'success');
            setMeetingToDelete(null);
            fetchMeetings();
        } catch (err: any) {
            console.error('Error deleting meeting:', err);
            showToast('Error al eliminar reunión: ' + err.message, 'error');
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('es-PE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(new Date(dateString));
    };

    if (loading) {
        return (
            <div className="min-h-full bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-brand-celeste" size={48} />
                    <p className="text-slate-400 font-bold">Cargando reuniones...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-slate-50 p-6 animate-in fade-in duration-300">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 mb-2">Reuniones de Padres</h1>
                            <p className="text-sm text-slate-500 font-medium">
                                Gestiona y registra la asistencia de padres de familia a las reuniones
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 bg-brand-celeste text-white px-6 py-3 rounded-2xl font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-cyan-100"
                        >
                            <Plus size={20} />
                            Crear Reunión
                        </button>
                    </div>
                </div>

                {/* Meetings List */}
                <div className="space-y-4">
                    {meetings.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center">
                            <Calendar className="mx-auto text-slate-300 mb-4" size={64} />
                            <h3 className="text-xl font-bold text-slate-400 mb-2">No hay reuniones registradas</h3>
                            <p className="text-sm text-slate-400 mb-6">
                                Crea tu primera reunión para comenzar a registrar asistencias
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="inline-flex items-center gap-2 bg-brand-celeste text-white px-6 py-3 rounded-2xl font-bold text-sm hover:scale-105 transition-all"
                            >
                                <Plus size={20} />
                                Crear Primera Reunión
                            </button>
                        </div>
                    ) : (
                        meetings.map((meeting) => (
                            <div
                                key={meeting.id}
                                className="bg-white rounded-3xl p-6 hover:shadow-lg transition-all cursor-pointer group"
                                onClick={() => onViewMeetingDetail(meeting)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-16 h-16 bg-gradient-to-br from-brand-celeste to-cyan-400 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                            <Calendar size={28} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-black text-slate-800 mb-1">{meeting.title}</h3>
                                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={14} />
                                                    <span>{formatDate(meeting.date)}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <FileText size={14} />
                                                    <span>{meeting.classroom_name}</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2">
                                                <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-xs font-bold">
                                                    {meeting.attendance_count} / {meeting.total_students} asistencias
                                                </div>
                                                <div className="bg-slate-50 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold">
                                                    {meeting.total_students > 0
                                                        ? `${Math.round((meeting.attendance_count / meeting.total_students) * 100)}%`
                                                        : '0%'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMeetingToDelete(meeting);
                                            }}
                                            className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                        <ChevronRight
                                            className="text-slate-300 group-hover:text-brand-celeste group-hover:translate-x-1 transition-all"
                                            size={24}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Create Meeting Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full animate-in zoom-in duration-200">
                        <h2 className="text-2xl font-black text-slate-800 mb-6">Nueva Reunión</h2>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Título de la Reunión
                                </label>
                                <input
                                    type="text"
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                    placeholder="Ej: Reunión de Padres - I Bimestre"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-celeste focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Fecha
                                </label>
                                <input
                                    type="date"
                                    value={meetingDate}
                                    onChange={(e) => setMeetingDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-celeste focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Aula
                                </label>
                                <select
                                    value={selectedClassroom}
                                    onChange={(e) => setSelectedClassroom(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-celeste focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                                >
                                    <option value="">Seleccionar aula...</option>
                                    {classrooms.map((classroom) => (
                                        <option key={classroom.id} value={classroom.id}>
                                            {classroom.name} - {classroom.level}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                disabled={creating}
                                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateMeeting}
                                disabled={creating}
                                className="flex-1 px-6 py-3 rounded-xl bg-brand-celeste text-white font-bold hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Creando...
                                    </>
                                ) : (
                                    'Crear y Registrar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {meetingToDelete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 shadow-inner">
                                <Trash2 size={40} />
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight italic">¿ELIMINAR REUNIÓN?</h2>
                                <p className="text-sm font-medium text-slate-400 leading-relaxed px-4">
                                    Esta acción eliminará permanentemente la reunión <span className="text-slate-700 font-black">"{meetingToDelete.title}"</span> y todos sus registros de asistencia asociados.
                                </p>
                            </div>

                            <div className="flex flex-col w-full gap-3 pt-4">
                                <button
                                    onClick={handleDeleteMeeting}
                                    disabled={deleting}
                                    className="w-full bg-rose-500 text-white py-5 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-rose-100 hover:bg-rose-600 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                    {deleting ? 'ELIMINANDO...' : 'SÍ, ELIMINAR AHORA'}
                                </button>
                                <button
                                    onClick={() => setMeetingToDelete(null)}
                                    disabled={deleting}
                                    className="w-full bg-slate-50 text-slate-400 py-4 rounded-xl font-black text-[10px] tracking-[0.2em] uppercase hover:bg-slate-100 transition-all border border-slate-100"
                                >
                                    CANCELAR ACCIÓN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Meetings;
