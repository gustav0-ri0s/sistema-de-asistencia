
import React, { useState } from 'react';
import { Calendar, Search, TrendingUp, Filter, List, CalendarRange, ArrowRight, Play } from 'lucide-react';
import { Classroom, AttendanceStatus } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Loader2 } from 'lucide-react';

interface ClassroomStats extends Classroom {
  presentCount: number;
  absentCount: number;
  percentage: number;
}

interface ReportsProps {
  onSelectClassroom: (classroom: Classroom, date: string, range: string, endDate?: string) => void;
}

const Reports: React.FC<ReportsProps> = ({ onSelectClassroom }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [range, setRange] = useState('Día');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ startDate, endDate, range });
  const [classrooms, setClassrooms] = useState<ClassroomStats[]>([]);
  const [loading, setLoading] = useState(false);

  const ranges = ['Día', 'Semana', 'Bimestre', 'Semestre', 'Personalizado'];

  React.useEffect(() => {
    fetchClassroomStats();
  }, [appliedFilters]);

  const fetchClassroomStats = async () => {
    try {
      setLoading(true);

      // 1. Fetch classrooms and student counts
      const { data: classroomsData, error: classroomsError } = await supabase
        .from('classrooms')
        .select(`
          id,
          name,
          level,
          students (count)
        `)
        .eq('active', true);

      if (classroomsError) throw classroomsError;

      // 2. Fetch attendance for the period
      let attendanceQuery = supabase
        .from('attendance')
        .select('*');

      if (appliedFilters.range === 'Día') {
        attendanceQuery = attendanceQuery.eq('date', appliedFilters.startDate);
      } else if (appliedFilters.range === 'Personalizado' && appliedFilters.endDate) {
        attendanceQuery = attendanceQuery.gte('date', appliedFilters.startDate).lte('date', appliedFilters.endDate);
      } else {
        // Handle other ranges (Semana, Bimestre etc) - for now just use startDate as gte
        attendanceQuery = attendanceQuery.gte('date', appliedFilters.startDate);
      }

      const { data: attendanceData, error: attendanceError } = await attendanceQuery;
      if (attendanceError) throw attendanceError;

      // 3. Process data
      const stats = classroomsData.map((c: any) => {
        const studentCount = c.students[0]?.count || 0;
        const classroomAttendance = attendanceData.filter(a => a.classroom_id === c.id);

        const present = classroomAttendance.filter(a =>
          a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
        ).length;

        const absent = classroomAttendance.filter(a =>
          a.status === AttendanceStatus.ABSENT || a.status === AttendanceStatus.JUSTIFIED
        ).length;

        // Calculate percentage (avoid division by zero)
        const totalMarked = present + absent;
        const percentage = totalMarked > 0 ? (present / totalMarked) * 100 : 0;

        return {
          id: c.id,
          name: c.name || `${c.grade} ${c.section}`,
          level: c.level,
          studentCount,
          presentCount: present,
          absentCount: absent,
          percentage: Math.round(percentage * 10) / 10
        };
      });

      setClassrooms(stats);
    } catch (err) {
      console.error('Error fetching report stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClassrooms = classrooms.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApplyFilters = () => {
    setAppliedFilters({ startDate, endDate, range });
  };

  const handleClassroomClick = (c: Classroom) => {
    onSelectClassroom(
      c,
      appliedFilters.startDate,
      appliedFilters.range,
      appliedFilters.range === 'Personalizado' ? appliedFilters.endDate : undefined
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Reportes</h2>
          <p className="text-slate-400 text-sm font-medium tracking-tight">Consulta la asistencia por fecha, rango o periodos académicos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Selector de Rango */}
        <div className="lg:col-span-4 neumorphic-card rounded-3xl p-6 bg-white border border-slate-50 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Filter size={12} />
            Periodo de Tiempo
          </p>
          <div className="flex flex-wrap gap-2">
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-xl text-[10px] font-black transition-all border ${range === r
                  ? 'bg-brand-celeste text-white border-brand-celeste shadow-md'
                  : 'bg-white text-slate-400 border-slate-100 hover:border-brand-celeste/30 hover:text-brand-celeste'
                  }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Fechas y Botón */}
        <div className="lg:col-span-8 neumorphic-card rounded-3xl p-6 bg-white border border-slate-50 shadow-sm flex flex-col md:flex-row items-end gap-6">
          <div className="flex-1 space-y-4 w-full">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <CalendarRange size={12} />
              Configurar Consulta
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Fecha Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-black text-slate-700 focus:ring-2 focus:ring-brand-celeste outline-none cursor-pointer"
                />
              </div>
              {range === 'Personalizado' && (
                <>
                  <ArrowRight size={16} className="text-slate-300 mt-4" />
                  <div className="flex-1">
                    <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Fecha Fin</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-black text-slate-700 focus:ring-2 focus:ring-brand-celeste outline-none cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleApplyFilters}
            className="w-full md:w-auto bg-slate-800 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 tracking-[0.1em] group"
          >
            <Play size={14} className="text-brand-celeste group-hover:scale-125 transition-transform" />
            GENERAR REPORTE
          </button>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="neumorphic-card rounded-[2.5rem] bg-white overflow-hidden border border-slate-100 shadow-xl">
        <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-1">
              Resultados de Asistencia
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              {appliedFilters.range === 'Día'
                ? appliedFilters.startDate
                : appliedFilters.range === 'Personalizado'
                  ? `${appliedFilters.startDate} al ${appliedFilters.endDate}`
                  : `${appliedFilters.range} desde ${appliedFilters.startDate}`}
            </p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              type="text"
              placeholder="Filtrar aula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-celeste w-full sm:w-48 transition-all focus:sm:w-64 shadow-inner"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aula / Salón</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Nivel</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Presentes</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Faltas</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">% Prom</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ver Lista</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClassrooms.map(c => (
                <tr
                  key={c.id}
                  className="hover:bg-cyan-50/30 transition-colors cursor-pointer group"
                  onClick={() => handleClassroomClick(c)}
                >
                  <td className="px-8 py-5 font-black text-sm text-slate-700 group-hover:text-brand-celeste transition-colors">{c.name}</td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-100 px-2.5 py-1 rounded-lg">
                      {c.level.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center font-bold text-slate-600">
                    {c.presentCount}
                  </td>
                  <td className="px-8 py-5 text-center font-bold text-rose-400">
                    {c.absentCount}
                  </td>
                  <td className="px-8 py-5 text-right font-black text-brand-celeste">{c.percentage}%</td>
                  <td className="px-8 py-5 text-center">
                    <div className="inline-flex p-2.5 bg-slate-50 rounded-xl text-slate-300 group-hover:bg-brand-celeste group-hover:text-white transition-all shadow-sm">
                      <List size={16} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
