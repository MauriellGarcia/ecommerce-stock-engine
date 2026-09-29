import { useState } from 'react';
import { ShoppingBag, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { Producto, RespuestaProcesarCompra } from '../types/database.types';

interface CatalogoProductosProps {
  productos: Producto[];
  cargando: boolean;
  onCompraExitosa?: () => void;
}

export function CatalogoProductos({
  productos,
  cargando,
  onCompraExitosa,
}: CatalogoProductosProps) {
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState<number>(1);
  const [procesando, setProcesando] = useState<boolean>(false);
  const [respuesta, setRespuesta] = useState<RespuestaProcesarCompra | null>(null);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const formatPrecio = (precio: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(precio);
  };

  const abrirModal = (producto: Producto) => {
    setProductoSeleccionado(producto);
    setCantidad(1);
    setRespuesta(null);
    setErrorMensaje(null);
  };

  const cerrarModal = () => {
    if (procesando) return;
    setProductoSeleccionado(null);
    setCantidad(1);
    setRespuesta(null);
    setErrorMensaje(null);
  };

  const handleConfirmarCompra = async () => {
    if (!productoSeleccionado || cantidad <= 0) return;

    try {
      setProcesando(true);
      setErrorMensaje(null);
      setRespuesta(null);

      const { data, error } = await supabase.rpc('procesar_compra_concurrente', {
        p_producto_id: productoSeleccionado.id,
        p_cantidad: cantidad,
      });

      if (error) {
        throw error;
      }

      const res = data as RespuestaProcesarCompra;
      setRespuesta(res);

      if (res.exito && onCompraExitosa) {
        onCompraExitosa();
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado al procesar la compra.';
      setErrorMensaje(msg);
      console.error('[CatalogoProductos] Error en RPC procesar_compra_concurrente:', err);
    } finally {
      setProcesando(false);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock > 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {stock} disponibles
        </span>
      );
    }

    if (stock >= 1 && stock <= 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          ¡Últimas {stock} unidades!
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Agotado
      </span>
    );
  };

  // Skeleton loading state
  if (cargando) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-pulse flex flex-col justify-between h-72"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
                <div className="h-7 w-20 bg-slate-200 rounded-lg" />
              </div>
              <div className="h-6 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-full bg-slate-100 rounded mb-2" />
              <div className="h-4 w-5/6 bg-slate-100 rounded" />
            </div>
            <div className="h-11 w-full bg-slate-200 rounded-xl mt-4" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (productos.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">
          No hay productos disponibles
        </h3>
        <p className="text-sm text-slate-500">
          Actualmente el inventario no cuenta con productos registrados.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Grid Responsive: 1 columna en móvil, 3 en pantallas medianas/grandes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {productos.map((producto) => {
          const sinStock = producto.stock_disponible <= 0;
          const esStockCritico = producto.stock_disponible > 0 && producto.stock_disponible <= 3;

          return (
            <div
              key={producto.id}
              className={`bg-white rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
                sinStock
                  ? 'border-slate-200 opacity-75'
                  : esStockCritico
                  ? 'border-amber-300/80 hover:border-amber-400/90 shadow-amber-500/5'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Header: Badge de stock, badge crítico y precio */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {getStockBadge(producto.stock_disponible)}
                    {esStockCritico && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-50 to-rose-50 text-rose-700 border border-rose-300/90 shadow-xs animate-pulse">
                        <span>⚡ ¡Stock Crítico!</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-black text-slate-900 tracking-tight shrink-0">
                    {formatPrecio(producto.precio)}
                  </span>
                </div>

                {/* Título y descripción */}
                <h3 className="text-lg font-bold text-slate-800 line-clamp-1 mb-2">
                  {producto.nombre}
                </h3>
                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-6">
                  {producto.descripcion}
                </p>
              </div>

              {/* Botón Comprar Ahora */}
              <button
                type="button"
                onClick={() => abrirModal(producto)}
                disabled={sinStock}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 shadow-xs ${
                  sinStock
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] hover:shadow-indigo-500/20 hover:shadow-md'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                {sinStock ? 'Sin Stock Disponible' : 'Comprar Ahora'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal de Compra */}
      {productoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative border border-slate-100 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={cerrarModal}
              disabled={procesando}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header del Modal */}
            <div className="mb-5 pr-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1 block">
                Confirmar Orden
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                {productoSeleccionado.nombre}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Precio unitario: {formatPrecio(productoSeleccionado.precio)}
              </p>
            </div>

            {/* Alertas y Notificaciones según respuesta de Supabase */}
            {respuesta && (
              <div className="mb-5">
                {respuesta.exito ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-950 flex gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-emerald-900">
                        ¡Compra procesada con éxito!
                      </p>
                      <p className="text-emerald-800">{respuesta.mensaje}</p>
                      <div className="pt-2 text-xs flex flex-wrap gap-2 text-emerald-700 font-medium">
                        {respuesta.orden_id && (
                          <span className="bg-emerald-100/70 px-2 py-0.5 rounded-md">
                            Orden #{respuesta.orden_id}
                          </span>
                        )}
                        {respuesta.total !== undefined && (
                          <span className="bg-emerald-100/70 px-2 py-0.5 rounded-md">
                            Total: {formatPrecio(respuesta.total)}
                          </span>
                        )}
                        {respuesta.stock_restante !== undefined && (
                          <span className="bg-emerald-100/70 px-2 py-0.5 rounded-md">
                            Stock restante: {respuesta.stock_restante}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-950 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-rose-900">
                        {respuesta.estado === 'RECHAZADA_SIN_STOCK'
                          ? 'Stock insuficiente'
                          : 'No se pudo procesar la compra'}
                      </p>
                      <p className="text-rose-800">{respuesta.mensaje}</p>
                      {respuesta.stock_actual !== undefined && (
                        <p className="text-xs text-rose-700 font-semibold pt-1">
                          Stock actual en bodega: {respuesta.stock_actual}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {errorMensaje && (
              <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-950 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-rose-900">Error de conexión</p>
                  <p className="text-rose-800">{errorMensaje}</p>
                </div>
              </div>
            )}

            {/* Formulario de Compra (solo visible si aún no hay respuesta exitosa) */}
            {!respuesta?.exito ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="cantidad"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Cantidad a comprar
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="cantidad"
                      type="number"
                      min={1}
                      value={cantidad}
                      disabled={procesando}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setCantidad(isNaN(val) ? 1 : Math.max(1, val));
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 disabled:bg-slate-100 disabled:opacity-60"
                    />
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-slate-500 block">Subtotal</span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatPrecio(productoSeleccionado.precio * (cantidad || 1))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    disabled={procesando}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarCompra}
                    disabled={procesando || cantidad <= 0}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {procesando ? (
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
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-all shadow-xs"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
