import { supabase } from '../lib/supabaseClient';
import type { Producto } from '../types/database.types';

export interface CartItem {
  id: number;
  carrito_id: string;
  producto_id: number;
  cantidad: number;
  producto?: Producto;
}

// ── 1. Obtener o Crear Carrito ───────────────────────────────────────────────
export const obtenerOCrearCarrito = async (usuarioId: string): Promise<string> => {
  const { data: carritoExistente, error: errorConsulta } = await supabase
    .from('carritos')
    .select('id')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (errorConsulta) {
    console.error('[cartService] Error al consultar carrito:', errorConsulta);
    throw errorConsulta;
  }

  if (carritoExistente) {
    return carritoExistente.id;
  }

  const { data: nuevoCarrito, error: errorCreacion } = await supabase
    .from('carritos')
    .insert([{ usuario_id: usuarioId }])
    .select('id')
    .single();

  if (errorCreacion || !nuevoCarrito) {
    console.error('[cartService] Error al crear carrito:', errorCreacion);
    throw errorCreacion;
  }

  return nuevoCarrito.id;
};

// ── 2. Obtener Detalle del Carrito con Producto ─────────────────────────────
export const obtenerDetalleCarrito = async (carritoId: string): Promise<CartItem[]> => {
  // Guarda de seguridad: Si carritoId no está definido o es la cadena "undefined", evitar la consulta
  if (!carritoId || carritoId === 'undefined') {
    return [];
  }

  const { data, error } = await supabase
    .from('detalle_carrito')
    .select(`
      id,
      carrito_id,
      producto_id,
      cantidad,
      producto:productos (
        id,
        nombre,
        descripcion,
        precio,
        stock_disponible,
        imagen_url
      )
    `)
    .eq('carrito_id', carritoId);

  if (error) {
    console.error('[cartService] Error al obtener detalle del carrito:', error);
    throw error;
  }

  return (data as unknown as CartItem[]) || [];
};

// ── 3. Agregar Producto al Carrito ──────────────────────────────────────────
export const agregarProductoAlCarrito = async (
  carritoId: string,
  productoId: number,
  cantidad: number = 1
): Promise<void> => {
  const { data: detalleExistente, error: errorConsulta } = await supabase
    .from('detalle_carrito')
    .select('id, cantidad')
    .eq('carrito_id', carritoId)
    .eq('producto_id', productoId)
    .maybeSingle();

  if (errorConsulta) {
    console.error('[cartService] Error al consultar detalle existente:', errorConsulta);
    throw errorConsulta;
  }

  if (detalleExistente) {
    const { error: errorActualizacion } = await supabase
      .from('detalle_carrito')
      .update({ cantidad: detalleExistente.cantidad + cantidad })
      .eq('id', detalleExistente.id);

    if (errorActualizacion) throw errorActualizacion;
  } else {
    const { error: errorInsercion } = await supabase
      .from('detalle_carrito')
      .insert([
        {
          carrito_id: carritoId,
          producto_id: productoId,
          cantidad: cantidad,
        },
      ]);

    if (errorInsercion) throw errorInsercion;
  }
};

// ── 4. Actualizar Cantidad en Carrito ───────────────────────────────────────
export const actualizarCantidadEnCarrito = async (
  detalleId: number,
  cantidad: number
): Promise<void> => {
  const { error } = await supabase
    .from('detalle_carrito')
    .update({ cantidad })
    .eq('id', detalleId);

  if (error) {
    console.error('[cartService] Error al actualizar cantidad:', error);
    throw error;
  }
};

// ── 5. Eliminar Producto del Carrito ────────────────────────────────────────
export const eliminarProductoDelCarrito = async (detalleId: number): Promise<void> => {
  const { error } = await supabase
    .from('detalle_carrito')
    .delete()
    .eq('id', detalleId);

  if (error) {
    console.error('[cartService] Error al eliminar producto:', error);
    throw error;
  }
};

// ── 6. Vaciar Carrito Completo ──────────────────────────────────────────────
export const vaciarCarrito = async (carritoId: string): Promise<void> => {
  const { error } = await supabase
    .from('detalle_carrito')
    .delete()
    .eq('carrito_id', carritoId);

  if (error) {
    console.error('[cartService] Error al vaciar el carrito:', error);
    throw error;
  }
};