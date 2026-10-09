import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Check, Loader2, AlertCircle, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../auth';
import { useCart, obtenerOCrearCarrito, agregarProductoAlCarrito } from '../../cart';
import { supabase } from '../../../lib/supabaseClient';
import type { Producto, RespuestaProcesarCompra } from '../../../types/database.types';

interface CatalogoProductosProps {
  productos: Producto[];
  cargando: boolean;
  onCompraExitosa?: () => void;
}

export function CatalogoProductos({ productos, cargando, onCompraExitosa }: CatalogoProductosProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refrescarCarrito } = useCart();

  // Estados para "Agregar al Carrito"
  const [agregandoId, setAgregandoId] = useState<number | null>(null);
  const [exitoId, setExitoId] = useState<number | null>(null);
  
  // Estados para Modal "Comprar Ahora" (Compra Directa)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidadDirecta, setCantidadDirecta] = useState<number>(1);
  const [procesandoDirecto, setProcesandoDirecto] = useState<boolean>(false);
  const [respuestaDirecta, setRespuestaDirecta] = useState<RespuestaProcesarCompra | null>(null);
  
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const formatPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(precio);
  };

  // ── Accion 1: Agregar al Carrito ──────────────────────────────────────────
  const handleAgregarAlCarrito = async (producto: Producto) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setAgregandoId(producto.id);
      setErrorMensaje(null);

      const carritoId = await obtenerOCrearCarrito(user.id);
      await agregarProductoAlCarrito(carritoId, producto.id, 1);
      await refrescarCarrito();

      setExitoId(producto.id);
      setTimeout(() => setExitoId(null), 2000);
    } catch (err) {
      console.error('[CatalogoProductos] Error al agregar al carrito:', err);
      setErrorMensaje('No se pudo agregar el producto al carrito.');
    } finally {
      setAgregandoId(null);
    }
  };

  // ── Accion 2: Comprar Ahora (Abrir Modal) ──────────────────────────────────
  const abrirModalCompraDirecta = (producto: Producto) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setProductoSeleccionado(producto);
    setCantidadDirecta(1);
    setRespuestaDirecta(null);
    setErrorMensaje(null);
  };

  const cerrarModal = () => {
    if (procesandoDirecto) return;
    setProductoSeleccionado(null);
    setCantidadDirecta(1);
    setRespuestaDirecta(null);
    setErrorMensaje(null);
  };

  const handleConfirmarCompraDirecta = async () => {
    if (!productoSeleccionado || cantidadDirecta <= 0) return;

    try {
      setProcesandoDirecto(true);
      setErrorMensaje(null);
      setRespuestaDirecta(null);

      // Pasar el ID del usuario autenticado si existe la sesión
      const { data, error } = await supabase.rpc('procesar_compra_concurrente', {
        p_producto_id: productoSeleccionado.id,
        p_cantidad: cantidadDirecta,
        p_usuario_id: user ? user.id : null,
      });

      if (error) throw error;

      const res = data as RespuestaProcesarCompra;
      setRespuestaDirecta(res);

      if (res.exito && onCompraExitosa) {
        onCompraExitosa();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado al procesar la compra.';
      setErrorMensaje(msg);
      console.error('[CatalogoProductos] Error en RPC procesar_compra_concurrente:', err);
    } finally {
      setProcesandoDirecto(false);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock > 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {stock} disponibles
        </span>
      );
    }

    if (stock >= 1 && stock <= 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          ¡Últimas {stock} unidades!
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Agotado
      </span>
    );
  };

  // Skeleton Loading
  if (cargando) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse flex flex-col justify-between h-80">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
                <div className="h-7 w-20 bg-slate-200 rounded-lg" />
              </div>
              <div className="h-6 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-full bg-slate-100 rounded" />
            </div>
            <div className="space-y-2 mt-4">
              <div className="h-10 w-full bg-slate-200 rounded-xl" />
              <div className="h-10 w-full bg-slate-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Estado vacío
  if (productos.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">No hay productos disponibles</h3>
        <p className="text-sm text-slate-500">Actualmente el inventario no cuenta con productos registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMensaje && !productoSeleccionado && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-sm font-medium">{errorMensaje}</span>
        </div>
      )}

      {/* Grid de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {productos.map((producto) => {
          const sinStock = producto.stock_disponible <= 0;
          const agregandoEste = agregandoId === producto.id;
          const exitoEste = exitoId === producto.id;

          return (
            <div
              key={producto.id}
              className={`bg-white rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
                sinStock ? 'border-slate-200 opacity-75' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  {getStockBadge(producto.stock_disponible)}
                  <span className="text-xl font-black text-slate-900 tracking-tight shrink-0">
                    {formatPrecio(producto.precio)}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-800 line-clamp-1 mb-2">
                  {producto.nombre}
                </h3>
                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-6">
                  {producto.descripcion}
                </p>
              </div>

              {/* Botones de Doble Acción */}
              <div className="space-y-2 pt-2">
                {/* Botón 1: Agregar al Carrito */}
                <button
                  type="button"
                  onClick={() => handleAgregarAlCarrito(producto)}
                  disabled={sinStock || agregandoEste}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 ${
                    sinStock
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : exitoEste
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]'
                  }`}
                >
                  {agregandoEste ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Agregando...
                    </>
                  ) : exitoEste ? (
                    <>
                      <Check className="w-4 h-4" />
                      ¡Agregado al carrito!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      {sinStock ? 'Sin Stock' : 'Agregar al Carrito'}
                    </>
                  )}
                </button>

                {/* Botón 2: Comprar Ahora (Directo) */}
                <button
                  type="button"
                  onClick={() => abrirModalCompraDirecta(producto)}
                  disabled={sinStock}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 ${
                    sinStock
                      ? 'hidden'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] shadow-xs'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Comprar Ahora
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Compra Directa */}
      {productoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative border border-slate-100">
            <button
              type="button"
              onClick={cerrarModal}
              disabled={procesandoDirecto}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5 pr-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1 block">
                Compra Directa
              </span>
              <h2 className="text-xl font-bold text-slate-900">{productoSeleccionado.nombre}</h2>
              <p className="text-sm text-slate-500 mt-1">
                Precio unitario: {formatPrecio(productoSeleccionado.precio)}
              </p>
            </div>

            {respuestaDirecta && (
              <div className="mb-5">
                {respuestaDirecta.exito ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-emerald-900">¡Compra realizada con éxito!</p>
                      <p className="text-emerald-800">{respuestaDirecta.mensaje}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-rose-900">No se pudo procesar</p>
                      <p className="text-rose-800">{respuestaDirecta.mensaje}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!respuestaDirecta?.exito ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="cantidad" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Cantidad a comprar
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="cantidad"
                      type="number"
                      min={1}
                      value={cantidadDirecta}
                      disabled={procesandoDirecto}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setCantidadDirecta(isNaN(val) ? 1 : Math.max(1, val));
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900"
                    />
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-slate-500 block">Subtotal</span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatPrecio(productoSeleccionado.precio * (cantidadDirecta || 1))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    disabled={procesandoDirecto}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarCompraDirecta}
                    disabled={procesandoDirecto || cantidadDirecta <= 0}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {procesandoDirecto ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      'Confirmar Compra'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-all"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
