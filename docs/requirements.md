# Requisitos, alcance y backlog

## Objetivo y actores
Demostrar competencias de desarrollo Full Stack, modelado de procesos y backend TypeScript en una solución multisectorial. Actores: visitante de portafolio, operador demo, analista e integrador técnico. Workspace autoriza membresías por empresa y la API v1 admite credenciales por empresa. Cada producto conserva su propia base y puede funcionar de forma independiente.

## Requisitos funcionales implementados
| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| RF01 | Muestra autónoma | Abre sin el otro producto y muestra 24 operaciones ficticias |
| RF02 | Crear operación | Valida título, sector y centavos; inicia pending/revisión 1 |
| RF03 | Ciclo de estados | Terminales no se reabren; revisión esperada desactualizada da 409 |
| RF04 | Filtrado y métricas demo | Sector, estado, mes y texto recalculan resultados |
| RF05 | Interoperabilidad | JSON v1 válido transporta instantáneas entre productos |
| RF06 | Persistencia y autonomía API | PostgreSQL propio; arranca sin el otro producto |

## No funcionales
Validación de entradas; secretos fuera del frontend; queries parametrizadas; límites de lotes; control de organización; código separado por responsabilidad; pruebas automatizadas y build reproducible con locks; diseño responsive y etiquetas accesibles. No se han certificado un SLA, carga máxima, WCAG completa ni rendimiento de producción.

## Hoja de ruta verificable

Revisión: 2026-11-18. El estado distingue implementaciones parciales y propuestas sin fusionar. Una prueba omitida no satisface el criterio correspondiente; no se considera completo el sistema mientras haya requisitos pendientes o validaciones fallidas.

| Prioridad | Historia | Estado observado | Terminado cuando… |
| --- | --- | --- | --- |
| P0 | Escrituras serializadas por empresa | Incorporado en [PR #3](https://github.com/idrovodario16/nexuscore-platform/pull/3), CI aprobada | CI con PostgreSQL y rol restringido aprueba exclusión entre mayúsculas/minúsculas, independencia de otra empresa y liberación en commit/rollback |
| P0 | Identidad de operaciones importadas | Corrección propuesta en ambos productos | UUID equivalentes no duplican filas ni métricas, se conserva la revisión mayor, empresas distintas siguen separadas y un lote inválido no modifica el estado; pruebas web y compilación aprobadas |
| P0 | Dependencias de desarrollo | npm audit detectó 5 entradas de severidad alta en la cadena de Vite/picomatch | Resolver GHSA-fc5q-39xc-vjpf con versiones compatibles, locks reproducibles, audit sin la alerta y pruebas/compilación de ambos productos aprobadas |
| P0 | Administración de empresas y usuarios | Sesiones, membresías y roles de Workspace implementados; administración pendiente | Administrador crea/desactiva usuarios y empresas, asigna/revoca membresías; pruebas impiden acceso cruzado y verifican revocación de sesiones |
| P0 | Identidad OIDC y RBAC | Pendiente; credenciales locales y de integración disponibles | Operador/analista/admin autorizados por claims y tenant; pruebas de expiración y revocación aprobadas |
| P0 | Insight conectado al backend | Demo e ingestión API disponibles; interfaz conectada pendiente | Modos demo/API explícitos, paginación y errores visibles, E2E de consulta e ingestión contra la API de Insight |
| P0 | Aislamiento PostgreSQL en ambos productos | Fases 1/2 incorporadas en main de ambos productos; CI aprobada | Cada producto valida con rol restringido lecturas/escrituras cruzadas, reutilización de conexiones y rollback; revisión e incorporación de cambios según decisión humana |
| P0 | Auditoría de actor | Historial de despachos y movimientos de inventario parcial | Altas/cambios de empresas, usuarios, módulos, productos, clientes y cobros persisten actor, fecha y trazabilidad; pruebas de cobertura y permisos |
| P1 | Módulos configurables | Pendiente | Configuración persistente por empresa; módulos deshabilitados bloqueados también en API y probados por rol |
| P1 | Configuración multisectorial | Tres sectores fijos de ejemplo | Plantillas versionadas por empresa, validación en API y migración probada sin duplicar lógica de negocio |
| P1 | Sincronización de eventos comerciales | Outbox de operaciones disponible; relay externo; cobertura comercial parcial | Prueba Core → Insight de venta, cobro y cancelación con reintentos, duplicados y revisiones fuera de orden, manteniendo inicio independiente |
| P1 | Copias de seguridad | Recuperación sin validar | Procedimiento documentado restaura cada base en un entorno aislado y verifica integridad, RPO y RTO medidos |
| P1 | Monitoreo del relay y servicios | Salud básica; alertas y métricas pendientes | Pruebas verifican métricas de lag, fallos, reintentos, alertas y cola de errores |
| P1 | Importación CSV analítica | Pendiente | Mapeo de columnas, validación y reporte de errores probados |
| P2 | Análisis temporal y anomalías | Pendiente | Métricas explicables verificadas contra datasets conocidos |
| P2 | Extracción de microservicios | Pendiente de necesidad demostrada | Decisión soportada por carga o autonomía de equipos |

Las filas parciales no anuncian sus criterios pendientes como terminados. Las pruebas de seguridad, recuperación, carga y accesibilidad integral siguen pendientes.
