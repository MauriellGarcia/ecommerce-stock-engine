import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { procesarCompraConcurrente } from '../../checkout';
import type { Producto, RespuestaProcesarCompra } from '../../../types/database.types';

export interface UseCompraDirectaOptions {
  onCompraExitosa?: () => void;
  onError?: (mensaje: string | null) => void;
}

export interface UseCompraDirectaReturn {
  productoSeleccionado: Producto | null;
  setProductoSeleccionado: React.Dispatch<React.SetStateAction<Producto | null>>;
  cantidadDirecta: number;
  setCantidadDirecta: React.Dispatch<React.SetStateAction<number>>;
  procesandoDirecto: boolean;
  respuestaDirecta: RespuestaProcesarCompra | null;
  errorMensaje: string | null;
  abrirModalCompraDirecta: (producto: Producto) => void;
  cerrarModal: () => void;
  handleConfirmarCompraDirecta: () => Promise<void>;
}

export function useCompraDirecta({
  onCompraExitosa,
  onError,
}: UseCompraDirectaOptions = {}): UseCompraDirectaReturn {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidadDirecta, setCantidadDirecta] = useState<number>(1);
  const [procesandoDirecto, setProcesandoDirecto] = useState<boolean>(false);
  const [respuestaDirecta, setRespuestaDirecta] = useState<RespuestaProcesarCompra | null>(null);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const actualizarError = (msg: string | null) => {
    setErrorMensaje(msg);
    onError?.(msg);
  };

  const abrirModalCompraDirecta = (producto: Producto) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setProductoSeleccionado(producto);
    setCantidadDirecta(1);
    setRespuestaDirecta(null);
    actualizarError(null);
  };

  const cerrarModal = () => {
    if (procesandoDirecto) return;
    setProductoSeleccionado(null);
    setCantidadDirecta(1);
    setRespuestaDirecta(null);
    actualizarError(null);
  };

  const handleConfirmarCompraDirecta = async () => {
    if (!productoSeleccionado || cantidadDirecta <= 0) return;

    try {
      setProcesandoDirecto(true);
      actualizarError(null);
      setRespuestaDirecta(null);

      // Pasar el ID del usuario autenticado si existe la sesión
      const { data, error } = await procesarCompraConcurrente(
        productoSeleccionado.id,
        cantidadDirecta,
        user ? user.id : null
      );

      if (error) throw error;

      const res = data as RespuestaProcesarCompra;
      setRespuestaDirecta(res);

      if (res.exito && onCompraExitosa) {
        onCompraExitosa();
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado al procesar la compra.';
      actualizarError(msg);
      console.error('[useCompraDirecta] Error en RPC procesar_compra_concurrente:', err);
    } finally {
      setProcesandoDirecto(false);
    }
  };

  return {
    productoSeleccionado,
    setProductoSeleccionado,
    cantidadDirecta,
    setCantidadDirecta,
    procesandoDirecto,
    respuestaDirecta,
    errorMensaje,
    abrirModalCompraDirecta,
    cerrarModal,
    handleConfirmarCompraDirecta,
  };
}
