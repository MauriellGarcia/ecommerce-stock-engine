# Arquitectura y Reglas del Proyecto

## Estructura General (Feature-Based Architecture)
- `/src/features`: Módulos por dominio funcional (`auth`, `cart`, `products`, `qa`). Cada feature encapsula sus componentes, hooks, servicios y contextos.
- `/src/components`: Componentes reutilizables de UI y layouts (`AppShell`, `ProtectedRoute`, `Toast`).
- `/src/lib`: Clientes e inicialización de SDKs (`supabaseClient`).
- `/src/types`: Tipos globales de base de datos y dominio (`database.types.ts`).

## Estado Actual de la Base de Código
- Usamos React 19 + TypeScript con TailwindCSS v4.
- Las rutas están centralizadas en `src/router.tsx`.

## Reglas para el Agente
1. NO escanees carpetas fuera de `/src` salvo que se te indique explícitamente.
2. Al modificar o crear archivos, respeta la arquitectura modular por features descrita aquí.