import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Package,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import {
  eliminarProductoDelCarrito,
  actualizarCantidadEnCarrito,
  vaciarCarrito,
  type CartItem,
} from '../../services/cartService';
import { supabase } from '../../lib/supabaseClient';

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatearPrecio(valor: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(valor);
}

// ─── Sub-componente: Fila de producto ─────────────────────────────────────────

interface CartRowProps {
  item: CartItem;
  onCantidadChange: (item: CartItem, delta: number) => Promise<void>;
  onEliminar: (item: CartItem) => Promise<void>;
  procesando: boolean;
}

function CartRow({ item, onCantidadChange, onEliminar, procesando }: CartRowProps) {
  const precio = item.producto?.precio ?? 0;
  const subtotal = precio * item.cantidad;

  return (
    <div
      className={[
        'group flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5',
        'bg-slate-900/70 border border-slate-800/80 rounded-2xl transition-all duration-200',
        procesando
          ? 'opacity-60 pointer-events-none'
          : 'hover:border-slate-700/80 hover:bg-slate-900',
      ].join(' ')}
    >
      {/* Imagen miniatura */}
      <div className="w-full sm:w-20 h-40 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60">
        {item.producto?.imagen_url ? (
          <img
            src={item.producto.imagen_url}
            alt={item.producto.nombre}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://placehold.co/80x80/1e293b/94a3b8?text=IMG';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-slate-600" />
          </div>
        )}
      </div>

      {/* Nombre y precio unitario */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate text-sm sm:text-base">
          {item.producto?.nombre ?? '—'}
        </p>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Precio unitario:{' '}
          <span className="text-indigo-300 font-medium">{formatearPrecio(precio)}</span>
        </p>
      </div>

      {/* Selector de cantidad */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Reducir cantidad"
          onClick={() => onCantidadChange(item, -1)}
          disabled={item.cantidad <= 1 || procesando}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-90 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <span className="w-10 text-center font-bold text-white font-mono text-sm select-none">
          {procesando ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mx-auto" />
          ) : (
            item.cantidad
          )}
        </span>

        <button
          type="button"
          aria-label="Aumentar cantidad"
          onClick={() => onCantidadChange(item, +1)}
          disabled={procesando}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 hover:bg-indigo-600/80 active:scale-90 border border-slate-700 hover:border-indigo-500/60 text-slate-300 hover:text-white transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtotal desktop */}
      <div className="hidden sm:block text-right min-w-[90px]">
        <p className="text-xs text-slate-500 mb-0.5">Subtotal</p>
        <p className="font-bold text-white text-sm">{formatearPrecio(subtotal)}</p>
      </div>

      {/* Subtotal móvil */}
      <div className="flex sm:hidden items-center justify-between border-t border-slate-800 pt-3 mt-1">
        <span className="text-xs text-slate-500">Subtotal</span>
        <span className="font-bold text-white text-sm">{formatearPrecio(subtotal)}</span>
      </div>

      {/* Botón eliminar */}
      <button
        type="button"
        aria-label="Eliminar producto del carrito"
        onClick={() => onEliminar(item)}
        disabled={procesando}
        className="self-start sm:self-center w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-800 hover:bg-rose-950/70 active:scale-90 border border-slate-700 hover:border-rose-800/60 text-slate-500 hover:text-rose-400 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Layout wrapper ───────────────────────────────────────────────────────────

function CartLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">Mi Carrito</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CartPage() {
  const navigate = useNavigate();
  const { items, cargandoCarrito, refrescarCarrito } = useCart();

  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce(
    (acc, item) => acc + (item.producto?.precio ?? 0) * item.cantidad,
    0
  );
  // Suma total de unidades individuales de todos los productos
  const totalUnidades = items.reduce((acc, item) => acc + item.cantidad, 0);

  // ── Cambiar cantidad ────────────────────────────────────────────────────────
  const handleCantidadChange = useCallback(
    async (item: CartItem, delta: number) => {
      const nuevaCantidad = item.cantidad + delta;
      if (nuevaCantidad < 1) return;
      setError(null);
      setProcesandoId(item.id);
      try {
        await actualizarCantidadEnCarrito(item.id, nuevaCantidad);
        await refrescarCarrito();
      } catch (err) {
        console.error('[CartPage] Error al actualizar cantidad:', err);
        setError('No se pudo actualizar la cantidad. Intenta de nuevo.');
      } finally {
        setProcesandoId(null);
      }
    },
    [refrescarCarrito]
  );

  // ── Eliminar producto ───────────────────────────────────────────────────────
  const handleEliminar = useCallback(
    async (item: CartItem) => {
      setError(null);
      setProcesandoId(item.id);
      try {
        await eliminarProductoDelCarrito(item.id);
        await refrescarCarrito();
      } catch (err) {
        console.error('[CartPage] Error al eliminar producto:', err);
        setError('No se pudo eliminar el producto. Intenta de nuevo.');
      } finally {
        setProcesandoId(null);
      }
    },
    [refrescarCarrito]
  );


// ── Finalizar compra ────────────────────────────────────────────────────────
  // ── Finalizar compra con RPC Supabase ─────────────────────────────────────────
const handleFinalizarCompra = async () => {
  if (finalizando || items.length === 0) return;

  const carritoIdItem = items[0]?.carrito_id;
  if (!carritoIdItem) {
    setError('No se pudo identificar el carrito activo.');
    return;
  }

  setFinalizando(true);
  setError(null);

  try {
    // Obtener la sesión activa del usuario desde Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Debes iniciar sesión para completar la compra.');
      return;
    }

    // Invocar el procedimiento almacenado transaccional en PostgreSQL
    const { data, error: rpcError } = await supabase.rpc('procesar_compra_carrito', {
      p_carrito_id: carritoIdItem,
      p_usuario_id: session.user.id,
    });

    if (rpcError) throw rpcError;

    if (data && data.exito) {
      // Refrescar estado global del carrito (pasa a 0)
      await refrescarCarrito();
      setMensajeExito(true);
    } else {
      setError(data?.mensaje || 'No se pudo procesar la compra.');
    }
  } catch (err) {
    console.error('[CartPage] Error al finalizar compra:', err);
    setError('Ocurrió un error al procesar tu compra. Intenta nuevamente.');
  } finally {
    setFinalizando(false);
  }
};

  // ── Estado: cargando ────────────────────────────────────────────────────────
  if (cargandoCarrito) {
    return (
      <CartLayout>
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-slate-400 text-sm">Cargando tu carrito…</p>
        </div>
      </CartLayout>
    );
  }

  // ── Estado: éxito post-compra ───────────────────────────────────────────────
  if (mensajeExito) {
    return (
      <CartLayout>
        <div className="flex flex-col items-center justify-center py-28 gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">¡Compra realizada!</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              Tu pedido ha sido procesado correctamente. Recibirás una confirmación pronto.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-600/30 transition-all duration-150"
          >
            <ShoppingBag className="w-4 h-4" />
            Seguir comprando
          </button>
        </div>
      </CartLayout>
    );
  }

  // ── Estado: carrito vacío ───────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <CartLayout>
        <div className="flex flex-col items-center justify-center py-28 gap-6 text-center">
          <div className="w-24 h-24 rounded-3xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
            <ShoppingCart className="w-12 h-12 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tu carrito está vacío</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
              Aún no has agregado ningún producto. Explora el catálogo y añade los artículos que desees.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-600/30 transition-all duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir al catálogo
          </button>
        </div>
      </CartLayout>
    );
  }

  // ── Vista principal ─────────────────────────────────────────────────────────
  return (
    <CartLayout>
      {/* Banner de error */}
      {error && (
        <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Lista de productos */}
        <section className="flex-1 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-slate-300">
           {totalUnidades} {totalUnidades === 1 ? 'artículo' : 'artículos'} en tu carrito
           </h2>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Seguir comprando
            </button>
          </div>

          {items.map((item) => (
            <CartRow
              key={item.id}
              item={item}
              onCantidadChange={handleCantidadChange}
              onEliminar={handleEliminar}
              procesando={procesandoId === item.id}
            />
          ))}
        </section>

        {/* Tarjeta de resumen */}
        <aside className="lg:w-80 xl:w-96 shrink-0">
          <div className="sticky top-28 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              Resumen de orden
            </h2>

            {/* Desglose por producto */}
            <div className="space-y-2.5 mb-5">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 truncate flex-1">
                    {item.producto?.nombre ?? '—'}{' '}
                    <span className="text-slate-600">× {item.cantidad}</span>
                  </span>
                  <span className="text-xs text-slate-300 font-medium shrink-0">
                    {formatearPrecio((item.producto?.precio ?? 0) * item.cantidad)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 mb-4" />

            {/* Total dinámico */}
            <div className="flex items-center justify-between mb-6">
              <span className="font-semibold text-slate-300">Total a pagar</span>
              <span className="text-xl font-black text-white tracking-tight">
                {formatearPrecio(total)}
              </span>
            </div>

            {/* Botón Finalizar Compra */}
            <button
              type="button"
              id="btn-finalizar-compra"
              onClick={handleFinalizarCompra}
              disabled={finalizando || items.length === 0}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-lg shadow-indigo-600/30 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {finalizando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Finalizar Compra
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-600 text-center mt-3">
              Transacción protegida · Supabase PostgreSQL
            </p>
          </div>
        </aside>
      </div>
    </CartLayout>
  );
}
