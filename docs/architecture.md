# Arquitectura de NexusCore

## C4: contexto
El usuario explora una demo React independiente. Un integrador usa la API autenticada del producto. Core administra el ciclo de operaciones y expone eventos para consumidores opcionales. Ningún producto consulta la base del otro.

## C4: contenedores
React/Vite estático; API NestJS/TypeScript; PostgreSQL exclusivo; relay HTTP externo y opcional. La demo y la API no están conectadas entre sí en esta versión. El despliegue local incluye web, API y DB. Pages aloja únicamente React.

## C4: componentes
Controlador valida transporte; servicio coordina casos de uso mediante OperationsRepository; dominio define transiciones; adaptador PostgreSQL persiste entidad y outbox atómicamente.

## Modelo de datos
`operations(id UUID PK, organization_id, title, sector, status, amount_cents, revision, created_at, updated_at)` representa el estado actual. `outbox(sequence BIGSERIAL PK, organization_id, event JSONB, created_at)` representa el historial de integración. Un bloqueo transaccional por organización serializa la asignación/confirmación de cursores y evita que un poll avance sobre una transacción todavía sin confirmar.

Los índices compuestos empiezan por organization_id. La credencial de esta instancia solo da acceso al tenant configurado. No se declara aislamiento multiusuario de producción. Fechas de creación inmutables; estados terminales en Core; revisiones monotónicas en Insight. El esquema SQL inicial es idempotente. Para cambios posteriores se deben añadir migraciones numeradas; no editar retrospectivamente el SQL aplicado en entornos persistentes.

## Consistencia y límites
Integración eventual y entrega al menos una vez. El relay confirma checkpoint solo al terminar la ingestión. El evento es un snapshot completo: se puede reconstruir facts desde outbox. Borrados, cambios de moneda, conflictos de mismo ID/revisión con datos distintos y cambio de organización quedan fuera del contrato v1. Solo el productor dueño del registro puede emitir revisiones válidas. Se conservan inbox/outbox sin política automática de limpieza; la retención debe definirse antes de operar a escala.

El desglose C4 y las decisiones compartidas están en [nexus-architecture](https://github.com/idrovodario16/nexus-architecture).

## Actualización: acceso de integración multiempresa

La limitación de una sola credencial por instancia descrita arriba corresponde al modo anterior. Ahora un módulo de autorización valida un registro de credenciales por empresa y permisos al inicio, antes de atender v1. Consulta [fase 1](phase1-tenant-access.md). Workspace conserva su propia autorización por sesión y membresía.

## Fase 2

Las tablas de datos empresariales incorporan RLS y contexto local a la transacción; el adaptador establece el contexto después de la autorización. Migraciones y ejecución usan cuentas distintas. Ver [alcance y despliegue](phase2-database-isolation.md). Esto amplía el aislamiento de aplicación de la fase 1 sin cambiar contratos ni compartir bases.
