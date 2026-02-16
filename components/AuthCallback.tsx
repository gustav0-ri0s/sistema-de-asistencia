import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const AuthCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            // Get the hash part of the URL (without the leading #)
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);

            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            const returnTo = params.get('returnTo') || '/';

            if (access_token && refresh_token) {
                try {
                    const { error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });

                    if (error) throw error;

                    // Clear the hash from the URL
                    window.history.replaceState(null, '', window.location.pathname + window.location.search);

                    // Redirect to the intended path
                    navigate(returnTo, { replace: true });
                } catch (error) {
                    console.error('Error setting session:', error);
                    // Redirect to portal on error
                    window.location.href = `${import.meta.env.VITE_PORTAL_URL}/login?returnTo=${encodeURIComponent(window.location.origin)}`;
                }
            } else {
                // If no tokens, redirect to portal
                window.location.href = `${import.meta.env.VITE_PORTAL_URL}/login?returnTo=${encodeURIComponent(window.location.origin)}`;
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
            <div className="text-white text-xl animate-pulse">
                Verificando sesión...
            </div>
        </div>
    );
};

export default AuthCallback;
