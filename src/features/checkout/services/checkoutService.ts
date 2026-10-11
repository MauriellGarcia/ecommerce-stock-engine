import { supabase } from '../../../lib/supabaseClient';
import type { RespuestaProcesarCompra } from '../../../types/database.types';

export interface ResultadoProcesarCompra {
  data: RespuestaProcesarCompra | null;
  error: Error | null;
}

/**
 * Procesa una compra directa concurrente mediante la función RPC 'procesar_compra_concurrente'.
 *
 * @param productoId - ID del producto a adquirir.
 * @param cantidad - Cantidad de unidades a comprar.
 * @param usuarioId - ID del usuario opcional o null.
 * @returns Objeto con { data, error } gestionando la respuesta o error de la transacción.
 */
export async function procesarCompraConcurrente(
  productoId: number,
  cantidad: number,
  usuarioId?: string | null
): Promise<{ data: RespuestaProcesarCompra | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('procesar_compra_concurrente', {
      p_producto_id: productoId,
      p_cantidad: cantidad,
      p_usuario_id: usuarioId ?? null,
    });

    if (error) {
      return {
        data: null,
        error: new Error(error.message),
      };
    }

    return {
      data: data as RespuestaProcesarCompra,
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      data: null,
      error,
    };
  }
}
