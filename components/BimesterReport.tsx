
import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  Loader2
} from 'lucide-react';
import { Classroom, Student, AttendanceStatus } from '../types.ts';
import { supabase } from '../lib/supabase.ts';

interface Bimestre {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

interface BimesterReportProps {
  classroom: Classroom;
  onBack: () => void;
}

const BimesterReport: React.FC<BimesterReportProps> = ({ classroom, onBack }) => {
  const [bimestres, setBimestres] = useState<Bimestre[]>([]);
  const [selectedBimestre, setSelectedBimestre] = useState<Bimestre | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    fetchInitialData();
  }, [classroom]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: bData } = await supabase
        .from('bimestres')
        .select('*')
        .order('id', { ascending: true });

      setBimestres(bData || []);
      if (bData && bData.length > 0) {
        setSelectedBimestre(bData[0]);
      }

      const { data: sData } = await supabase
        .from('students')
        .select('*')
        .eq('classroom_id', classroom.id)
        .order('last_name', { ascending: true });

      setStudents((sData || []).map((s: any) => ({
        id: s.id,
        name: `${s.last_name}, ${s.first_name}`,
        dni: s.dni || '---',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.first_name + ' ' + s.last_name)}&background=random&color=fff&rounded=true&bold=true`
      })));

    } catch (err) {
      console.error('Error fetching initial bimester data:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (selectedBimestre) {
      fetchAttendance();
    }
  }, [selectedBimestre]);

  const fetchAttendance = async () => {
    if (!selectedBimestre) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('classroom_id', classroom.id)
        .gte('date', selectedBimestre.start_date)
        .lte('date', selectedBimestre.end_date);

      const grouped: Record<string, Record<string, string>> = {};
      (data || []).forEach(record => {
        if (!grouped[record.student_id]) grouped[record.student_id] = {};

        const statusMap: Record<string, string> = {
          [AttendanceStatus.PRESENT]: 'P',
          [AttendanceStatus.LATE]: 'T',
          [AttendanceStatus.ABSENT]: 'F',
          [AttendanceStatus.JUSTIFIED]: 'J'
        };
        grouped[record.student_id][record.date] = statusMap[record.status] || 'P';
      });
      setAttendance(grouped);
    } catch (err) {
      console.error('Error fetching bimester attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const days = (() => {
    if (!selectedBimestre) return [];
    const start = new Date(selectedBimestre.start_date);
    const end = new Date(selectedBimestre.end_date);
    const result = [];
    const current = new Date(start);

    while (current <= end) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        result.push(new Date(current).toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    return result;
  })();

  const handlePrint = () => {
    window.print();
  };

  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'P': return 'text-emerald-500 font-black bg-emerald-50 print:bg-transparent print:text-emerald-600';
      case 'T': return 'text-amber-500 font-black bg-amber-50 print:bg-transparent print:text-amber-600';
      case 'F': return 'text-rose-500 font-black bg-rose-50 print:bg-transparent print:text-rose-600';
      case 'J': return 'text-slate-400 font-black bg-slate-100 print:bg-transparent print:text-slate-400';
      default: return 'text-slate-200 print:text-slate-100';
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 animate-in zoom-in-95 duration-300 print:p-0 print:m-0 print:max-w-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-brand-celeste shadow-sm transition-all hover:bg-cyan-50">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Reporte Bimestral</h2>
            <p className="text-xs text-brand-celeste font-bold tracking-widest uppercase">
              SISTEMA DE ASISTENCIA • {classroom.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 text-xs font-black hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer size={18} />
            <span>IMPRIMIR</span>
          </button>
          <button className="flex items-center gap-2 px-5 py-3 bg-brand-celeste text-white rounded-2xl text-xs font-black hover:scale-[1.02] transition-all shadow-lg shadow-cyan-100">
            <FileSpreadsheet size={18} />
            <span>EXCEL</span>
          </button>
        </div>
      </div>

      {/* Cabecera para Impresión */}
      <div className="hidden print:flex flex-col items-center justify-center bg-brand-celeste text-white py-12 px-8 mb-10">
        <h1 className="text-3xl font-black mb-2 tracking-tight">I.E.P. VALORES Y CIENCIAS</h1>
        <h2 className="text-lg font-bold mb-1 opacity-90 uppercase tracking-widest">Reporte de Asistencia Bimestral</h2>
        <p className="text-sm font-medium opacity-80">
          Aula: {classroom.name.toUpperCase()} • {selectedBimestre?.name.toUpperCase()}
        </p>
      </div>

      <div className="neumorphic-card rounded-[2.5rem] p-6 flex flex-wrap items-center justify-between gap-6 border border-slate-100 shadow-xl print:hidden">
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl flex-1 min-w-[300px] overflow-x-auto">
          {bimestres.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBimestre(b)}
              className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black transition-all tracking-wider whitespace-nowrap ${selectedBimestre?.id === b.id ? 'bg-white text-brand-celeste shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              {b.name.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Buscar alumno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-3.5 text-xs font-bold text-slate-600 w-56 focus:w-72 transition-all focus:ring-2 focus:ring-brand-celeste shadow-inner"
            />
          </div>
          <button className="p-3.5 bg-slate-50 rounded-2xl text-slate-400 hover:text-brand-celeste border border-slate-100">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="neumorphic-card rounded-[3rem] overflow-hidden border border-slate-100 shadow-2xl bg-white print:border-slate-200 print:shadow-none print:rounded-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/80 print:bg-brand-celeste">
                <th className="sticky left-0 z-20 bg-slate-50 px-8 py-6 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-72 print:text-white print:border-none">
                  Alumnos del Salón
                </th>
                {days.map(d => (
                  <th key={d} className="px-2 py-6 border-b border-slate-100 text-center text-[10px] font-black text-slate-300 uppercase min-w-[45px] print:text-white print:border-none">
                    {d.split('-')[2]}
                  </th>
                ))}
                <th className="px-8 py-6 border-b border-slate-100 text-center text-[10px] font-black text-brand-celeste uppercase bg-cyan-50/50 print:text-white print:border-none print:bg-brand-celeste">
                  PROM %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={days.length + 2} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-brand-celeste" size={40} />
                      <p className="text-slate-400 font-bold">Cargando reporte académico...</p>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 2} className="px-8 py-20 text-center text-slate-400 font-bold">
                    No hay alumnos en este salón.
                  </td>
                </tr>
              ) : students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((student) => {
                const studentAttendance = attendance[student.id] || {};
                const presentDays = Object.values(studentAttendance).filter(s => s === 'P' || s === 'T').length;
                const totalPossible = days.filter(d => studentAttendance[d]).length;
                const percentage = totalPossible > 0 ? Math.round((presentDays / totalPossible) * 100) : 0;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-8 py-5 border-r border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-400 overflow-hidden shadow-inner">
                          <img src={student.avatar} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-700 truncate">{student.name}</p>
                          <p className="text-[10px] text-slate-400 font-black tracking-widest">DNI: {student.dni}</p>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const status = studentAttendance[d] || '';
                      return (
                        <td key={d} className="px-1 py-5 border-r border-slate-50/50">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] mx-auto transition-transform hover:scale-110 ${getStatusStyle(status)}`}>
                            {status}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-8 py-5 text-center bg-cyan-50/20">
                      <span className={`text-xs font-black ${percentage >= 90 ? 'text-emerald-500' : 'text-brand-celeste'} bg-white px-3 py-1.5 rounded-full shadow-sm border border-cyan-100`}>
                        {percentage}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-4 print:mt-10">
        <div className="flex flex-wrap items-center gap-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-emerald-500 shadow-sm"></div>
            <span>(P) Presente</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-amber-400 shadow-sm"></div>
            <span>(T) Tardanza</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-rose-500 shadow-sm"></div>
            <span>(F) Falta</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-slate-400 shadow-sm"></div>
            <span>(J) Justificado</span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mb-1">Total de Alumnos</p>
          <p className="text-2xl font-black text-slate-800">{students.length}</p>
        </div>
      </div>
    </div>
  );
};

export default BimesterReport;
