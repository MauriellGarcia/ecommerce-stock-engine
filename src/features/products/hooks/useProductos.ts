import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { Producto } from '../../../types/database.types';

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductos = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('productos')
        .select('*')
        .order('id', { ascending: true });

      if (supabaseError) {
        throw supabaseError;
      }

      setProductos(Array.isArray(data) ? (data as Producto[]) : []);
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : 'Error desconocido al cargar productos';
      setError(mensaje);
      console.warn('[useProductos] Error al consultar productos:', mensaje);
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

        const { data, error: supabaseError } = await supabase
          .from('productos')
          .select('*')
          .order('id', { ascending: true });

        if (!montado) return;

        if (supabaseError) {
          setError(supabaseError.message);
          setProductos([]);
        } else {
          setProductos(Array.isArray(data) ? (data as Producto[]) : []);
        }
      } catch (err) {
        if (!montado) return;
        const mensaje =
          err instanceof Error ? err.message : 'Error al conectar con la base de datos';
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
              setProductos((prev) => {
                if (prev.some((p) => p.id === nuevoProducto.id)) return prev;
                return [...prev, nuevoProducto].sort((a, b) => a.id - b.id);
              });
            } else if (payload.eventType === 'UPDATE') {
              const productoActualizado = payload.new as Producto;
              setProductos((prev) =>
                prev.map((p) =>
                  p.id === productoActualizado.id ? productoActualizado : p
                )
              );
            } else if (payload.eventType === 'DELETE') {
              const idEliminado = (payload.old as { id: number }).id;
              setProductos((prev) => prev.filter((p) => p.id !== idEliminado));
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
  }, []); // Dependencias vacías para asegurar que solo se ejecute una vez en el montaje

  return {
    productos,
    cargando,
    error,
    recargarProductos: fetchProductos,
  };
}
