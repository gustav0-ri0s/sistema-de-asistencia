
import React from 'react';
/* Added TrendingUp to the imports from lucide-react */
import { ArrowLeft, Printer, School, UserCheck, UserX, FileText, Calendar, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { Classroom, Student, AttendanceStatus } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Loader2 } from 'lucide-react';

interface ClassroomReportDetailProps {
  classroom: Classroom;
  date: string;
  range: string;
  endDate?: string;
  onBack: () => void;
}

const ClassroomReportDetail: React.FC<ClassroomReportDetailProps> = ({ classroom, date, range, endDate, onBack }) => {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const isMultiDay = range !== 'Día';

  React.useEffect(() => {
    fetchData();
  }, [classroom, date, range, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Students
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('classroom_id', classroom.id)
        .order('last_name', { ascending: true });

      const mappedStudents: Student[] = (studentsData || []).map((s: any) => ({
        id: s.id,
        name: `${s.last_name}, ${s.first_name}`,
        dni: s.dni || '---',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.first_name + ' ' + s.last_name.split(' ')[0])}&background=random&color=fff&rounded=true&bold=true`
      }));

      setStudents(mappedStudents);

      // 2. Fetch Attendance
      let query = supabase.from('attendance').select('*').eq('classroom_id', classroom.id);

      if (range === 'Día') {
        query = query.eq('date', date);
      } else if (range === 'Personalizado' && endDate) {
        query = query.gte('date', date).lte('date', endDate);
      } else {
        query = query.gte('date', date);
      }

      const { data: attData } = await query;
      setAttendanceRecords(attData || []);

    } catch (err) {
      console.error('Error fetching report detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(a => a.student_id === studentId);
    if (!record) return 'SIN REGISTRO';

    const statusMap: Record<string, string> = {
      [AttendanceStatus.PRESENT]: 'PRESENTE',
      [AttendanceStatus.LATE]: 'TARDANZA',
      [AttendanceStatus.ABSENT]: 'AUSENTE',
      [AttendanceStatus.JUSTIFIED]: 'JUSTIFICADO'
    };
    return statusMap[record.status] || record.status;
  };

  const getAggregateAttendance = (studentId: string) => {
    const studentRecords = attendanceRecords.filter(a => a.student_id === studentId);
    if (studentRecords.length === 0) return 0;

    const present = studentRecords.filter(a =>
      a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
    ).length;

    return Math.round((present / studentRecords.length) * 100);
  };

  const handlePrint = () => {
    window.print();
  };

  const presentCount = attendanceRecords.filter(a =>
    a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
  ).length;

  const absenceCount = attendanceRecords.filter(a =>
    a.status === AttendanceStatus.ABSENT || a.status === AttendanceStatus.JUSTIFIED
  ).length;

  const totalStudents = students.length;
  const globalPercentage = totalStudents > 0 ? Math.round((presentCount / (totalStudents * (isMultiDay ? (new Set(attendanceRecords.map(a => a.date)).size || 1) : 1))) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-brand-celeste" size={48} />
        <p className="text-slate-400 font-bold">Cargando reporte detallado...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 print:p-0 print:m-0 print:max-w-none">
      {/* Controles de Cabecera - Ocultos en impresión */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-brand-celeste shadow-sm transition-all hover:bg-cyan-50">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Reporte Detallado</h2>
            <p className="text-xs text-brand-celeste font-bold tracking-widest uppercase flex items-center gap-2">
              <Calendar size={14} />
              {classroom.name} • {range} • {endDate ? `${date} al ${endDate}` : date}
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-3 px-7 py-4 bg-slate-800 text-white rounded-2xl text-xs font-black shadow-xl hover:bg-slate-900 transition-all tracking-widest group"
        >
          <Printer size={18} className="text-brand-celeste group-hover:scale-110 transition-transform" />
          GENERAR PDF / IMPRIMIR
        </button>
      </div>

      {/* Cabecera Institucional para Impresión Estilo Imagen */}
      <div className="hidden print:flex flex-col items-center justify-center bg-brand-celeste text-white py-12 px-8 mb-10">
        <h1 className="text-3xl font-black mb-2 tracking-tight">I.E.P. VALORES Y CIENCIAS</h1>
        <h2 className="text-lg font-bold mb-1 opacity-90 uppercase tracking-widest">Reporte de Asistencia Escolar</h2>
        <p className="text-sm font-medium opacity-80">
          Periodo: {range.toUpperCase()} • {endDate ? `${date} al ${endDate}` : date}
        </p>
      </div>

      <div className="hidden print:grid grid-cols-2 gap-x-12 text-[11px] font-black text-slate-700 w-full mb-8 border border-slate-200 p-6 rounded-2xl bg-white">
        <div className="space-y-3">
          <p className="flex justify-between border-b border-slate-100 pb-1"><span>SALÓN:</span> <span className="text-brand-celeste">{classroom.name.toUpperCase()}</span></p>
          <p className="flex justify-between border-b border-slate-100 pb-1"><span>NIVEL:</span> <span>{classroom.level.toUpperCase()}</span></p>
        </div>
        <div className="space-y-3">
          <p className="flex justify-between border-b border-slate-100 pb-1"><span>SISTEMA:</span> <span>CONTROL DE ASISTENCIA V&C</span></p>
          <p className="flex justify-between border-b border-slate-100 pb-1"><span>FECHA EMISIÓN:</span> <span>{new Date().toLocaleDateString('es-PE')}</span></p>
        </div>
      </div>

      {/* Conteo de Asistentes para el Reporte */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
        <div className="neumorphic-card rounded-[2rem] p-6 bg-white border-l-8 border-l-emerald-500 shadow-lg">
          <div className="flex items-center gap-4">
            <CheckCircle className="text-emerald-500 print:text-emerald-600" size={28} />
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Asistentes</p>
              <p className="text-3xl font-black text-slate-800">{isMultiDay ? '---' : presentCount}</p>
            </div>
          </div>
        </div>
        <div className="neumorphic-card rounded-[2rem] p-6 bg-white border-l-8 border-l-rose-500 shadow-lg">
          <div className="flex items-center gap-4">
            <XCircle className="text-rose-500 print:text-rose-600" size={28} />
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ausentes</p>
              <p className="text-3xl font-black text-slate-800">{isMultiDay ? '---' : absenceCount}</p>
            </div>
          </div>
        </div>
        <div className="neumorphic-card rounded-[2rem] p-6 bg-white border-l-8 border-l-brand-celeste shadow-lg">
          <div className="flex items-center gap-4">
            <TrendingUp className="text-brand-celeste" size={28} />
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Promedio %</p>
              <p className="text-3xl font-black text-slate-800">
                {isMultiDay ? `${globalPercentage}%` : Math.round((presentCount / (totalStudents || 1)) * 100) + '%'}
              </p>
            </div>
          </div>
        </div>
        <div className="neumorphic-card rounded-[2rem] p-6 bg-white border-l-8 border-l-slate-800 shadow-lg">
          <div className="flex items-center gap-4">
            <FileText className="text-slate-800" size={28} />
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total Alumnos</p>
              <p className="text-3xl font-black text-slate-800">{totalStudents}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Listado Principal de Asistencia */}
      <div className="neumorphic-card rounded-[3rem] bg-white overflow-hidden border border-slate-100 shadow-2xl print:shadow-none print:border-slate-300">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between print:p-6 print:border-slate-300">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Listado de Asistencia Detallada</h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:hidden">Documento Oficial</span>
        </div>
        <table className="w-full text-left border-collapse print:border print:border-slate-200">
          <thead>
            <tr className="bg-slate-50 print:bg-brand-celeste">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 print:text-white print:border-none w-16 text-center">ITEM</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 print:text-white print:border-none">APELLIDOS Y NOMBRES COMPLETOS</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 print:text-white print:border-none text-center">DNI</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 text-center print:text-white print:border-none">
                {isMultiDay ? 'CUMPLIMIENTO' : 'ESTADO'}
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 text-right print:text-white print:border-none">FIRMA / OBSERVACIÓN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 print:divide-y print:divide-slate-200">
            {students.map((student, index) => {
              const status = getAttendanceStatus(student.id);
              const aggregate = getAggregateAttendance(student.id);
              return (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                  <td className="px-8 py-5 text-xs font-black text-slate-300 print:text-slate-600 print:text-center print:border-r print:border-slate-100">{index + 1}</td>
                  <td className="px-8 py-5 print:border-r print:border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm print:hidden">
                        <img src={student.avatar} className="w-full h-full object-cover" alt="" />
                      </div>
                      <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center text-xs font-bold text-slate-400 font-mono print:text-slate-700 print:border-r print:border-slate-100">{student.dni}</td>
                  <td className="px-8 py-5 text-center print:border-r print:border-slate-100">
                    {isMultiDay ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-xs font-black ${aggregate >= 95 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {aggregate}%
                        </span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden print:border print:border-slate-300">
                          <div className={`h-full rounded-full ${aggregate >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${aggregate}%` }}></div>
                        </div>
                      </div>
                    ) : (
                      <span className={`text-[9px] font-black px-4 py-2 rounded-xl border tracking-widest inline-block min-w-[100px] print:border-none print:px-0 print:py-0 print:text-slate-800 ${status === 'PRESENTE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        status === 'AUSENTE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                        {status}
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right text-[10px] font-bold text-slate-300 italic print:text-slate-200">
                    _________________
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumen Final para el PDF */}
      <div className="hidden print:block mt-12 p-8 bg-slate-50 rounded-3xl border border-slate-200">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-300 pb-2">Resumen Consolidado</h4>
        <div className="grid grid-cols-3 gap-10 text-[11px] font-bold text-slate-700">
          <p>Total Alumnos Registrados: <span className="float-right">{totalStudents}</span></p>
          <p>Asistentes Efectivos: <span className="float-right">{isMultiDay ? '---' : presentCount}</span></p>
          <p>Ausentes / Justificados: <span className="float-right">{isMultiDay ? '---' : absenceCount}</span></p>
        </div>
      </div>

      {/* Bloque de Firmas */}
      <div className="hidden print:grid grid-cols-2 gap-24 mt-32 px-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-full border-t-2 border-slate-800"></div>
          <p className="text-[11px] font-black uppercase text-slate-600 tracking-[0.2em]">Responsable de Aula (Tutor)</p>
          <p className="text-[9px] font-bold text-slate-400 italic">Documento verificado bajo fe de veracidad</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-full border-t-2 border-slate-800"></div>
          <p className="text-[11px] font-black uppercase text-slate-600 tracking-[0.2em]">Dirección Académica / Auxiliaría</p>
          <p className="text-[9px] font-bold text-slate-400 italic">Control de Asistencia Valores y Ciencias</p>
        </div>
      </div>

      {/* Footer de Página Impresa */}
      <div className="hidden print:block fixed bottom-4 left-0 right-0 px-10">
        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] border-t border-slate-200 pt-5">
          <span>Sistema de Gestión V&C • Módulo de Reportes Oficiales</span>
          <span>Fecha de Emisión: {new Date().toLocaleDateString('es-PE')}</span>
        </div>
      </div>
    </div>
  );
};

export default ClassroomReportDetail;
