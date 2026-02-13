
import React from 'react';
import { UserCheck, ShieldCheck, ChevronRight, Layers, LayoutGrid, PlusCircle, Save, X, Check, Loader2, Grip, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StaffMember, Classroom, Level, UserRole } from '../types';

interface AssignmentModalProps {
  member: StaffMember;
  classrooms: Classroom[];
  existingAssignments: number[]; // classroom IDs
  onClose: () => void;
  onSave: (memberId: string, selectedClassroomIds: number[]) => Promise<void>;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({ member, classrooms, existingAssignments, onClose, onSave }) => {
  const [selectedIds, setSelectedIds] = React.useState<number[]>(existingAssignments);

  // Group by level
  // Helper to normalize level string for comparison
  const normalize = (s: string) => s.toLowerCase();

  // Group by level with case-insensitive check
  const byLevel: Record<string, Classroom[]> = {
    'Inicial': classrooms.filter(c => normalize(c.level) === 'inicial'),
    'Primaria': classrooms.filter(c => normalize(c.level) === 'primaria'),
    'Secundaria': classrooms.filter(c => normalize(c.level) === 'secundaria')
  };

  const handleLevelToggle = (level: string) => {
    const levelClassrooms = byLevel[level];
    const levelIds = levelClassrooms.map(c => Number(c.id));
    const allSelected = levelIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      // Unselect all
      setSelectedIds(prev => prev.filter(id => !levelIds.includes(id)));
    } else {
      // Select all (add missing ones)
      setSelectedIds(prev => {
        const newIds = [...prev];
        levelIds.forEach(id => {
          if (!newIds.includes(id)) newIds.push(id);
        });
        return newIds;
      });
    }
  };

  const handleClassroomToggle = (classroomId: number) => {
    setSelectedIds(prev =>
      prev.includes(classroomId)
        ? prev.filter(id => id !== classroomId)
        : [...prev, classroomId]
    );
  };

  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(member.id, selectedIds);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-800">Asignar Aulas</h3>
            <p className="text-sm font-medium text-slate-400">Gestionando accesos para <span className="text-brand-celeste font-bold">{member.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {Object.entries(byLevel).map(([level, levelClassrooms]) => {
            if (levelClassrooms.length === 0) return null;

            const levelIds = levelClassrooms.map(c => Number(c.id));
            const isAllSelected = levelIds.every(id => selectedIds.includes(id));
            const isIndeterminate = levelIds.some(id => selectedIds.includes(id)) && !isAllSelected;

            return (
              <div key={level} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${level === 'Inicial' ? 'bg-amber-100 text-amber-600' : level === 'Primaria' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      <Layers size={20} />
                    </div>
                    <h4 className="font-black text-slate-700 uppercase tracking-widest text-sm">{level}</h4>
                  </div>
                  <button
                    onClick={() => handleLevelToggle(level)}
                    className="flex items-center gap-2 group/btn"
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isAllSelected
                      ? 'bg-brand-celeste border-brand-celeste'
                      : isIndeterminate
                        ? 'bg-brand-celeste/50 border-brand-celeste/50'
                        : 'border-slate-300 bg-white group-hover/btn:border-brand-celeste'
                      }`}>
                      {isAllSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                      {isIndeterminate && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </div>
                    <span className={`text-xs font-bold transition-colors ${isAllSelected ? 'text-brand-celeste' : 'text-slate-400 group-hover/btn:text-slate-600'}`}>
                      {isAllSelected ? 'TODOS SELECCIONADOS' : 'MARCAR TODO EL NIVEL'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {levelClassrooms.map(classroom => {
                    const isSelected = selectedIds.includes(Number(classroom.id));
                    return (
                      <div
                        key={classroom.id}
                        onClick={() => handleClassroomToggle(Number(classroom.id))}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden group ${isSelected
                          ? 'border-brand-celeste bg-cyan-50/30 shadow-md'
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <span className={`text-xs font-black ${isSelected ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            {classroom.name}
                          </span>
                          {isSelected && <div className="w-5 h-5 bg-brand-celeste rounded-full flex items-center justify-center text-white shadow-sm"><Check size={12} strokeWidth={4} /></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all text-xs"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-slate-800 text-white rounded-xl font-black text-xs shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            GUARDAR CAMBIOS
          </button>
        </div>
      </div>
    </div>
  );
};

const Management: React.FC = () => {
  const [users, setUsers] = React.useState<StaffMember[]>([]);
  const [classrooms, setClassrooms] = React.useState<Classroom[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingMember, setEditingMember] = React.useState<StaffMember | null>(null);

  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Users (Profiles)
      const { data: profiles, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('active', true)
        .order('full_name');

      if (usersError) throw usersError;

      // 2. Fetch Classrooms
      const { data: classroomsData, error: classroomsError } = await supabase
        .from('classrooms') // ensure 'classrooms' table is used
        .select('*')
        .eq('active', true)
        .order('level')
        .order('grade')
        .order('section');

      if (classroomsError) throw classroomsError;

      // 3. Fetch Assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('course_assignments')
        .select('profile_id, classroom_id');

      if (assignmentsError) throw assignmentsError;

      // Map profiles to StaffMember structure
      const mappedUsers: StaffMember[] = profiles.map((p: any) => {
        // Find assignments for this user
        const userAssignments = assignmentsData
          .filter((a: any) => a.profile_id === p.id)
          .map((a: any) => ({
            classroomId: String(a.classroom_id) // Map to string for local logic
          }));

        // Determine role mapping
        let role: UserRole = 'Docente';
        if (p.role === 'admin') role = 'Administrador';
        if (p.role === 'supervisor') role = 'Supervisor';
        if (p.role === 'secretaria') role = 'Secretaria';
        if (p.role === 'docente') role = 'Docente';

        return {
          id: p.id,
          name: p.full_name || p.email, // Fallback to email if name missing
          role: role,
          assignments: userAssignments
        };
      });

      setUsers(mappedUsers);
      setClassrooms(classroomsData.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        level: c.level.charAt(0).toUpperCase() + c.level.slice(1).toLowerCase(), // Normalize to Title Case
        studentCount: 0 // Not needed for this view
      })));

    } catch (err) {
      console.error('Error fetching management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignments = async (memberId: string, selectedClassroomIds: number[]) => {
    try {
      // 1. Delete existing for this user
      const { error: deleteError } = await supabase
        .from('course_assignments')
        .delete()
        .eq('profile_id', memberId);

      if (deleteError) throw deleteError;

      // 2. Insert new ones
      if (selectedClassroomIds.length > 0) {
        const toInsert = selectedClassroomIds.map(cid => ({
          profile_id: memberId,
          classroom_id: cid,
          created_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('course_assignments')
          .insert(toInsert);

        if (insertError) throw insertError;
      }

      // 3. Refresh local state
      await fetchData();
      setEditingMember(null);

    } catch (err) {
      console.error('Error saving assignments:', err);
      alert('Error al guardar asignaciones');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestión de Personal</h2>
          <p className="text-slate-400 text-sm font-medium">Asignación de aulas y niveles a docentes y auxiliares.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4 col-span-1">
            <Loader2 className="animate-spin text-brand-celeste" size={48} />
            <p className="text-slate-400 font-bold">Cargando personal...</p>
          </div>
        ) : users.map(member => (
          <div key={member.id} className="neumorphic-card rounded-[2.5rem] bg-white p-8 flex flex-col md:flex-row md:items-center gap-8 border border-slate-50 shadow-lg">
            <div className="flex items-center gap-6 flex-1">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 border-2 border-brand-celeste flex items-center justify-center text-brand-celeste shadow-inner">
                {member.role === 'Administrador' ? <ShieldCheck size={36} /> : <UserCheck size={36} />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-xl font-black text-slate-800 tracking-tight">{member.name}</h4>
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full ${member.role === 'Docente' ? 'bg-cyan-50 text-brand-celeste' :
                    member.role === 'Auxiliar' ? 'bg-amber-50 text-amber-500' :
                      member.role === 'Supervisor' ? 'bg-purple-50 text-purple-600' :
                        member.role === 'Secretaria' ? 'bg-pink-50 text-pink-600' : 'bg-slate-800 text-white'
                    }`}>
                    {member.role.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold">Asignaciones: {member.assignments.length === 0 ? 'Control Total' : member.assignments.length + ' ítems'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 flex-[2]">
              {member.role === 'Administrador' ? (
                <div className="bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest border border-emerald-100 uppercase flex items-center gap-2">
                  <ShieldCheck size={14} />
                  Acceso Total al Sistema
                </div>
              ) : member.assignments.length === 0 ? (
                <div className="bg-slate-50 text-slate-400 px-4 py-2.5 rounded-xl text-[10px] font-bold tracking-widest border border-slate-100 uppercase italic">
                  Sin asignaciones activas
                </div>
              ) : (
                member.assignments.map((as, i) => {
                  const classroom = classrooms.find(c => c.id === as.classroomId);
                  if (!classroom) return null;
                  return (
                    <div key={i} className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl flex items-center gap-2 group hover:bg-white hover:border-brand-celeste transition-all cursor-default shadow-sm">
                      <LayoutGrid size={14} className="text-brand-celeste" />
                      <span className="text-[10px] font-black text-slate-600">
                        {classroom.name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setEditingMember(member)}
              className="bg-slate-50 p-4 rounded-2xl text-slate-400 hover:text-brand-celeste hover:bg-cyan-50 transition-all group shadow-sm border border-slate-50"
            >
              <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ))}
      </div>

      {/* Modal de Asignación */}
      {editingMember && (
        <AssignmentModal
          member={editingMember}
          classrooms={classrooms}
          existingAssignments={editingMember.assignments.map(a => Number(a.classroomId))}
          onClose={() => setEditingMember(null)}
          onSave={handleSaveAssignments}
        />
      )}
    </div>
  );
};

export default Management;
