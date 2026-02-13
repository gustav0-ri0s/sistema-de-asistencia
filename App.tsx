import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  BarChart3,
  Settings2,
  School,
  LogOut,
  Menu,
  UserCircle2,
  CalendarCheck
} from 'lucide-react';
import { ViewState, Classroom, StaffMember, UserRole } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import AttendanceSheet from './components/AttendanceSheet.tsx';
import Reports from './components/Reports.tsx';
import Management from './components/Management.tsx';
import BimesterReport from './components/BimesterReport.tsx';
import ClassroomReportDetail from './components/ClassroomReportDetail.tsx';
import Login from './components/Login.tsx';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState<{ date: string, range: string, endDate?: string }>({
    date: new Date().toISOString().split('T')[0],
    range: 'Día'
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthenticated(!!session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthenticated(!!session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Map roles from DB to App roles
      const roleMap: Record<string, UserRole> = {
        'admin': 'Administrador',
        'docente': 'Docente',
        'auxiliar': 'Auxiliar',
        'supervisor': 'Administrador', // Mapping for now
        'subdirector': 'Administrador',
        'secretaria': 'Auxiliar'
      };

      // Fetch assignments to classroom
      const { data: assignments } = await supabase
        .from('course_assignments')
        .select('classroom_id')
        .eq('profile_id', userId);

      setCurrentUser({
        id: profile.id,
        name: profile.full_name,
        role: roleMap[profile.role] || 'Docente',
        assignments: assignments?.map(a => ({ classroomId: a.classroom_id.toString() })) || []
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentView('DASHBOARD');
  };

  const navItems = currentUser ? [
    { id: 'DASHBOARD', icon: ClipboardCheck, label: 'Control Diario' },
    { id: 'REPORTS', icon: BarChart3, label: 'Reportes' },
    ...(currentUser.role === 'Administrador' ? [{ id: 'MANAGEMENT', icon: Settings2, label: 'Gestión Salones' }] : []),
  ] : [];

  const handleOpenClassroomReport = (classroom: Classroom, date: string, range: string, endDate?: string) => {
    setSelectedClassroom(classroom);
    setReportConfig({ date, range, endDate });
    setCurrentView('CLASSROOM_REPORT_DETAIL');
  };

  const getFormattedDate = () => {
    const date = new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date());
    return date.charAt(0).toUpperCase() + date.slice(1).replace(',', '');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-celeste border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-500">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={(session) => {
      setSession(session);
      setIsAuthenticated(true);
    }} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-celeste border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-500">Cargando perfil...</p>
          <button onClick={handleLogout} className="mt-4 text-xs text-slate-400 hover:text-brand-celeste underline">
            Cerrar sesión si el error persiste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out border-r border-slate-100 print:hidden
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-10 flex flex-col items-center border-b border-slate-50">
            <div className="w-16 h-16 rounded-3xl bg-brand-celeste flex items-center justify-center shadow-lg shadow-cyan-100 mb-4">
              <School className="text-white" size={32} />
            </div>
            <h1 className="text-lg font-black text-slate-800">ASISTENCIA</h1>
            <p className="text-[10px] text-brand-celeste font-bold tracking-widest uppercase">Valores y Ciencias</p>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as ViewState);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${currentView === item.id
                  ? 'bg-brand-celeste text-white shadow-lg shadow-cyan-100'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-brand-celeste'
                  }`}
              >
                <item.icon size={20} />
                <span className="font-bold text-sm tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-6">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-5 py-4 text-slate-400 hover:text-rose-500 rounded-2xl transition-all hover:bg-rose-50"
            >
              <LogOut size={20} />
              <span className="font-bold text-sm">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between z-30 print:hidden">
          <button className="lg:hidden p-2 text-slate-400" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>

          <div className="flex items-center gap-3">
            <CalendarCheck className="text-brand-celeste" size={20} />
            <span className="text-sm font-black text-slate-700 tracking-tighter">
              {getFormattedDate()}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-800 leading-none">{currentUser?.name || 'Usuario'}</p>
              <p className="text-[10px] text-brand-celeste font-bold">{currentUser?.role.toUpperCase() || 'S/R'}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border-2 border-brand-celeste flex items-center justify-center text-brand-celeste shadow-sm">
              <UserCircle2 size={24} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 print:bg-white print:overflow-visible">
          {currentView === 'DASHBOARD' && (
            <Dashboard
              user={currentUser}
              onSelectClassroom={(c) => {
                setSelectedClassroom(c);
                setCurrentView('ATTENDANCE_SHEET');
              }}
            />
          )}
          {currentView === 'ATTENDANCE_SHEET' && selectedClassroom && (
            <AttendanceSheet
              classroom={selectedClassroom}
              userId={currentUser?.id}
              onBack={() => setCurrentView('DASHBOARD')}
              onViewReport={() => setCurrentView('BIMESTER_REPORT')}
            />
          )}
          {currentView === 'BIMESTER_REPORT' && selectedClassroom && (
            <BimesterReport
              classroom={selectedClassroom}
              onBack={() => setCurrentView('ATTENDANCE_SHEET')}
            />
          )}
          {currentView === 'REPORTS' && (
            <Reports onSelectClassroom={handleOpenClassroomReport} />
          )}
          {currentView === 'MANAGEMENT' && (
            <Management />
          )}
          {currentView === 'CLASSROOM_REPORT_DETAIL' && selectedClassroom && (
            <ClassroomReportDetail
              classroom={selectedClassroom}
              date={reportConfig.date}
              range={reportConfig.range}
              endDate={reportConfig.endDate}
              onBack={() => setCurrentView('REPORTS')}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
