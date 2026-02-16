import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, LogOut } from 'lucide-react';

interface RequireAuthProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export const RequireAuth = ({ children, allowedRoles = ['ADMIN', 'SUBDIRECTOR', 'SUPERVISOR', 'SECRETARIA', 'DOCENTE', 'AUXILIAR'] }: RequireAuthProps) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [session, setSession] = useState<any>(null);

    const portalUrl = import.meta.env.VITE_PORTAL_URL;

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    const returnTo = encodeURIComponent(window.location.href);
                    window.location.href = `${portalUrl}/login?returnTo=${returnTo}`;
                    return;
                }

                setSession(session);

                // Check profile and role
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (error || !profile) {
                    console.error('Error fetching profile:', error);
                    setAuthorized(false);
                } else {
                    // Check if user role is in allowedRoles
                    // Normalize to uppercase and trim for comparison
                    const userRole = profile.role?.toUpperCase().trim();
                    const isAuthorized = allowedRoles.includes(userRole);

                    console.log('User Role found:', userRole);
                    console.log('Allowed Roles:', allowedRoles);
                    console.log('Is Authorized:', isAuthorized);

                    setAuthorized(isAuthorized);
                }
            } catch (error) {
                console.error('Auth check error:', error);
                setAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
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
