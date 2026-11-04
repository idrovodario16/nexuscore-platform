# Seguridad

No publiques tokens, archivos .env ni información real en incidencias o ejemplos. Las claves de .env.example son ficticias y solo sirven para un entorno local aislado.

Este MVP autoriza una sola organización por instancia con una API key larga del lado servidor. No es autenticación de usuarios; OIDC, RBAC, rotación administrada, TLS, cuotas, rate limiting y auditoría de actor son requisitos antes de producción. Todos los accesos de negocio deben presentar Bearer y X-Organization-ID. Las consultas usan parámetros y filtran la organización.

Los frontends públicos no contienen claves ni llaman a las APIs. Sus datos se guardan en localStorage del visitante y se pueden restaurar. No deben usarse para datos sensibles. Los imports de la demo admiten como máximo 2 MB y 1000 eventos; la API analítica admite 1000 eventos por lote. En un despliegue real configura también un límite de bytes en el proxy de entrada y límites de solicitudes.

Reporta un problema de forma privada al propietario mediante los medios de contacto de su perfil GitHub, sin incluir secretos en incidencias públicas.
