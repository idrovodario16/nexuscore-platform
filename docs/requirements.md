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

Revisión: 2026-11-27. El estado distingue implementaciones parciales y propuestas sin fusionar. Una prueba omitida no satisface el criterio correspondiente; no se considera completo el sistema mientras haya requisitos pendientes o validaciones fallidas.

| Prioridad | Historia | Estado observado | Terminado cuando… |
| --- | --- | --- | --- |
| P0 | Vista de usuarios por empresa | Propuesta en esta rama; lectura únicamente | Admin accede a Usuarios con páginas 25/3, estados de carga/error y sesión expirada; cambio de empresa cancela y oculta datos anteriores; navegación de otros roles bloqueada; Chromium escritorio/móvil y CI aprobados, incorporación revisada |
| P0 | Consulta de usuarios por empresa | API incorporada en Core PR #9; CI aprobada | Solo admin de esa empresa obtiene miembros/roles, sin datos de contraseña o sesión; paginación estable de 25; permisos vigentes, expiración y aislamiento probados con rol restringido; CI aprobada e incorporación revisada |
| P0 | Reintentos de ventas | Incorporado en Core PR #8; CI aprobada | Mismo identificador y contenido equivalente devuelve la venta original; cambios de cliente, productos o cantidades dan 409 sin escrituras; UUID equivalentes y orden de líneas no afectan; pruebas de repositorio y HTTP con rol restringido, CI aprobada e incorporación revisada |
| P0 | Fechas con zona horaria en demos | Core PR #6 e Insight PR #5 incorporados; CI aprobada | UTC y offsets positivos/negativos se importan en los tres campos sin cambiar el texto; exportar/reimportar conserva revisión y unicidad; fechas sin zona o inválidas se rechazan sin modificar el estado; pruebas y build aprobados |
| P0 | Escrituras serializadas por empresa | Incorporado en [PR #3](https://github.com/idrovodario16/nexuscore-platform/pull/3), CI aprobada | CI con PostgreSQL y rol restringido aprueba exclusión entre mayúsculas/minúsculas, independencia de otra empresa y liberación en commit/rollback |
| P0 | Validación de productos repetidos en ventas | Incorporado en PR #5; CI aprobada | Pruebas unitarias rechazan duplicados en ambos órdenes y aceptan productos distintos; HTTP devuelve 400 sin cambiar stock, ventas, líneas, movimientos, operaciones, historial ni outbox |
| P0 | Identidad de operaciones importadas | Incorporado en Core PR #4 e Insight PR #3; CI aprobada | UUID equivalentes no duplican filas ni métricas, se conserva la revisión mayor y empresas distintas siguen separadas; pruebas y build aprobados |
| P0 | Dependencias de desarrollo | Aviso GHSA-fc5q-39xc-vjpf retirado el 18/11; npm audit web sin alertas el 19/11, sin cambiar paquetes | Revalidar avisos vigentes y compatibilidad antes de actualizar; conservar locks reproducibles y pruebas/build aprobados |
| P0 | Administración de empresas y usuarios | Sesiones, membresías, roles y API de consulta incorporados; vista de lectura propuesta; gestión pendiente | Administrador crea/desactiva usuarios y empresas, asigna/revoca membresías; pruebas impiden acceso cruzado y verifican revocación de sesiones |
| P0 | Identidad OIDC y RBAC | Pendiente; credenciales locales y de integración disponibles | Operador/analista/admin autorizados por claims y tenant; pruebas de expiración y revocación aprobadas |
| P0 | Insight conectado al backend | Demo e ingestión API disponibles; interfaz conectada pendiente | Modos demo/API explícitos, paginación y errores visibles, E2E de consulta e ingestión contra la API de Insight |
| P0 | Aislamiento PostgreSQL en ambos productos | Fases 1/2 incorporadas en main de ambos productos; CI aprobada | Cada producto valida con rol restringido lecturas/escrituras cruzadas, reutilización de conexiones y rollback; revisión e incorporación de cambios según decisión humana |
| P0 | Auditoría de actor | Historial de despachos y movimientos de inventario parcial | Altas/cambios de empresas, usuarios, módulos, productos, clientes y cobros persisten actor, fecha y trazabilidad; pruebas de cobertura y permisos |
| P1 | Módulos configurables | Pendiente | Configuración persistente por empresa; módulos deshabilitados bloqueados también en API y probados por rol |
| P1 | Configuración multisectorial | Tres sectores fijos de ejemplo | Plantillas versionadas por empresa, validación en API y migración probada sin duplicar lógica de negocio |
| P1 | Sincronización de eventos comerciales | Outbox de operaciones disponible; relay externo; cobertura comercial parcial | Prueba Core → Insight de venta, cobro y cancelación con reintentos, duplicados y revisiones fuera de orden, manteniendo inicio independiente |
| P1 | Copias de seguridad | Recuperación sin validar | Procedimiento documentado restaura cada base en un entorno aislado y verifica integridad, RPO y RTO medidos |
| P1 | Disponibilidad de PostgreSQL | Core PR #7 e Insight PR #6 incorporados; CI aprobada | `/ready` público consulta la base en cada solicitud; 200/503 genérico sin caché; fallo/recuperación y HTTP probados con rol restringido; `/health` permanece independiente; CI aprobada e incorporación revisada |
| P1 | Monitoreo del relay y servicios | Salud y disponibilidad de base incorporadas; alertas y métricas pendientes | Pruebas verifican métricas de lag, fallos, reintentos, alertas y cola de errores |
| P1 | Importación CSV analítica | Pendiente | Mapeo de columnas, validación y reporte de errores probados |
| P2 | Análisis temporal y anomalías | Pendiente | Métricas explicables verificadas contra datasets conocidos |
| P2 | Extracción de microservicios | Pendiente de necesidad demostrada | Decisión soportada por carga o autonomía de equipos |

Las filas parciales no anuncian sus criterios pendientes como terminados. Las pruebas de seguridad, recuperación, carga y accesibilidad integral siguen pendientes.

La retirada del [aviso de picomatch](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) explica el cambio respecto a la auditoría del 18/11. Cero avisos en npm audit no certifica la seguridad del sistema ni sustituye las validaciones pendientes.
