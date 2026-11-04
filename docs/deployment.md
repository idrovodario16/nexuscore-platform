# Despliegue y verificación

Fecha: 4 de noviembre de 2026.

## Enlaces públicos

- NexusCore: https://nexuscore-idrovodario16-demo.brownlyric131.chatgpt.site
- NexusInsight: https://nexusinsight-idrovodario16-demo.brownlyric131.chatgpt.site

## Cómo se publicó

1. Se implementó cada frontend como aplicación React/Vite independiente. Se incluyó muestra ficticia, almacenamiento local e intercambio de eventos JSON.
2. Se instalaron dependencias con lockfiles y se ejecutaron pruebas y compilación de producción con npm run build.
3. Se verificaron en GitHub Actions las APIs con PostgreSQL 16 real y la construcción de los contenedores. La prueba integrada levantó ambas APIs y comprobó creación, cambio de estado, ingestión e idempotencia.
4. Se empaquetó la carpeta dist de cada frontend, se registró cada demo en Sites, se guardó una versión ligada al commit de su fuente de despliegue y se publicó con acceso público.
5. Se enlazaron ambas demos y se actualizaron los README. Los servidores y las bases no se alojaron públicamente.

## Qué implica este alojamiento

Sites entrega HTML, CSS y JavaScript de la demo. Las operaciones que haces se guardan en tu navegador. No hay base PostgreSQL pública, identidad de usuarios ni sincronización automática entre productos. Para probar funciones backend reales, sigue Docker y el relay descritos en los README.

El código fuente está en GitHub y las versiones de alojamiento se mantienen por separado. Para actualizar Sites: compila la nueva fuente, publica una nueva versión del mismo Site y verifica sus enlaces. El manifiesto .openai/hosting.json del checkout de alojamiento conserva su identidad; no crees un Site nuevo por cada actualización.

## Alternativa: GitHub Pages

Se conserva un flujo manual opcional en los dos repositorios de producto. Para usarlo:

1. Settings → Pages → Build and deployment → Source → GitHub Actions.
2. Actions → Optional GitHub Pages deployment → Run workflow → main.
3. Espera el resultado y usa la URL que devuelve el paso deploy-pages.
4. Si quieres que la demo principal cambie a Pages, actualiza los enlaces cruzados y el README y publica de nuevo.

No se debe anunciar una URL de Pages como publicada solo porque el archivo de workflow exista. En esta entrega las URLs principales son las de Sites.
