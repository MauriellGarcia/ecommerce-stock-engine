export type EstadoOrden = 'PROCESADA' | 'RECHAZADA_SIN_STOCK' | 'ERROR';

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  stock_disponible: number;
  creado_en: string;
}

export interface Orden {
  id: number;
  producto_id: number;
  cantidad: number;
  total: number;
  estado: EstadoOrden;
  fecha_orden: string;
}

export interface RespuestaProcesarCompra {
  exito: boolean;
  estado: string;
  mensaje: string;
  orden_id?: number;
  total?: number;
  stock_restante?: number;
  stock_actual?: number;
}
