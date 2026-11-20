# Estrategia de pruebas

1. Modelo de demo: muestras válidas, rechazo atómico de eventos inválidos, reenvíos y revisiones fuera de orden, reglas de estados e indicadores sobre conjunto vacío. `tests/import-identity.test.mjs` verifica UUID en mayúsculas/minúsculas, coincidencia de empresa en sobre/datos, reconciliación de registros existentes conservando la revisión mayor, métricas sin duplicados, empresas distintas y entradas originales sin modificar. Las nuevas regresiones fallaron antes de la corrección.
2. Dominio API: validación y fórmulas sin requerir red.
3. HTTP: credenciales ausentes → 401; organización distinta → 403; entrada inválida → 400/422.
4. PostgreSQL: creación/cambio de estado, conflicto de revisión y conteo exacto de outbox sin evento por actualización fallida.
   Las ventas rechazan productos repetidos incluso cuando el UUID cambia de capitalización. `api/test/business-input.test.ts` cubre duplicados en ambos órdenes, productos distintos y UUID inválidos. Workspace comprueba HTTP 400 y que stock, ventas, líneas, movimientos, operaciones, historial y outbox conserven el estado anterior a la solicitud inválida.
   La prueba de bloqueos en `api/test/isolation.test.ts` usa dos conexiones con rol restringido: mientras una transacción escribe para un UUID en minúsculas o mayúsculas, la otra no puede adquirir el bloqueo canónico de esa empresa. Otra empresa mantiene su bloqueo independiente. Tanto commit como rollback deben liberar el bloqueo. No necesita datos persistidos ni esperas temporizadas.
5. Entrega: build Vite, build de contenedores y despliegue Pages tras CI en main.

Las pruebas con base se habilitan con RUN_INTEGRATION=1. CI provee PostgreSQL real; sin esa variable quedan omitidas de forma visible. La revisión visual debe comprobar escritorio/móvil, formularios, navegación y recorrido exportar/importar. Las pruebas de carga, penetración, accesibilidad integral y recuperación de backups están pendientes.
