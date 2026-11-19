# Cambios

## 2026-11-19 · Revalidación de dependencias

- GitHub retiró el aviso GHSA-fc5q-39xc-vjpf el 18/11: https://github.com/advisories/GHSA-fc5q-39xc-vjpf.
- npm audit web devuelve cero alertas en ambos productos en la revisión del 19/11. No se cambiaron paquetes ni locks por este aviso. El resultado no certifica la seguridad general del sistema.

## 2026-11-18 · Identidad de operaciones importadas

- La importación JSON normaliza los UUID antes de comparar empresas y fusionar revisiones. El mismo identificador en mayúsculas/minúsculas ya no duplica operaciones ni indicadores.
- En cada importación se reconcilian también las filas existentes, conservando la revisión mayor y sin modificar los datos de entrada. Un lote inválido sigue rechazándose completo.
- Regresiones reproducidas antes de corregir y hoja de ruta actualizada. Pendiente: alerta de seguridad en dependencias de desarrollo detectada por npm audit.

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
