import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { Producto } from '../../../types/database.types';

export interface UseProductosReturn {
  productos: Producto[];
  cargando: boolean;
  error: string | null;
  refrescarProductos: () => Promise<void>;
  recargarProductos: () => Promise<void>;
}

/**
 * Consulta la lista de productos en Supabase ordenada por ID de forma ascendente.
 * Encapsula la llamada dentro de un bloque try/catch seguro con tipado explícito.
 */
async function consultarProductos(): Promise<{ data: Producto[] | null; error: Error | null }> {
  try {
    const { data, error: supabaseError } = await supabase
      .from('productos')
      .select('*')
      .order('id', { ascending: true });

    if (supabaseError) {
      return { data: null, error: new Error(supabaseError.message) };
    }

    return {
      data: Array.isArray(data) ? (data as Producto[]) : [],
      error: null,
    };
  } catch (err) {
    const error =
      err instanceof Error
        ? err
        : new Error('Error al conectar con la base de datos de productos.');
    return { data: null, error };
  }
}

/**
 * Hook para gestionar el estado, carga y sincronización en tiempo real del catálogo de productos.
 */
export function useProductos(): UseProductosReturn {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductos = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const { data, error: err } = await consultarProductos();

      if (err) {
        const mensaje = err.message || 'Error desconocido al cargar productos.';
        setError(mensaje);
        console.warn('[useProductos] Error al consultar productos:', mensaje);
      } else if (data) {
        setProductos(data);
      }
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : 'Error inesperado al cargar productos.';
      setError(mensaje);
      console.warn('[useProductos] Error inesperado:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let montado = true;

    // Carga inicial segura
    const cargarInicial = async () => {
      try {
        setCargando(true);
        setError(null);

        const { data, error: err } = await consultarProductos();

        if (!montado) return;

        if (err) {
          const mensaje = err.message || 'Error al conectar con la base de datos.';
          setError(mensaje);
          setProductos([]);
        } else if (data) {
          setProductos(data);
        }
      } catch (err) {
        if (!montado) return;
        const mensaje =
          err instanceof Error ? err.message : 'Error al conectar con la base de datos.';
        setError(mensaje);
        setProductos([]);
      } finally {
        if (montado) {
          setCargando(false);
        }
      }
    };

    cargarInicial();

    // Suscripción Realtime protegida contra fallos de conexión
    let canal: ReturnType<typeof supabase.channel> | null = null;
    try {
      canal = supabase
        .channel('productos-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'productos',
          },
          (payload) => {
            if (!montado) return;

            if (payload.eventType === 'INSERT') {
              const nuevoProducto = payload.new as Producto;
              if (nuevoProducto && typeof nuevoProducto.id === 'number') {
                setProductos((prev) => {
                  if (prev.some((p) => p.id === nuevoProducto.id)) return prev;
                  return [...prev, nuevoProducto].sort((a, b) => a.id - b.id);
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              const productoActualizado = payload.new as Producto;
              if (productoActualizado && typeof productoActualizado.id === 'number') {
                setProductos((prev) =>
                  prev.map((p) =>
                    p.id === productoActualizado.id ? productoActualizado : p
                  )
                );
              }
            } else if (payload.eventType === 'DELETE') {
              const oldRecord = payload.old as { id?: number } | null;
              if (oldRecord && typeof oldRecord.id === 'number') {
                const idEliminado = oldRecord.id;
                setProductos((prev) => prev.filter((p) => p.id !== idEliminado));
              }
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[useProductos] No se pudo inicializar canal Realtime:', e);
    }

    return () => {
      montado = false;
      if (canal) {
        supabase.removeChannel(canal);
      }
    };
  }, []);

  return {
    productos,
    cargando,
    error,
    refrescarProductos: fetchProductos,
    recargarProductos: fetchProductos,
  };
}

