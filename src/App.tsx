import { useState } from 'react';
import { ShoppingBag, ShieldCheck, Database, Zap, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { useProductos } from './hooks/useProductos';
import { CatalogoProductos } from './components/CatalogoProductos';
import { PanelQA } from './components/PanelQA';

export default function App() {
  const [tabActiva, setTabActiva] = useState<'catalogo' | 'qa'>('catalogo');
  const { productos, cargando, error, recargarProductos } = useProductos();

  // Calcular métricas rápidas para el header
  const totalStock = productos.reduce((acc, p) => acc + (p.stock_disponible || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* HEADER PRINCIPAL */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Título y Branding */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    E-Commerce Stock Engine
                  </h1>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Concurrency Control
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Motor transaccional con Supabase PostgreSQL</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600 hidden sm:inline" />
                  <span className="hidden sm:inline text-indigo-400 font-medium">
                    Row-Level Lock (FOR UPDATE)
                  </span>
                </p>
              </div>
            </div>

            {/* Badges de Estado y Métricas Rápidas */}
            <div className="flex items-center gap-2.5 self-start md:self-center">
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-slate-400">Stock Total:</span>
                <span className="font-bold text-white font-mono">
                  {cargando ? '...' : totalStock}
                </span>
              </div>

              <button
                type="button"
                onClick={recargarProductos}
                disabled={cargando}
                title="Sincronizar inventario"
                className="bg-slate-800/90 hover:bg-slate-750 active:scale-95 border border-slate-700/80 hover:border-slate-600 rounded-xl p-2 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* BARRA DE NAVEGACIÓN POR PESTAÑAS (TABS) */}
          <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => setTabActiva('catalogo')}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${tabActiva === 'catalogo'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Catálogo &amp; Compras</span>
              {!cargando && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-bold ${tabActiva === 'catalogo'
                      ? 'bg-indigo-800/80 text-white'
                      : 'bg-slate-800 text-slate-400'
                    }`}
                >
                  {productos.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('qa')}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${tabActiva === 'qa'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Panel Auditoría QA &amp; Estrés</span>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Zap className="w-3 h-3 fill-amber-400 text-amber-400" />
                ACID
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner de error global si falla conexión */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-100">Error al sincronizar con Supabase</p>
              <p className="text-sm text-rose-300/90">{error}</p>
              <p className="text-xs text-rose-400/80 mt-1">
                Verifica tus credenciales en el archivo <code>.env.local</code> y confirma que las tablas y RLS estén configuradas en tu proyecto Supabase.
              </p>
            </div>
          </div>
        )}

        {/* Renderizado de Vistas según Tab seleccionada */}
        {tabActiva === 'catalogo' ? (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Inventario en Tiempo Real
                </h2>
                <p className="text-sm text-slate-400">
                  Selecciona cualquier producto para adquirir stock. Las existencias se actualizan en vivo vía WebSockets.
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
            <PanelQA
              productos={productos}
              onRafagaCompletada={recargarProductos}
            />
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-6 mt-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Backend impulsado por <strong>Supabase PostgreSQL</strong> (Tier $0 USD) con bloqueo pesimista{' '}
              <code className="text-indigo-400 font-mono">FOR UPDATE</code> a nivel de fila.
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
