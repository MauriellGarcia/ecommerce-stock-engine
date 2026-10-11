import { supabase } from '../../../lib/supabaseClient';
import type { Producto } from '../../../types/database.types';

export interface CartItem {
  id: number;
  carrito_id: string;
  producto_id: number;
  cantidad: number;
  producto?: Producto;
}

// ── 1. Obtener o Crear Carrito ───────────────────────────────────────────────
export const obtenerOCrearCarrito = async (usuarioId: string): Promise<string> => {
  if (!usuarioId) {
    throw new Error('El usuarioId es obligatorio para obtener o crear el carrito.');
  }

  const { data: carritoExistente, error: errorConsulta } = await supabase
    .from('carritos')
    .select('id')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (errorConsulta) {
    console.error('[cartService] Error al consultar carrito:', errorConsulta);
    throw new Error(`Error al consultar carrito existente: ${errorConsulta.message}`);
  }

  if (carritoExistente?.id) {
    return carritoExistente.id;
  }

  const { data: nuevoCarrito, error: errorCreacion } = await supabase
    .from('carritos')
    .insert([{ usuario_id: usuarioId }])
    .select('id')
    .single();

  if (errorCreacion || !nuevoCarrito) {
    const mensaje = errorCreacion ? errorCreacion.message : 'No se pudo crear el carrito';
    console.error('[cartService] Error al crear carrito:', mensaje);
    throw new Error(`Error al crear carrito: ${mensaje}`);
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
    throw new Error(`Error al obtener detalle del carrito: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((item) => {
    const rawProducto = item.producto;
    const producto: Producto | undefined = Array.isArray(rawProducto)
      ? (rawProducto[0] as Producto | undefined)
      : ((rawProducto as Producto | null) ?? undefined);

    return {
      id: item.id,
      carrito_id: item.carrito_id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      producto,
    };
  });
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
    throw new Error(`Error al consultar detalle del carrito: ${errorConsulta.message}`);
  }

  if (detalleExistente) {
    const { error: errorActualizacion } = await supabase
      .from('detalle_carrito')
      .update({ cantidad: detalleExistente.cantidad + cantidad })
      .eq('id', detalleExistente.id);

    if (errorActualizacion) {
      console.error('[cartService] Error al actualizar cantidad del item:', errorActualizacion);
      throw new Error(`Error al actualizar cantidad del producto: ${errorActualizacion.message}`);
    }
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

    if (errorInsercion) {
      console.error('[cartService] Error al insertar producto en carrito:', errorInsercion);
      throw new Error(`Error al insertar producto en el carrito: ${errorInsercion.message}`);
    }
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
    throw new Error(`Error al actualizar cantidad en el carrito: ${error.message}`);
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
    throw new Error(`Error al eliminar producto del carrito: ${error.message}`);
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
    throw new Error(`Error al vaciar el carrito: ${error.message}`);
  }
};

