# Estrategia de pruebas

1. Modelo de demo: muestras válidas, rechazo atómico de eventos inválidos, reenvíos y revisiones fuera de orden, reglas de estados e indicadores sobre conjunto vacío.
2. Dominio API: validación y fórmulas sin requerir red.
3. HTTP: credenciales ausentes → 401; organización distinta → 403; entrada inválida → 400/422.
4. PostgreSQL: creación/cambio de estado, conflicto de revisión y conteo exacto de outbox sin evento por actualización fallida.
5. Entrega: build Vite, build de contenedores y despliegue Pages tras CI en main.

Las pruebas con base se habilitan con RUN_INTEGRATION=1. CI provee PostgreSQL real; sin esa variable quedan omitidas de forma visible. La revisión visual debe comprobar escritorio/móvil, formularios, navegación y recorrido exportar/importar. Las pruebas de carga, penetración, accesibilidad integral y recuperación de backups están pendientes.
