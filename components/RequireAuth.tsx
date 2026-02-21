import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, LogOut } from 'lucide-react';

interface RequireAuthProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

const DEFAULT_ALLOWED_ROLES = ['ADMIN', 'SUBDIRECTOR', 'SUPERVISOR', 'SECRETARIA', 'DOCENTE', 'AUXILIAR', 'DOCENTE_INGLES'];

export const RequireAuth = ({ children, allowedRoles = DEFAULT_ALLOWED_ROLES }: RequireAuthProps) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [session, setSession] = useState<any>(null);

    const portalUrl = import.meta.env.VITE_PORTAL_URL;

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

                if (!isMounted) return;

                if (sessionError || !currentSession) {
                    const returnTo = encodeURIComponent(window.location.href);
                    window.location.href = `${portalUrl}/login?returnTo=${returnTo}`;
                    return;
                }

                setSession(currentSession);

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', currentSession.user.id)
                    .single();

                if (!isMounted) return;

                if (profileError || !profile) {
                    console.error('Error fetching profile:', profileError);
                    setAuthorized(false);
                } else {
                    const userRole = profile.role?.toUpperCase().trim();
                    const isAuthorized = allowedRoles.includes(userRole);
                    setAuthorized(isAuthorized);
                }
            } catch (error) {
                console.error('Auth check error:', error);
                if (isMounted) setAuthorized(false);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        checkAuth();
        return () => { isMounted = false; };
    }, [allowedRoles, portalUrl]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.href = portalUrl;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium">Verificando acceso...</p>
                </div>
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0d1117] p-4 text-white">
                <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-2xl p-8 shadow-2xl text-center">
                    <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert size={40} className="text-red-500" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">403 - Acceso Denegado</h1>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        No tienes los permisos necesarios para acceder a este módulo.
                        Si crees que esto es un error, contacta al administrador.
                    </p>
                    <div className="space-y-4">
                        <button
                            onClick={() => window.location.href = portalUrl}
                            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-3 px-6 rounded-lg transition-colors border border-transparent"
                        >
                            Volver al Portal
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <LogOut size={18} />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default RequireAuth;
