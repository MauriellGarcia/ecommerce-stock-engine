import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Barrera de seguridad para rutas que requieren sesión activa.
 *
 * - Mientras `loading` es true (restaurando sesión desde localStorage),
 *   muestra un spinner para evitar un flash de redirección falso.
 * - Si el usuario no está autenticado, redirige a /auth/login y preserva
 *   la URL original en `state.from` para redirigir tras el login.
 * - Si el usuario está autenticado, renderiza los children.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Espera a que la sesión se restaure antes de decidir
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm">Verificando sesión...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    // Guarda la ruta a la que intentaba acceder para redirigir post-login
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
