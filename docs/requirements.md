# Requisitos, alcance y backlog

## Objetivo y actores
Demostrar competencias de desarrollo Full Stack, modelado de procesos y backend TypeScript en una solución multisectorial. Actores: visitante de portafolio, operador demo, analista e integrador técnico. Un solo tenant por instancia autenticada en el MVP.

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

## Backlog priorizado
| Prioridad | Historia | Terminado cuando… |
| --- | --- | --- |
| P0 | Conectar React a API mediante adaptadores | Modo demo y modo API explícitos, con E2E de ambos |
| P0 | Identidad OIDC y RBAC | Operador/analista/admin autorizados por claims y tenant |
| P0 | Auditoría de actor | Cambios persistidos con actor, fecha y trazabilidad |
| P1 | Formularios multisectoriales | Plantillas versionadas sin duplicar lógica de negocio |
| P1 | Automatizar relay y monitoreo | Reintentos, alertas, métricas de lag y dead-letter queue |
| P1 | Importación CSV analítica | Mapeo de columnas, validación y reporte de errores |
| P2 | Análisis temporal y anomalías | Métricas explicables verificadas contra datasets conocidos |
| P2 | Extracción de microservicios | Decisión soportada por carga o autonomía de equipos |

Todos los puntos del backlog son trabajo futuro, no funciones anunciadas como terminadas.
