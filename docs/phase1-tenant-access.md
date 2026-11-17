# Fase 1: acceso de integración multiempresa

## Revisión del punto de partida

Revisado el 17 de noviembre de 2026. Ambos repositorios tenían solo main y ningún PR abierto. Core parte de d2dd17a: NestJS, PostgreSQL, dominio/aplicación/adaptadores, outbox y Workspace con sesiones y membresías. Insight parte de 15981a0: FastAPI, repositorio PostgreSQL, inbox y facts. Las demos React son independientes. La carencia elegida fue la credencial global de las APIs v1, no rehacer Workspace ni unir las bases.

## Configuración y permisos

INTEGRATION_CREDENTIALS contiene un array JSON de objetos con exactamente estas propiedades:

```json
[
  {
    "key_sha256": "<digest SHA-256 hexadecimal minúsculo de 64 caracteres>",
    "organization_id": "11111111-1111-4111-8111-111111111111",
    "permissions": ["read"]
  }
]
```

El ejemplo es una plantilla: sustituye el digest antes de usarlo. Genera tokens aleatorios de al menos 32 caracteres con un gestor de secretos o crypto.randomBytes(32).toString('hex'). Calcula el digest SHA-256 del token UTF-8. Guarda solo el digest en este registro y entrega el token al cliente por un canal seguro. No uses contraseñas humanas: un hash sin sal no protege secretos débiles. No guardes tokens, registros reales ni archivos .env en Git.

Cada token pertenece a una sola empresa. Puedes registrar varios tokens por empresa para consumidores y rotaciones. Los digests duplicados, permisos desconocidos, listas vacías y JSON inválido impiden arrancar, sin mostrar secretos. El registro se valida una vez al iniciar. read permite GET/HEAD de v1; write permite mutaciones. write no implica read. No existen comodines ni acceso global. La cabecera X-Organization-ID sigue siendo obligatoria; una credencial válida con otra empresa devuelve 403. Credenciales ausentes o incorrectas devuelven 401.

Sin la variable se conserva API_KEY + ORGANIZATION_ID, con read y write para una sola empresa. Al definir el registro se desactiva ese fallback, incluso si es inválido. Revocar o rotar requiere actualizar el registro y reiniciar cada instancia. Para rotación sin corte, agrega el nuevo digest, reinicia, cambia el cliente y retira el anterior con otro reinicio.

Para Docker establece INTEGRATION_CREDENTIALS como JSON en el entorno del servidor o en .env y ejecuta:

```bash
docker compose -f compose.yaml -f compose.integration.yaml up -d --build
```

El archivo adicional exige una configuración no vacía. El Compose habitual conserva el modo anterior. Fuera de Docker exporta la variable antes de arrancar la API. Los seeds siguen usando ORGANIZATION_ID como empresa de muestra: no provisionan todas las empresas del registro. La autorización de v1 no modifica usuarios ni membresías de Workspace.

## Integración independiente

Para cada empresa, configura un token Core con read para el relay y otro token Insight con write. Mantén el mismo UUID de empresa, con tokens diferentes en cada producto. El relay existente sigue enviando Bearer y X-Organization-ID, sin cambios al contrato v1. Los tableros de Insight pueden usar un tercer token con read. Cada relay conserva su checkpoint por empresa. No se comparten tablas ni acceso directo a la otra base.

## Validación y límites

Las pruebas cubren rechazo de credenciales, empresas y permisos, configuración inválida y compatibilidad del modo anterior. CI ejecuta PostgreSQL 16 y las pruebas HTTP con base real, además de la web y contenedores. Incluye lectura de operaciones/outbox por empresa y rechazo de actualización de una operación ajena.

El aislamiento es de aplicación con consultas filtradas por empresa. No incorpora PostgreSQL RLS: una credencial de base privilegiada sigue pudiendo leer todas las empresas. Esta fase es para integraciones de servicio, no sustituye OIDC, MFA, recuperación de cuenta, gestión dinámica de empresas, auditoría por identidad de servicio ni administración SaaS. Los sectores siguen siendo logistics, retail y services; no se añaden módulos empresariales ficticios. Próximas fases: identidad y ciclo de vida de empresas, RLS con rol no propietario y pruebas, auditoría, configuración modular por sector y observabilidad.
