import React from 'react';
import { supabase } from '../lib/supabase';
import { Classroom, StaffMember } from '../types.ts';
import { Users, ChevronRight, School, Loader2 } from 'lucide-react';

interface DashboardProps {
  user: StaffMember;
  onSelectClassroom: (c: Classroom) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onSelectClassroom }) => {
  const [assignedClassrooms, setAssignedClassrooms] = React.useState<Classroom[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchClassrooms();
  }, [user]);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      // Fetch all classrooms
      const { data: classroomsData, error: classroomsError } = await supabase
        .from('classrooms')
        .select('*')
        .eq('active', true);

      if (classroomsError) throw classroomsError;

      // Fetch student counts
      const { data: studentCounts, error: countsError } = await supabase
        .from('students')
        .select('classroom_id');

      if (countsError) throw countsError;

      const counts = studentCounts.reduce((acc: Record<string, number>, curr: any) => {
        if (curr.classroom_id) {
          acc[curr.classroom_id] = (acc[curr.classroom_id] || 0) + 1;
        }
        return acc;
      }, {});

      const mappedClassrooms: Classroom[] = classroomsData.map((c: any) => ({
        id: c.id.toString(),
        name: c.name || `${c.grade} ${c.section}`,
        level: c.level.charAt(0).toUpperCase() + c.level.slice(1) as any,
        studentCount: counts[c.id] || 0
      }));

      // Filter by assignments
      const filtered = user.role === 'Administrador'
        ? mappedClassrooms
        : mappedClassrooms.filter(classroom =>
          user.assignments.some(assign =>
            assign.classroomId === classroom.id || assign.level === classroom.level
          )
        );

      setAssignedClassrooms(filtered);
    } catch (err) {
      console.error('Error fetching classrooms:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-brand-celeste" size={48} />
        <p className="text-slate-400 font-bold">Cargando salones...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-light text-slate-800">Control de <span className="font-black italic">Asistencia</span></h2>
        <p className="text-slate-400 text-sm font-medium tracking-tight">Seleccione el aula para realizar el registro del día.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {assignedClassrooms.map((classroom) => (
          <button
            key={classroom.id}
            onClick={() => onSelectClassroom(classroom)}
            className="neumorphic-card rounded-[2.5rem] p-8 text-left group hover:border-brand-celeste hover:scale-[1.02] transition-all duration-300 relative overflow-hidden bg-white hover:shadow-2xl hover:shadow-cyan-100/50"
          >
            {/* Fondo decorativo con movimiento en hover */}
            <div className="absolute -top-6 -right-6 text-slate-50 group-hover:text-brand-celeste/20 group-hover:-translate-x-2 group-hover:translate-y-2 transition-all duration-500 opacity-10 pointer-events-none">
              <School size={160} />
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-10">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-brand-celeste transition-colors shadow-sm duration-300">
                  <Users className="text-brand-celeste group-hover:text-white" size={28} />
                </div>
                <span className="text-[10px] font-black bg-slate-100 group-hover:bg-brand-celeste text-slate-400 group-hover:text-white px-4 py-2 rounded-xl shadow-sm tracking-widest transition-colors duration-300 uppercase">
                  {classroom.level}
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-2xl font-black text-slate-800 group-hover:text-brand-celeste mb-1 leading-tight transition-colors duration-300">
                  {classroom.name}
                </h4>
                <p className="text-sm font-bold text-slate-400 mb-8">
                  {classroom.studentCount} Alumnos matriculados
                </p>
              </div>

              <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-50 group-hover:border-brand-celeste/20 transition-colors duration-300">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">REGISTRO ABIERTO</span>
                </div>
                <div className="bg-slate-50 group-hover:bg-brand-celeste text-slate-300 group-hover:text-white p-2.5 rounded-xl transition-all group-hover:translate-x-1 shadow-sm">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          </button>
        ))}

        {assignedClassrooms.length === 0 && (
          <div className="col-span-full py-24 text-center space-y-6 bg-white/50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="inline-flex w-24 h-24 bg-white rounded-full items-center justify-center text-slate-300 shadow-xl">
              <School size={48} />
            </div>
            <div className="space-y-1">
              <p className="text-slate-800 font-black text-lg">No hay aulas disponibles</p>
              <p className="text-slate-400 text-sm font-medium">No tiene permisos de acceso asignados actualmente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
