import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { useProductos, CatalogoProductos } from '../features/products';
import { PanelQA } from '../features/qa';
import { useAuth } from '../features/auth';
import { useCart } from '../features/cart';

// ─── Vista principal de la app (requiere sesión) ──────────────────────────────

export function AppShell() {
  const [tabActiva, setTabActiva] = useState<'catalogo' | 'qa'>('catalogo');
  const { productos, cargando, error, recargarProductos } = useProductos();
  const { logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  const totalStock = productos.reduce((acc, p) => acc + (p.stock_disponible || 0), 0);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login', { replace: true });
    } catch {
      // ignora errores al cerrar sesión
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* HEADER PRINCIPAL */}
      <AppHeader
        totalStock={totalStock}
        itemCount={itemCount}
        cargando={cargando}
        totalProductos={productos.length}
        recargarProductos={recargarProductos}
        handleLogout={handleLogout}
        tabActiva={tabActiva}
        setTabActiva={setTabActiva}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner de error global */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-100">Error al sincronizar con Supabase</p>
              <p className="text-sm text-rose-300/90">{error}</p>
              <p className="text-xs text-rose-400/80 mt-1">
                Verifica tus credenciales en el archivo <code>.env.local</code> y confirma que las
                tablas y RLS estén configuradas en tu proyecto Supabase.
              </p>
            </div>
          </div>
        )}

        {tabActiva === 'catalogo' ? (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Inventario en Tiempo Real
                </h2>
                <p className="text-sm text-slate-400">
                  Selecciona cualquier producto para adquirir stock. Las existencias se actualizan
                  en vivo vía WebSockets.
                </p>
              </div>
            </div>
            <CatalogoProductos
              productos={productos}
              cargando={cargando}
              onCompraExitosa={recargarProductos}
            />
          </section>
        ) : (
          <section>
            <PanelQA productos={productos} onRafagaCompletada={recargarProductos} />
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-6 mt-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Backend impulsado por <strong>Supabase PostgreSQL</strong> (Tier $0 USD) con bloqueo
              pesimista <code className="text-indigo-400 font-mono">FOR UPDATE</code> a nivel de fila.
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <span>React 19</span>
            <span>•</span>
            <span>TypeScript</span>
            <span>•</span>
            <span>TailwindCSS</span>
            <span>•</span>
            <span>Supabase Realtime</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
