import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  obtenerOCrearCarrito,
  obtenerDetalleCarrito,
  agregarProductoAlCarrito,
  type CartItem,
} from '../services/cartService';

// ─── Tipos del contexto ───────────────────────────────────────────────────────

interface CartContextType {
  /** ID UUID del carrito activo del usuario (null si no hay sesión) */
  carritoId: string | null;
  /** Total de unidades sumadas entre todos los ítems del carrito */
  itemCount: number;
  /** Lista completa de ítems del carrito con datos de producto */
  items: CartItem[];
  /** true mientras se ejecuta una operación de carrito */
  cargandoCarrito: boolean;
  /**
   * Agrega un producto al carrito.
   * @param productoId - ID del producto a agregar
   * @param cantidad   - Unidades a agregar (default: 1)
   */
  agregarAlCarrito: (productoId: number, cantidad?: number) => Promise<void>;
  /** Fuerza una recarga del carrito desde Supabase */
  refrescarCarrito: () => Promise<void>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // El carritoId es un UUID (string)
  const [carritoId, setCarritoId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cargandoCarrito, setCargandoCarrito] = useState(false);

  /** Suma de todas las cantidades de los ítems */
  const itemCount = items.reduce((acc, item) => acc + item.cantidad, 0);

  // ── Inicializar / limpiar carrito cuando cambia la sesión ─────────────────
  useEffect(() => {
    if (!user) {
      setCarritoId(null);
      setItems([]);
      return;
    }

    let cancelado = false;

    const init = async () => {
      try {
        setCargandoCarrito(true);
        // obtenerOCrearCarrito devuelve directamente el string UUID del carrito
        const idObtenido = await obtenerOCrearCarrito(user.id);
        if (cancelado) return;

        setCarritoId(idObtenido);
        const detalle = await obtenerDetalleCarrito(idObtenido);
        if (cancelado) return;

        setItems(detalle);
      } catch (err) {
        console.error('[CartContext] Error al inicializar carrito:', err);
      } finally {
        if (!cancelado) setCargandoCarrito(false);
      }
    };

    init();

    return () => {
      cancelado = true;
    };
  }, [user]);

  // ── refrescarCarrito ──────────────────────────────────────────────────────
  const refrescarCarrito = useCallback(async () => {
    if (!user) return;
    try {
      let idActual = carritoId;
      if (!idActual) {
        idActual = await obtenerOCrearCarrito(user.id);
        setCarritoId(idActual);
      }
      const detalle = await obtenerDetalleCarrito(idActual);
      setItems(detalle);
    } catch (err) {
      console.error('[CartContext] Error al refrescar carrito:', err);
    }
  }, [carritoId, user]);

  // ── agregarAlCarrito ──────────────────────────────────────────────────────
  const agregarAlCarrito = useCallback(
    async (productoId: number, cantidad = 1) => {
      if (!user) {
        throw new Error('SESSION_REQUIRED');
      }

      setCargandoCarrito(true);
      try {
        let idActual = carritoId;
        if (!idActual) {
          idActual = await obtenerOCrearCarrito(user.id);
          setCarritoId(idActual);
        }

        await agregarProductoAlCarrito(idActual, productoId, cantidad);

        // Refrescar directamente desde la base de datos para sincronizar productos
        const detalleActualizado = await obtenerDetalleCarrito(idActual);
        setItems(detalleActualizado);
      } catch (err) {
        console.error('[CartContext] Error al agregar al carrito:', err);
        throw err;
      } finally {
        setCargandoCarrito(false);
      }
    },
    [user, carritoId]
  );

  const value: CartContextType = {
    carritoId,
    itemCount,
    items,
    cargandoCarrito,
    agregarAlCarrito,
    refrescarCarrito,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ─── Hook de consumo ──────────────────────────────────────────────────────────

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (ctx === undefined) {
    throw new Error('useCart debe usarse dentro de un <CartProvider>');
  }
  return ctx;
}