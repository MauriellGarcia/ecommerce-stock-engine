import { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Cpu,
  Clock,
  Radio,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { Orden, Producto, RespuestaProcesarCompra } from '../types/database.types';

interface PanelQAProps {
  productos?: Producto[];
  onRafagaCompletada?: () => void;
  recargarProductos?: () => void;
}

interface DetallePeticion {
  index: number;
  status: 'PROCESADA' | 'RECHAZADA_SIN_STOCK' | 'ERROR';
  mensaje: string;
}

interface ResultadoSimulacion {
  totalPeticiones: number;
  exitosas: number;
  rechazadasSinStock: number;
  errores: number;
  duracionMs: number;
  detalles: DetallePeticion[];
}

export function PanelQA({
  productos: productosProp,
  onRafagaCompletada,
  recargarProductos,
}: PanelQAProps) {
  // Estado de lista de órdenes
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cargandoOrdenes, setCargandoOrdenes] = useState<boolean>(true);

  // Estado de lista de productos (para selector si no se pasa por prop)
  const [productosLocales, setProductosLocales] = useState<Producto[]>([]);
  const listaProductos = productosProp && productosProp.length > 0 ? productosProp : productosLocales;

  // Estado del simulador de estrés
  const [productoIdSeleccionado, setProductoIdSeleccionado] = useState<number>(0);
  const [peticionesConcurrentes, setPeticionesConcurrentes] = useState<number>(10);
  const [cantidadPorPeticion, setCantidadPorPeticion] = useState<number>(1);
  const [simulando, setSimulando] = useState<boolean>(false);
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);

  // Formato de moneda
  const formatPrecio = (valor: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(valor);
  };

  // Formato de fecha
  const formatFecha = (isoString: string) => {
    try {
      const fecha = new Date(isoString);
      return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(fecha);
    } catch {
      return isoString;
    }
  };

  // Cargar órdenes (últimas 20)
  const fetchOrdenes = useCallback(async (mostrarLoader = true) => {
    try {
      if (mostrarLoader) {
        setCargandoOrdenes(true);
      }
      const { data, error } = await supabase
        .from('ordenes')
        .select('*')
        .order('fecha_orden', { ascending: false })
        .limit(20);

      if (error) throw error;
      setOrdenes((data as Orden[]) || []);
    } catch (err) {
      console.error('[PanelQA] Error al cargar órdenes:', err);
    } finally {
      setCargandoOrdenes(false);
    }
  }, []);

  // Cargar productos para el selector y sincronización local
  const fetchProductos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      if (data) {
        setProductosLocales(data as Producto[]);
      }
    } catch (err) {
      console.error('[PanelQA] Error al cargar productos:', err);
    }
  }, []);

  // Cargar productos para el selector si no vinieron por props
  useEffect(() => {
    let cancelado = false;

    if (!productosProp || productosProp.length === 0) {
      supabase
        .from('productos')
        .select('*')
        .order('id', { ascending: true })
        .then(({ data, error }) => {
          if (!cancelado && !error && data) {
            setProductosLocales(data as Producto[]);
          }
        });
    }

    return () => {
      cancelado = true;
    };
  }, [productosProp]);

  // Carga inicial y suscripción Realtime a tabla 'ordenes'
  useEffect(() => {
    let cancelado = false;

    supabase
      .from('ordenes')
      .select('*')
      .order('fecha_orden', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!cancelado) {
          if (!error && data) {
            setOrdenes(data as Orden[]);
          }
          setCargandoOrdenes(false);
        }
      });

    let canal: ReturnType<typeof supabase.channel> | null = null;
    try {
      canal = supabase
        .channel('ordenes-realtime-qa')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ordenes',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const nuevaOrden = payload.new as Orden;
              setOrdenes((prev) => [nuevaOrden, ...prev].slice(0, 20));
            } else if (payload.eventType === 'UPDATE') {
              const ordenActualizada = payload.new as Orden;
              setOrdenes((prev) =>
                prev.map((o) => (o.id === ordenActualizada.id ? ordenActualizada : o))
              );
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[PanelQA] No se pudo inicializar canal Realtime de órdenes:', e);
    }

    return () => {
      cancelado = true;
      if (canal) {
        supabase.removeChannel(canal);
      }
    };
  }, [fetchOrdenes]);

  // Ejecutor de ráfaga concurrente con Promise.all()
  const ejecutarRafagaConcurrente = async () => {
    const totalPeticiones = peticionesConcurrentes;
    const productoId = productoIdSeleccionado || (listaProductos[0]?.id ?? 0);

    if (!Number(productoId) || totalPeticiones <= 0) return;

    setSimulando(true);
    setResultado(null);
    const tiempoInicio = performance.now();

    // 1. Mapeo del resultado de cada Promise.all
    const resultados = await Promise.all(
      Array.from({ length: totalPeticiones }).map(async () => {
        const { data, error } = await supabase.rpc('procesar_compra_concurrente', {
          p_producto_id: Number(productoId),
          p_cantidad: Number(cantidadPorPeticion),
        });
        if (error) console.error('Error RPC:', error);
        return data;
      })
    );

    const tiempoFin = performance.now();

    // 2. Conteo explícito
    let procesadas = 0;
    let sinStock = 0;
    let errores = 0;

    const detalles: DetallePeticion[] = resultados.map((raw, index) => {
      let res = raw as RespuestaProcesarCompra | null;
      if (typeof res === 'string') {
        try {
          res = JSON.parse(res);
        } catch {
          res = null;
        }
      } else if (Array.isArray(res) && res.length > 0) {
        res = res[0];
      }

      if (res?.exito === true || res?.estado === 'PROCESADA') {
        procesadas++;
        return {
          index: index + 1,
          status: 'PROCESADA',
          mensaje: res?.mensaje || 'Compra procesada exitosamente',
        };
      } else if (res?.exito === false || res?.estado === 'RECHAZADA_SIN_STOCK') {
        sinStock++;
        return {
          index: index + 1,
          status: 'RECHAZADA_SIN_STOCK',
          mensaje: res?.mensaje || 'Rechazada por falta de stock',
        };
      } else {
        errores++;
        return {
          index: index + 1,
          status: 'ERROR',
          mensaje: 'Error en la petición o sin respuesta',
        };
      }
    });

    setResultado({
      totalPeticiones,
      exitosas: procesadas,
      rechazadasSinStock: sinStock,
      errores,
      duracionMs: Math.round(tiempoFin - tiempoInicio),
      detalles,
    });

    setSimulando(false);

    // 3. Actualizar la lista de productos y órdenes al terminar la ejecución
    await Promise.allSettled([
      fetchOrdenes(),
      fetchProductos(),
      onRafagaCompletada ? onRafagaCompletada() : Promise.resolve(),
      recargarProductos ? recargarProductos() : Promise.resolve(),
    ]);
  };

  const renderBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'PROCESADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            PROCESADA
          </span>
        );
      case 'RECHAZADA_SIN_STOCK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            SIN STOCK
          </span>
        );
      case 'ERROR':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {estado}
          </span>
        );
    }
  };

  const productoSeleccionadoId = productoIdSeleccionado || (listaProductos[0]?.id ?? 0);
  const productoActual = listaProductos.find((p) => p.id === Number(productoSeleccionadoId));

  return (
    <div className="space-y-8">
      {/* SECCIÓN 1: SIMULADOR DE ESTRÉS POR CONCURRENCIA */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Simulador de Estrés por Concurrencia
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ACID / Row Lock
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                Ejecuta ráfagas de transacciones simultáneas para auditar el control de stock concurrente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-800/80 self-start sm:self-center">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            PostgreSQL Realtime Activo
          </div>
        </div>

        {/* Parámetros de Simulación */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Selector de Producto */}
          <div>
            <label
              htmlFor="selector-producto"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
            >
              Producto a someter a estrés
            </label>
            <select
              id="selector-producto"
              value={Number(productoSeleccionadoId) || ''}
              disabled={simulando}
              onChange={(e) => setProductoIdSeleccionado(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {listaProductos.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} - {p.nombre} (Stock: {p.stock_disponible})
                </option>
              ))}
            </select>
            {productoActual && (
              <span className="text-xs text-slate-400 mt-1.5 block">
                Stock actual en base de datos: <strong className="text-indigo-400">{productoActual.stock_disponible}</strong>
              </span>
            )}
          </div>

          {/* Número de Peticiones Concurrentes */}
          <div>
            <label
              htmlFor="peticiones-concurrentes"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
            >
              Peticiones simultáneas (Promise.all)
            </label>
            <input
              id="peticiones-concurrentes"
              type="number"
              min={1}
              max={100}
              value={peticionesConcurrentes}
              disabled={simulando}
              onChange={(e) => setPeticionesConcurrentes(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="text-xs text-slate-400 mt-1.5 block">
              Peticiones enviadas en el mismo microsegundo.
            </span>
          </div>

          {/* Cantidad por Petición */}
          <div>
            <label
              htmlFor="cantidad-por-peticion"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
            >
              Cantidad por petición
            </label>
            <input
              id="cantidad-por-peticion"
              type="number"
              min={1}
              value={cantidadPorPeticion}
              disabled={simulando}
              onChange={(e) => setCantidadPorPeticion(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="text-xs text-slate-400 mt-1.5 block">
              Unidades solicitadas en cada intento.
            </span>
          </div>
        </div>

        {/* Botón de Ejecución */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={ejecutarRafagaConcurrente}
            disabled={simulando || !productoIdSeleccionado}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] font-bold text-sm text-white transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {simulando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Ejecutando {peticionesConcurrentes} peticiones concurrentes...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
                Ejecutar Ráfaga Concurrente ({peticionesConcurrentes}x)
              </>
            )}
          </button>
        </div>

        {/* Dashboard de Resultados Acumulados */}
        {resultado && (
          <div className="mt-6 pt-6 border-t border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Resultado de la Ráfaga Concurrente
            </h3>

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
              <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
                <span className="text-xs text-slate-400 font-medium block">Total Lanzadas</span>
                <span className="text-2xl font-black text-white mt-1 block">
                  {resultado.totalPeticiones}
                </span>
              </div>

              <div className="bg-emerald-950/40 rounded-2xl p-4 border border-emerald-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-300 font-medium">Procesadas</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">
                  {resultado.exitosas}
                </span>
              </div>

              <div className="bg-rose-950/40 rounded-2xl p-4 border border-rose-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rose-300 font-medium">Sin Stock</span>
                  <XCircle className="w-4 h-4 text-rose-400" />
                </div>
                <span className="text-2xl font-black text-rose-400 mt-1 block">
                  {resultado.rechazadasSinStock}
                </span>
              </div>

              <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Latencia Total</span>
                  <Clock className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-2xl font-black text-white mt-1 block">
                  {resultado.duracionMs} ms
                </span>
              </div>
            </div>

            {/* Barra Visual de Proporción */}
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex mb-2">
              {resultado.exitosas > 0 && (
                <div
                  style={{
                    width: `${(resultado.exitosas / resultado.totalPeticiones) * 100}%`,
                  }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Procesadas: ${resultado.exitosas}`}
                />
              )}
              {resultado.rechazadasSinStock > 0 && (
                <div
                  style={{
                    width: `${(resultado.rechazadasSinStock / resultado.totalPeticiones) * 100}%`,
                  }}
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Rechazadas sin stock: ${resultado.rechazadasSinStock}`}
                />
              )}
              {resultado.errores > 0 && (
                <div
                  style={{
                    width: `${(resultado.errores / resultado.totalPeticiones) * 100}%`,
                  }}
                  className="bg-amber-500 h-full transition-all duration-500"
                  title={`Errores: ${resultado.errores}`}
                />
              )}
            </div>

            <p className="text-xs text-slate-400">
              * El motor de base de datos bloqueó concurrentemente la fila (<code>FOR UPDATE</code>) impidiendo la sobreventa (overselling).
            </p>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: TABLA DE AUDITORÍA DE ÓRDENES (REALTIME) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Auditoría de Órdenes en Tiempo Real
            </h2>
            <p className="text-sm text-slate-500">
              Monitoreo de las últimas 20 órdenes registradas en Supabase con suscripción activa.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void fetchOrdenes(true);
            }}
            disabled={cargandoOrdenes}
            className="self-start sm:self-center px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargandoOrdenes ? 'animate-spin' : ''}`} />
            Actualizar Tabla
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  ID Orden
                </th>
                <th scope="col" className="px-5 py-3.5">
                  ID Producto
                </th>
                <th scope="col" className="px-5 py-3.5 text-center">
                  Cantidad
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Total
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Estado
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Fecha y Hora
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargandoOrdenes && ordenes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Cargando auditoría de órdenes...
                  </td>
                </tr>
              ) : ordenes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                    No se han registrado órdenes aún. Ejecuta una ráfaga o realiza una compra en el catálogo.
                  </td>
                </tr>
              ) : (
                ordenes.map((orden) => (
                  <tr
                    key={orden.id}
                    className="hover:bg-slate-50/80 transition-colors duration-100"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-900">
                      #{orden.id}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-800">
                        Producto #{orden.producto_id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-semibold text-slate-800">
                      {orden.cantidad}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {formatPrecio(orden.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      {renderBadgeEstado(orden.estado)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                      {formatFecha(orden.fecha_orden)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
