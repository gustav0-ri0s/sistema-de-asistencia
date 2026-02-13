import React, { useState } from 'react';
import { LogIn, School, X, Info, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (session: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        onLogin(data.session);
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#E6F7F9] flex flex-col items-center justify-center p-4 font-['Inter'] relative overflow-hidden">
      {/* Main Card */}
      <div className="w-full max-w-[480px] bg-white rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-500 z-10">

        {/* Top Section - Brand Color */}
        <div className="bg-brand-celeste px-8 py-12 flex flex-col items-center text-center">
          {/* Logo Container */}
          <div className="w-24 h-24 bg-white rounded-[1.5rem] shadow-lg flex items-center justify-center p-3 mb-6">
            <div className="w-full h-full border-2 border-brand-celeste/20 rounded-xl flex items-center justify-center">
              <School className="text-brand-celeste" size={48} />
            </div>
          </div>

          <h1 className="text-white text-3xl font-black italic tracking-tight mb-1 uppercase">
            VALORES Y CIENCIAS
          </h1>
          <p className="text-white/80 text-[10px] font-black tracking-[0.2em] uppercase">
            Módulo de asistencia
          </p>
        </div>

        {/* Bottom Section - Form */}
        <div className="p-10 sm:p-14 flex flex-col space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-xs font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A0AEC0] tracking-[0.1em] uppercase ml-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                placeholder="ejemplo@vctarapoto.edu.pe"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F7FAFC] border-none rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-brand-celeste outline-none transition-all shadow-inner"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A0AEC0] tracking-[0.1em] uppercase ml-1">
                Contraseña Segura
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#F7FAFC] border-none rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-brand-celeste outline-none transition-all shadow-inner"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-celeste text-white py-5 rounded-2xl font-black text-sm tracking-[0.1em] flex items-center justify-center gap-3 shadow-lg shadow-cyan-100 hover:bg-[#4AB8C8] transition-all active:scale-[0.98] mt-4 uppercase disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              {loading ? 'Iniciando sesión...' : 'Entrar al Sistema'}
            </button>
          </form>

          {/* Forgot Access Link */}
          <button
            onClick={() => setShowModal(true)}
            className="text-[10px] font-black text-[#A0AEC0] tracking-[0.1em] uppercase hover:text-brand-celeste transition-colors text-center"
          >
            ¿Olvidaste tu acceso institucional?
          </button>
        </div>
      </div>

      {/* Page Footer */}
      <footer className="mt-12 text-[10px] font-black text-brand-celeste/60 tracking-[0.2em] uppercase z-10">
        I.E.P. Valores y Ciencias © 2026
      </footer>

      {/* Modal for Forgot Access */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-6 right-6">
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center text-brand-celeste">
                <Info size={32} />
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Recuperar Acceso</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Debe comunicarse con el administrador de la plataforma de la Institución Educativa para restablecer sus credenciales.
                </p>
              </div>

              <div className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo de Soporte</p>
                <a
                  href="mailto:informatica@muivc.com"
                  className="text-brand-celeste font-black text-sm hover:underline"
                >
                  informatica@muivc.com
                </a>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-slate-800 text-white py-4 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-slate-900 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
