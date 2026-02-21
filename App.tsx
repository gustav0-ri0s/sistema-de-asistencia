import React, { useState, useEffect } from 'react';
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate
} from 'react-router-dom';
import {
  ClipboardCheck,
  BarChart3,
  Settings2,
  LogOut,
  Menu,
  UserCircle2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Home
} from 'lucide-react';
import { Classroom, StaffMember, UserRole, Meeting } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import AttendanceSheet from './components/AttendanceSheet.tsx';
import Reports from './components/Reports.tsx';
import Management from './components/Management.tsx';
import BimesterReport from './components/BimesterReport.tsx';
import ClassroomReportDetail from './components/ClassroomReportDetail.tsx';
import Meetings from './components/Meetings.tsx';
import MeetingAttendanceSheet from './components/MeetingAttendanceSheet.tsx';
import MeetingDetail from './components/MeetingDetail.tsx';
import MeetingReports from './components/MeetingReports.tsx';
import AuthCallback from './components/AuthCallback.tsx';
import RequireAuth from './components/RequireAuth.tsx';
import { supabase } from './lib/supabase';
import logo from './image/logo.png';

const IDLE_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in ms
const CHECK_INTERVAL = 60 * 1000; // 1 minute in ms
const ACTIVITY_KEY = 'vc_last_activity';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [reportConfig, setReportConfig] = useState<{ date: string, range: string, endDate?: string }>({
    date: new Date().toISOString().split('T')[0],
    range: 'Día'
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info', visible: boolean }>({
    message: '',
    type: 'success',
    visible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Idle Timeout Logic
  useEffect(() => {
    if (!currentUser) return;

    const checkIdleTimeout = () => {
      const lastActivity = localStorage.getItem(ACTIVITY_KEY);
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity, 10);
        if (timeSinceLastActivity > IDLE_TIMEOUT) {
          console.warn('Idle timeout reached, signing out...');
          handleLogout();
          return true;
        }
      }
      return false;
    };

    if (checkIdleTimeout()) return;

    const updateActivity = () => {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    };

    updateActivity();

    const events = ['mousedown', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(eventName => {
      window.addEventListener(eventName, updateActivity);
    });

    const interval = setInterval(checkIdleTimeout, CHECK_INTERVAL);

    return () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, updateActivity);
      });
      clearInterval(interval);
    };
  }, [currentUser]);

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
        'docente_ingles': 'Docente',
        'auxiliar': 'Auxiliar',
        'supervisor': 'Supervisor' as any,
        'subdirector': 'Administrador',
        'secretaria': 'Secretaria' as any
      };

      // Fetch assignments to classroom
      const { data: assignments } = await supabase
        .from('course_assignments')
        .select('classroom_id')
        .eq('profile_id', userId);

      const userAssignments = assignments?.map(a => ({ classroomId: a.classroom_id.toString() })) || [];

      // Add tutor classroom if exists
      if (profile.tutor_classroom_id) {
        const tutorClassroomId = profile.tutor_classroom_id.toString();
        if (!userAssignments.some(a => a.classroomId === tutorClassroomId)) {
          userAssignments.push({ classroomId: tutorClassroomId });
        }
      }

      setCurrentUser({
        id: profile.id,
        name: profile.full_name,
        role: roleMap[profile.role] || 'Docente',
        assignments: userAssignments
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during signOut:', err);
    }
    setCurrentUser(null);
    localStorage.removeItem(ACTIVITY_KEY);
    window.location.href = import.meta.env.VITE_PORTAL_URL || 'https://portal-vc-academico.vercel.app';
  };

  const navItems = [
    { id: 'DASHBOARD', icon: ClipboardCheck, label: 'Control Diario', path: '/' },
    { id: 'MEETINGS', icon: CalendarDays, label: 'Reuniones', path: '/reuniones' },
    { id: 'REPORTS', icon: BarChart3, label: 'Reportes', path: '/reportes' },
    ...(currentUser?.role === 'Administrador' ? [{ id: 'MANAGEMENT', icon: Settings2, label: 'Gestión Salones', path: '/gestion' }] : []),
  ];

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
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium tracking-tight">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <div className="flex min-h-screen bg-slate-50 overflow-hidden">
              {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
              )}

              <aside className={`
                fixed lg:static inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-300 ease-in-out border-r border-slate-100 print:hidden
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              `}>
                <div className="flex flex-col h-full">
                  <div className="p-10 flex flex-col items-center border-b border-slate-50">
                    <img src={logo} alt="Logo" className="w-24 h-24 mb-4 object-contain shadow-cyan-100 drop-shadow-lg" />
                    <h1 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Asistencia</h1>
                    <div className="px-3 py-1 bg-brand-celeste/10 rounded-full mt-1">
                      <p className="text-[10px] text-brand-celeste font-bold tracking-widest uppercase">Valores y Ciencias</p>
                    </div>
                  </div>

                  <nav className="flex-1 px-4 py-8 space-y-2">
                    {navItems.map((item) => {
                      const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(item.path);
                            setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 ${isActive
                            ? 'bg-brand-celeste text-white shadow-xl shadow-cyan-200 scale-[1.02]'
                            : 'text-slate-400 hover:bg-slate-50 hover:text-brand-celeste'
                            }`}
                        >
                          <item.icon size={20} className={isActive ? 'animate-pulse' : ''} />
                          <span className="font-bold text-sm tracking-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  <div className="p-6 space-y-2">
                    <button
                      onClick={() => window.location.href = import.meta.env.VITE_PORTAL_URL || '/'}
                      className="w-full flex items-center gap-3 px-6 py-4 text-slate-400 hover:text-brand-celeste rounded-2xl transition-all hover:bg-slate-50 border border-transparent hover:border-slate-100 group"
                    >
                      <Home size={20} className="group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-sm">Volver al Portal</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-6 py-4 text-slate-400 hover:text-rose-500 rounded-2xl transition-all hover:bg-rose-50 border border-transparent hover:border-rose-100 group"
                    >
                      <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                      <span className="font-bold text-sm">Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              </aside>

              <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between z-30 print:hidden shadow-sm">
                  <button className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors" onClick={() => setIsSidebarOpen(true)}>
                    <Menu size={24} />
                  </button>

                  <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                    <CalendarCheck className="text-brand-celeste" size={18} />
                    <span className="text-sm font-black text-slate-700 tracking-tight">
                      {getFormattedDate()}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 group">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-black text-slate-800 leading-none mb-1">{currentUser?.name || 'Usuario'}</p>
                      <p className="text-[10px] text-brand-celeste font-bold tracking-wider">{currentUser?.role.toUpperCase() || 'INVITADO'}</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-slate-50 border-2 border-brand-celeste flex items-center justify-center text-brand-celeste shadow-sm transition-transform group-hover:scale-105">
                      <UserCircle2 size={26} />
                    </div>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-slate-50/50 print:bg-white print:overflow-visible">
                  <Routes>
                    <Route path="/" element={
                      <Dashboard
                        user={currentUser}
                        onSelectClassroom={(c) => {
                          setSelectedClassroom(c);
                          navigate('/asistencia');
                        }}
                      />
                    } />
                    <Route path="/asistencia" element={
                      selectedClassroom ? (
                        <AttendanceSheet
                          classroom={selectedClassroom}
                          userId={currentUser?.id}
                          userName={currentUser?.name}
                          onBack={() => navigate('/')}
                          onViewReport={() => navigate('/reporte-bimestral')}
                          showToast={showToast}
                        />
                      ) : <Navigate to="/" replace />
                    } />
                    <Route path="/asistencias" element={<Navigate to="/" replace />} />
                    <Route path="/reporte-bimestral" element={
                      selectedClassroom ? (
                        <BimesterReport
                          classroom={selectedClassroom}
                          onBack={() => navigate('/asistencia')}
                        />
                      ) : <Navigate to="/" replace />
                    } />
                    <Route path="/reportes" element={
                      <Reports
                        user={currentUser}
                        onSelectClassroom={(classroom, date, range, endDate) => {
                          setSelectedClassroom(classroom);
                          setReportConfig({ date, range, endDate });
                          navigate('/reporte-detalle');
                        }}
                        onViewMeetingReports={() => navigate('/reportes-reuniones')}
                      />
                    } />
                    <Route path="/gestion" element={<Management showToast={showToast} />} />
                    <Route path="/reporte-detalle" element={
                      selectedClassroom ? (
                        <ClassroomReportDetail
                          classroom={selectedClassroom}
                          date={reportConfig.date}
                          range={reportConfig.range}
                          endDate={reportConfig.endDate}
                          onBack={() => navigate('/reportes')}
                        />
                      ) : <Navigate to="/reportes" replace />
                    } />
                    <Route path="/reportes-reuniones" element={
                      <MeetingReports
                        user={currentUser}
                        onBack={() => navigate('/reportes')}
                        onViewDetail={(meeting) => {
                          setSelectedMeeting(meeting);
                          navigate('/detalle-reunion');
                        }}
                      />
                    } />
                    <Route path="/reuniones" element={
                      <Meetings
                        user={currentUser}
                        showToast={showToast}
                        onCreateMeeting={(classroom, meetingId, meetingTitle) => {
                          setSelectedClassroom(classroom);
                          setSelectedMeeting({
                            id: meetingId,
                            title: meetingTitle,
                            date: new Date().toISOString().split('T')[0],
                            classroom_id: classroom.id,
                            classroom_name: classroom.name,
                            created_at: new Date().toISOString(),
                            attendance_count: 0,
                            total_students: 0
                          });
                          navigate('/asistencia-reunion');
                        }}
                        onViewMeetingDetail={(meeting) => {
                          setSelectedMeeting(meeting);
                          navigate('/detalle-reunion');
                        }}
                      />
                    } />
                    <Route path="/asistencia-reunion" element={
                      selectedClassroom && selectedMeeting ? (
                        <MeetingAttendanceSheet
                          classroom={selectedClassroom}
                          meetingId={selectedMeeting.id}
                          meetingTitle={selectedMeeting.title}
                          onBack={() => navigate('/reuniones')}
                          showToast={showToast}
                        />
                      ) : <Navigate to="/reuniones" replace />
                    } />
                    <Route path="/detalle-reunion" element={
                      selectedMeeting ? (
                        <MeetingDetail
                          meeting={selectedMeeting}
                          onBack={() => navigate(-1)}
                          onEditAttendance={(meeting) => {
                            setSelectedMeeting(meeting);
                            const classroom = {
                              id: meeting.classroom_id,
                              name: meeting.classroom_name,
                              level: 'Primaria' as any,
                              studentCount: 0
                            };
                            setSelectedClassroom(classroom as Classroom);
                            navigate('/asistencia-reunion');
                          }}
                        />
                      ) : <Navigate to="/reuniones" replace />
                    } />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>

                {/* Floating Toast Notification */}
                {toast.visible && (
                  <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 duration-300">
                    <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' :
                      toast.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' :
                        'bg-slate-800 border-slate-700 text-white'
                      }`}>
                      {toast.type === 'success' && <CheckCircle2 size={20} />}
                      {toast.type === 'error' && <XCircle size={20} />}
                      {toast.type === 'info' && <AlertCircle size={20} />}
                      <span className="font-black text-sm tracking-tight">{toast.message}</span>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
};

export default App;
