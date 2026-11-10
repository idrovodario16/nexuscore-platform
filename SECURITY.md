# Seguridad

No publiques tokens, archivos .env ni información real en incidencias o ejemplos. Las claves de .env.example son ficticias y solo sirven para un entorno local aislado.

Las rutas v1 para integraciones usan una API key del lado servidor y autorizan una sola organización configurada por instancia. Workspace usa contraseñas con scrypt, sesiones con caducidad, membresías por empresa y auditoría de actor. La autorización de Workspace se aplica en la API y las consultas filtran por empresa. Antes de exponer el piloto a usuarios reales, incorpora un proveedor de identidad, TLS, límites de intentos y políticas de aislamiento en la base.

Los frontends públicos no contienen claves ni llaman a las APIs. Sus datos se guardan en localStorage del visitante y se pueden restaurar. No deben usarse para datos sensibles. Los imports de la demo admiten como máximo 2 MB y 1000 eventos; la API analítica admite 1000 eventos por lote. En un despliegue real configura también un límite de bytes en el proxy de entrada y límites de solicitudes.

Reporta un problema de forma privada al propietario mediante los medios de contacto de su perfil GitHub, sin incluir secretos en incidencias públicas.
