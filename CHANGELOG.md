# Cambios

## 2026-11-17 · Bloqueo de escrituras por empresa

- La clave del bloqueo transaccional se calcula sobre el UUID canónico de PostgreSQL. URLs de Workspace con el UUID en mayúsculas ya no pueden eludir la serialización de ventas, cobros y cancelaciones de la misma empresa.
- Regresión con dos conexiones restringidas: misma empresa con distinta capitalización, empresa independiente y liberación tras commit/rollback.
- Hoja de ruta actualizada con estado observado y criterios verificables; siguen pendientes requisitos de ambos productos.

## 2026-11-17 · Fase 2

- RLS en tablas empresariales, contexto transaccional y roles de ejecución mínimos.
- Comprobación opcional al arranque para rechazar roles privilegiados o esquemas sin protección.
- Pruebas con rol restringido y conexiones reutilizadas; despliegue separado de migraciones.

## 2026-11-17 · Fase 1

- Autorización de integración extraída a un módulo con credenciales SHA-256 por empresa.
- Permisos read/write, rechazo de configuración ambigua y compatibilidad con API_KEY.
- Pruebas de aislamiento, permisos y configuración; instrucciones para Docker y relay.
