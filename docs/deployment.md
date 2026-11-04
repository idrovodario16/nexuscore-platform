# Publicación en GitHub Pages

Fecha: 4 de noviembre de 2026.

- [NexusCore](https://idrovodario16.github.io/nexuscore-platform/)
- [NexusInsight](https://idrovodario16.github.io/nexusinsight-analytics/)
- [Guía de integración y arquitectura](https://idrovodario16.github.io/nexus-architecture/)

## Qué se publica

Los dos productos publican la compilación React/Vite de `dist/`. La guía publica HTML/CSS de `site/`. GitHub Pages sirve archivos estáticos: las APIs NestJS/FastAPI, PostgreSQL y el relay HTTP se ejecutan por separado. Las demos contienen datos ficticios y guardan los cambios en el navegador.

## Actualización y verificación

En los tres repositorios, Pages usa **GitHub Actions** como fuente. El flujo `pages.yml` se ejecuta al cambiar `main` o de forma manual desde Actions. Los productos instalan con `npm ci`, ejecutan `npm test`, compilan y publican; la guía publica su carpeta estática. El enlace del paso de despliegue y la vista pública confirman la versión publicada.

Las versiones anteriores de Sites se mantienen como alojamientos separados. Un cambio en GitHub actualiza Pages mediante Actions; no actualiza Sites automáticamente.

## Probar la integración entre las demos

1. Abre [NexusCore](https://idrovodario16.github.io/nexuscore-platform/) y crea una operación ficticia con un título fácil de reconocer.
2. Avanza su estado de **Pendiente → En curso → Completada**. Cada cambio aumenta su revisión.
3. Pulsa **Exportar eventos** para descargar las instantáneas JSON de todas las operaciones.
4. Abre [NexusInsight](https://idrovodario16.github.io/nexusinsight-analytics/) y pulsa **Importar eventos** para seleccionar ese archivo.
5. Busca el título de la operación y revisa los indicadores. Puedes exportar el conjunto filtrado a CSV.
6. Importa el mismo archivo otra vez: no se duplican las operaciones ni se incrementan los indicadores. Una revisión anterior tampoco sobrescribe una más reciente.

Las demos guardan sus conjuntos por separado en localStorage, con claves distintas. **No se sincronizan automáticamente**, aunque estén bajo el mismo dominio de GitHub Pages. Para reflejar un cambio posterior debes volver a exportar e importar. La vista **Integración** de cada producto explica el recorrido y enlaza al otro.

### Integración entre APIs, fuera de Pages

NexusCore escribe la operación y su evento en la misma transacción de PostgreSQL (**outbox**). El relay de este repositorio consulta `GET /v1/events` y entrega lotes a `POST /v1/events` de NexusInsight. Insight valida el contrato v1, registra el identificador del evento en **inbox** y actualiza la instantánea solo si su revisión es mayor. El relay guarda el checkpoint después de una respuesta exitosa y reintenta fallos temporales; una repetición se procesa sin doble conteo.

Cada API tiene su propia base PostgreSQL. Core puede operar sin Insight, e Insight puede consumir otra fuente compatible. El flujo es de **Core hacia Insight**; Insight no modifica las operaciones de Core. Las interfaces públicas todavía no están conectadas a esas APIs: para probar el flujo HTTP hay que ejecutar los servicios y el relay localmente.

[Guía visual de integración](https://idrovodario16.github.io/nexus-architecture/) · [Contratos y ejecución local](https://github.com/idrovodario16/nexus-architecture#integración-real-paso-a-paso)

