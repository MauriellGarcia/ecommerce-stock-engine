# 🛒 E-Commerce Stock Engine — Concurrency Control & Realtime QA

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-ACID-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> [!TIP]
> 🌐 **Demo en Vivo:** Explora la aplicación desplegada en Vercel:  
> **[https://ecommerce-stock-engine.vercel.app](https://ecommerce-stock-engine.vercel.app)**

---

## 📌 Descripción General

**E-Commerce Stock Engine** es una solución arquitectónica transaccional de alto rendimiento diseñada para resolver de raíz los problemas críticos de **condiciones de carrera (*Race Conditions*)** y **sobreventa (*Overselling*)** en catálogos de comercio electrónico sometidos a picos masivos de concurrencia (como *Flash Sales*, lanzamientos de boletos o eventos tipo *Black Friday*).

El sistema combina una interfaz reactiva construida en **React 19 + TypeScript** con un motor de persistencia transaccional en **PostgreSQL (vía Supabase)**. A través de un simulador de estrés integrado en el **Panel de Auditoría QA**, permite emitir ráfagas de transacciones concurrentes en el mismo microsegundo para demostrar de forma empírica y visual cómo el motor de base de datos serializa los accesos a nivel de fila (*Row-Level Lock*), garantizando consistencia absoluta y cero sobreventas con una infraestructura de costo **$0 USD**.

---

## ⚡ El Problema Técnico (Race Condition) vs. La Solución

### El Problema: Lecturas No Atómicas y Sobreventa

En arquitecturas tradicionales donde la lógica de validación se resuelve en capas de aplicación sin aislamiento de concurrencia estricto, ocurre el clásico antipatrón **Read-Modify-Write**:

1. El producto X tiene **1 sola unidad** en inventario.
2. El **Cliente A** y el **Cliente B** envían su orden de compra simultáneamente.
3. Ambos hilos de ejecución leen `stock_disponible = 1` al mismo tiempo.
4. Como ambas lecturas indican que hay stock suficiente, ambos clientes son autorizados a comprar.
5. Ambas transacciones descuentan 1 unidad: el stock final se corrompe a **-1 unidades**, provocando quiebre de stock, pérdida de confianza y costos operativos de reembolso.

```
TIEMPO      CLIENTE A                              CLIENTE B
  │
  ├─ t1:    SELECT stock (Retorna 1)               SELECT stock (Retorna 1)
  ├─ t2:    Validación: OK (1 >= 1)                Validación: OK (1 >= 1)
  ├─ t3:    UPDATE stock = 1 - 1 = 0               UPDATE stock = 1 - 1 = -1 💥 (Overselling)
  ▼
```

### La Solución: Bloqueo Pesimista (`FOR UPDATE`) con `SECURITY DEFINER`

La solución arquitectónica implementada delega la responsabilidad de consistencia a nivel de base de datos relacional PostgreSQL aprovechando transacciones **ACID** y bloqueo pesimista a nivel de fila:

1. **Bloqueo Pesimista Exclusivo (`FOR UPDATE`):**
   Al invocar la función RPC almacenada `procesar_compra_concurrente`, la consulta inicial adquiere un bloqueo exclusivo sobre la fila del producto:
   ```sql
   SELECT stock_disponible, precio
   INTO v_stock, v_precio
   FROM productos
   WHERE id = p_producto_id
   FOR UPDATE;
   ```
2. **Serialización Garantizada:**
   Cualquier otra transacción concurrente que intente consultar o modificar el mismo producto queda suspendida a nivel de base de datos hasta que la transacción en curso ejecute un `COMMIT` o `ROLLBACK`.
3. **Validación Atómica y Reversión Inmediata:**
   Cuando la segunda transacción toma el bloqueo, lee el stock actualizado post-descuento. Si las unidades solicitadas superan el stock remanente, la transacción emite un rechazo inmediato (`RECHAZADA_SIN_STOCK`) sin alterar el estado del inventario.
4. **Ejecución con `SECURITY DEFINER`:**
   La función PL/pgSQL se define con privilegios elevados para garantizar que los bloqueos pesimistas y las mutaciones en `productos` y `ordenes` se ejecuten con atomicidad y sin restricciones restrictivas de políticas RLS (*Row Level Security*) del rol anónimo del cliente web.

---

## 🏗️ Arquitectura de la Solución

El siguiente diagrama ilustra el flujo de ejecución end-to-end desde el cliente web hasta la base de datos y la propagación reactiva en tiempo real:

```
+---------------------------------------------------------------------------------------------------------+
|                                           ARQUITECTURA DEL SISTEMA                                      |
+---------------------------------------------------------------------------------------------------------+

  [ CLIENTE WEB ]
  ┌────────────────────────────────────────────────────────────────┐
  │ React 19 + TypeScript (SPA)                                     │
  │  ├── Catálogo de Productos con Detección de "Stock Crítico"   │
  │  └── Panel QA con Inyector de Carga Concurrente                │
  └───────────────────────────────┬────────────────────────────────┘
                                  │
                                  │ Disparo de Ráfaga Masiva (Promise.all)
                                  ▼
  [ CAPA DE ACCESO / SUPABASE ]
  ┌────────────────────────────────────────────────────────────────┐
  │ Supabase PostgREST Engine                                      │
  │  └── Endpoint RPC: /rpc/procesar_compra_concurrente             │
  └───────────────────────────────┬────────────────────────────────┘
                                  │
                                  │ Ejecución Transaccional Atómica
                                  ▼
  [ POSTGRESQL / MOTOR TRANSACCIONAL ]
  ┌────────────────────────────────────────────────────────────────┐
  │ PL/pgSQL Stored Procedure (SECURITY DEFINER)                   │
  │                                                                │
  │   1. BEGIN TRANSACTION                                         │
  │   2. SELECT stock FROM productos WHERE id = X FOR UPDATE       │  <-- [ ROW-LEVEL LOCK ]
  │      ┌───────────────────────┴────────────────────────┐        │      (Bloqueo exclusivo
  │      │                                                │        │       hasta finalizar)
  │   [ ¿Stock >= Cantidad? ]                             │        │
  │      │ SÍ                                             │ NO     │
  │      ▼                                                ▼        │
  │   UPDATE productos SET stock = stock - N      ROLLBACK / RETORNO
  │   INSERT INTO ordenes (estado: PROCESADA)     (estado: RECHAZADA_SIN_STOCK)
  │   3. COMMIT TRANSACTION                                        │
  └───────────────────────────────┬────────────────────────────────┘
                                  │
                                  │ Eventos CDC (Postgres WAL -> WebSockets)
                                  ▼
  [ TIEMPO REAL / REACTIVE BUS ]
  ┌────────────────────────────────────────────────────────────────┐
  │ Supabase Realtime Channels (PostgreSQL Changes)                │
  │  ├── canal: 'productos-realtime'  --> Actualiza Stock en Vivo  │
  │  └── canal: 'ordenes-realtime-qa' --> Inserta Órdenes en Vivo  │
  └────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Panel Auditoría QA & Simulador de Carga

El componente [`PanelQA.tsx`](src/components/PanelQA.tsx) incluye una suite de pruebas de concurrencia diseñada para someter el backend a estrés controlado:

* **Inyección Simultánea vía `Promise.all`:** Permite despachar desde 1 hasta 100 peticiones en el mismo bucle de eventos de JavaScript dirigidas al mismo ID de producto.
* **Casteo Estricto y Normalización:** Transforma los valores del formulario a tipos enteros estrictos (`p_producto_id: Number(...)`, `p_cantidad: Number(...)`) antes del consumo de la RPC.
* **Clasificación Exhaustiva de Métricas:**
  * **Procesadas:** Peticiones donde `exito === true` o `estado === 'PROCESADA'`.
  * **Sin Stock:** Peticiones donde `exito === false` o `estado === 'RECHAZADA_SIN_STOCK'`.
  * **Errores:** Peticiones interrumpidas por latencia de red o fallos inesperados.
* **Auditoría en Tiempo Real:** Visualización instantánea de las últimas 20 órdenes registradas en PostgreSQL, actualizadas automáticamente vía WebSockets (`postgres_changes`).
* **Etiqueta Visual de "⚡ Stock Crítico":** En el catálogo de productos, las existencias con stock $1 \le \text{stock} \le 3$ activan un badge pulsante (`animate-pulse`) en tonos ámbar/rojo para alertar sobre la escasez inminente.

---

## 🛠️ Stack Tecnológico

Toda la solución está optimizada para operar dentro de las capas gratuitas (**Free Tier / $0 USD**) sin sacrificar robustez de nivel empresarial:

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Frontend** | [React 19](https://react.dev/) | Librería declarativa de interfaces de usuario. |
| **Lenguaje** | [TypeScript](https://www.typescriptlang.org/) | Tipado estático estricto y contratos de datos seguros. |
| **Estilos** | [TailwindCSS v4](https://tailwindcss.com/) | Estilos utilitarios modernos con animaciones (`animate-pulse`, `animate-ping`). |
| **Iconografía** | [Lucide React](https://lucide.dev/) | Iconografía minimalista para auditoría y paneles QA. |
| **Backend / DB** | [Supabase](https://supabase.com/) | Backend serverless con base de datos relacional PostgreSQL. |
| **Motor RDBMS** | [PostgreSQL 15+](https://www.postgresql.org/) | Transacciones ACID, bloqueo `FOR UPDATE` y triggers PL/pgSQL. |
| **Realtime** | Supabase WebSockets | Transmisión de cambios en base de datos hacia el cliente en milisegundos. |
| **Bundler** | [Vite](https://vitejs.dev/) | Entorno de compilación ultrarrápido con HMR. |
| **Despliegue** | [Vercel](https://vercel.com/) | Alojamiento perimetral continuo (*CI/CD*). |

---

## 🚀 Instalación y Ejecución Local

### Prerrequisitos
* **Node.js** (versión 18.0 o superior).
* **npm** o **pnpm**.
* Proyecto activo en [Supabase](https://supabase.com/) con las tablas `productos`, `ordenes` y la función RPC `procesar_compra_concurrente`.

### 1. Clonar el Repositorio
```bash
git clone https://github.com/MauriellGarcia/ecommerce-stock-engine.git
cd ecommerce-stock-engine
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto basándote en las credenciales de tu proyecto Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

### 4. Ejecutar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación quedará disponible en `http://localhost:5173`.

### 5. Validar Tipado y Construcción de Producción
```bash
# Comprobación de tipos y empaquetado Vite
npm run build

# Análisis estático con ESLint
npm run lint
```

---

## 📜 Esquema de Base de Datos (Referencia SQL)

Para reproducir el backend en tu instancia de Supabase, ejecuta el siguiente script en el **SQL Editor**:

```sql
-- 1. Tabla de Productos
CREATE TABLE IF NOT EXISTS public.productos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10,2) NOT NULL,
  stock_disponible INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Órdenes
CREATE TABLE IF NOT EXISTS public.ordenes (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT REFERENCES public.productos(id),
  cantidad INT NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  estado TEXT NOT NULL,
  fecha_orden TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Stored Procedure con Bloqueo FOR UPDATE
CREATE OR REPLACE FUNCTION public.procesar_compra_concurrente(
  p_producto_id BIGINT,
  p_cantidad INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock INT;
  v_precio NUMERIC(10,2);
  v_orden_id BIGINT;
BEGIN
  -- Bloqueo pesimista a nivel de fila
  SELECT stock_disponible, precio
  INTO v_stock, v_precio
  FROM public.productos
  WHERE id = p_producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('exito', false, 'estado', 'ERROR', 'mensaje', 'El producto no existe');
  END IF;

  -- Comprobación atómica de inventario
  IF v_stock < p_cantidad THEN
    RETURN json_build_object(
      'exito', false,
      'estado', 'RECHAZADA_SIN_STOCK',
      'mensaje', 'Stock insuficiente para cubrir la solicitud',
      'stock_actual', v_stock
    );
  END IF;

  -- Descuento seguro de inventario
  UPDATE public.productos
  SET stock_disponible = stock_disponible - p_cantidad
  WHERE id = p_producto_id;

  -- Registro de la orden procesada
  INSERT INTO public.ordenes (producto_id, cantidad, total, estado)
  VALUES (p_producto_id, p_cantidad, v_precio * p_cantidad, 'PROCESADA')
  RETURNING id INTO v_orden_id;

  RETURN json_build_object(
    'exito', true,
    'estado', 'PROCESADA',
    'mensaje', 'Compra procesada exitosamente',
    'orden_id', v_orden_id,
    'stock_restante', v_stock - p_cantidad,
    'total', v_precio * p_cantidad
  );
END;
$$;
```

---

## 👨‍💻 Créditos

Desarrollado con pasión por la arquitectura de software y los sistemas tolerantes a fallos por:

**Mauriell García**  
*Senior Full Stack Developer & Software Architect*  
* [GitHub](https://github.com/MauriellGarcia)  
* [LinkedIn](https://linkedin.com/in/mauriellgarcia)

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE). Puedes utilizarlo libremente como referencia arquitectónica o para demostraciones técnicas.
