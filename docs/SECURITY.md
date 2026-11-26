# Seguridad y perfiles privados

Cada usuario tiene un directorio de datos fuera del repositorio, en Windows %LOCALAPPDATA%\ECOAGENT. Los perfiles de Chrome/Chromium son independientes del perfil cotidiano. No copiar el perfil cotidiano ni exportar cookies, contraseñas o tokens. El navegador puede conservar sesiones y ofrecer su gestor nativo de credenciales según configuración y políticas del sistema. Iniciar sesión manualmente. No se garantiza sincronización de Google ni persistencia de todas las sesiones.

## Uso
1. Arranque local y token temporal.
2. Seleccione perfil institucional o personal (identificador libre en minúsculas), y Chrome instalado o Chromium.
3. Abra perfil privado; inicie sesión directamente en navegador. En modo privado la API rechaza inspección, capturas, navegación y clics.
4. Reactive automatización cuando termine. Cambiar perfil cierra el contexto anterior y abre el nuevo.
5. Cierre el motor al terminar. Para revocar sesiones cierre sesión en el sitio o gestione el perfil con Chrome; para eliminar datos locales cierre el motor y elimine el directorio correspondiente.

## Límites y amenazas
El modo privado es una barrera operativa para clientes cooperativos, no aislamiento frente a quien posee el token de control: dicho cliente puede reactivarlo. No entregue el token a modelos o terceros. El servidor escucha solo localhost. No hay API de lectura de cookies, contraseñas ni almacenamiento de sesión. Los valores de campos no se devuelven; etiquetas/títulos pueden contener datos personales o secretos y las capturas autorizadas pueden mostrar información sensible. Los filtros son heurísticos, no garantía de anonimización. Las URLs se devuelven sin query ni fragmento, aunque la ruta puede contener secretos. No exponer API ni enviar resultados privados a terceros sin revisar. El sistema operativo y navegador administran cifrado/ACL; no se garantiza protección frente a malware o usuarios con acceso a la misma cuenta. No sincronizar datos privados ni copiarlos a discos compartidos. No se ha auditado ni probado en Windows todavía.

El código público nunca contiene datos de sesión. No publicar archivos privados, aun con .gitignore; revisar git status antes de cada commit. La portabilidad del código no implica portabilidad de credenciales cifradas.
