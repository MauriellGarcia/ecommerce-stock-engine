# Arquitectura y Reglas del Proyecto

## Estructura General
- `/src/components`: Componentes reutilizables de UI.
- `/src/services`: Llamadas a APIs y lógica de backend.
- `/src/hooks`: Estado global y hooks personalizados.

## Estado Actual de la Base de Código
- Usamos React + TypeScript con Tailwind.
- Las rutas están definidas en `src/router.tsx`.

## Reglas para el Agente
1. NO escanees carpetas fuera de `/src` salvo que se te indique explícitamente.
2. Al modificar un archivo, asume que la arquitectura base descrita aquí es la correcta.