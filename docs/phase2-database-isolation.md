# Fase 2: aislamiento de datos en PostgreSQL

## Punto de partida

Core continúa sobre main después del PR #1 fusionado. Insight continúa sobre codex/phase1-tenant-access y su PR #1 pendiente; el PR de fase 2 se dirige a esa rama para revisar solo los cambios nuevos. No se fusiona ninguna rama automáticamente.

## Qué protege

Migración 004: operations, outbox, workspace_history y las cinco tablas business_* de productos, clientes, ventas, líneas y movimientos. Las tablas habilitan ENABLE y FORCE ROW LEVEL SECURITY con una política para SELECT, INSERT, UPDATE y DELETE. La empresa de cada fila debe coincidir con nexus.organization_id. Sin contexto no se leen filas y las inserciones se rechazan. WITH CHECK impide mover una fila a otra empresa.

Los repositorios establecen el contexto con set_config(..., true) dentro de una transacción y lo liberan al confirmar o revertir. Se mantienen los filtros explícitos de empresa y la autorización HTTP. Las lecturas de Workspace y de negocio usan el mismo adaptador transaccional. Las escrituras de venta, stock, despacho e historial conservan su transacción atómica.

## Cuenta de migración y cuenta de ejecución

Las migraciones se ejecutan con una cuenta propietaria, usando npm run migrate desde api. Después, un administrador ejecuta api/scripts/runtime-role.sql contra esa misma base para preparar nexus_core_runtime, un rol NOLOGIN con permisos mínimos y sin DDL, TRUNCATE, SUPERUSER ni BYPASSRLS. El script no crea contraseñas ni cambia roles ajenos existentes. No uses el nombre del rol para una cuenta previamente privilegiada.

Crea una cuenta LOGIN dedicada sin SUPERUSER, BYPASSRLS, CREATEDB ni CREATEROLE, sin propiedad de tablas y sin pertenecer a roles propietarios o administradores. Asígnale nexus_core_runtime; establece su contraseña mediante el gestor de secretos o el diálogo seguro de psql. El rol de permisos NOLOGIN no es la credencial de conexión. No uses como credencial de API el usuario propietario cambiando solamente SET ROLE.

Configura DATABASE_URL con esa cuenta LOGIN y REQUIRE_DATABASE_ISOLATION=1. El arranque verifica el rol actual, que no pueda asumir la propiedad de las tablas y que estén migradas con RLS forzada. Una configuración insegura detiene el arranque. Sin ese indicador se conserva el modo de desarrollo anterior: una cuenta SUPERUSER o BYPASSRLS ignora RLS incluso con FORCE. Para producción es obligatorio usar la cuenta restringida y activar la comprobación.

En Docker: aplica primero las migraciones con el Compose habitual y la cuenta propietaria; aprovisiona el rol y el LOGIN. Luego define RUNTIME_DATABASE_URL y arranca con:

```bash
docker compose -f compose.yaml -f compose.isolation.yaml up -d --build
```

Este archivo sustituye el comando automático de migración por el arranque directo de la API: la cuenta restringida no debe migrar. Si utilizas el registro de credenciales por empresa, agrega también -f compose.integration.yaml y define INTEGRATION_CREDENTIALS. La cuenta de migración no debe permanecer como secreto accesible al proceso de API. Fuera de Docker ejecuta las migraciones por separado y después arranca el servidor con el LOGIN restringido.

Realiza copia de seguridad y detén escritores de versiones anteriores durante el cambio: no establecen contexto y sus operaciones pueden quedar rechazadas. No se borran datos. La activación de RLS requiere bloqueo de tablas; planifica su ejecución. No se incluyen scripts destructivos de reversión.

## Pruebas y límites

CI provisiona PostgreSQL 16 y el rol restringido; prueba consultas sin filtro, escrituras cruzadas, aislamiento después de commit/rollback y ausencia de permiso TRUNCATE. Todas las pruebas HTTP de v1 y Workspace usan RLS, incluyendo ventas concurrentes, inventario, cobros y cancelaciones. La cuenta administradora se reserva para preparar y limpiar fixtures. SET ROLE se usa solo en pruebas para evitar contraseñas adicionales de CI; el despliegue requiere un LOGIN separado.

RLS refuerza errores en consultas, no sustituye autenticación ni membresías: el proceso de API es de confianza y selecciona empresa después de autorizar. Una credencial SQL comprometida puede cambiar el contexto; no es una barrera frente al compromiso total de la API. Las tablas globales de identidad, membresías y organizaciones no están bajo RLS; la cuenta de API tiene solo lectura allí, y lectura/escritura en sesiones para iniciar/cerrar sesión. La autorización de identidad sigue en Workspace. No se implementan OIDC, MFA, administración SaaS de empresas ni auditoría de identidades de integración en esta fase. Los productos y sus bases siguen independientes; el contrato v1 permanece igual.
