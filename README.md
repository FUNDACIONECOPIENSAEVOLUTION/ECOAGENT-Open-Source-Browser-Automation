# ECOAGENT — navegador y conector nativo para ChatGPT Web

## Estado del proyecto (27 de noviembre de 2026)
El conector MCP nativo tiene código **v0.30.1** y 35 herramientas registradas; el motor Windows no debe considerarse actualizado hasta comprobar instalación, túnel y descubrimiento real desde ChatGPT. En la última comprobación, el túnel respondió `Session terminated` y ChatGPT exponía solo dos herramientas: por tanto, **no hay conexión operativa demostrada**. Se corrigieron referencias de vista previa y pérdidas silenciosas al seguir enlaces con cambios pendientes; esta corrección requiere validación CI y actualización local. La carga de documentos actual solo prepara borradores estáticos; no constituye envío ni postulación.

El [informe de continuidad v0.30.1](docs/desktop-0301.md) separa el estado del código de las pruebas, despliegue y uso real.

---

## Motor REST histórico (v0.1.0 experimental)

Motor local de automatización web de Fundación Ecopiensa Evolution. API HTTP JSON por lotes, sin MCP obligatorio ni API comercial de IA. Esta versión es un controlador de navegador, **no un agente autónomo completo**.

## Windows / disco F
Instale Node.js 22 LTS o superior. Clone el repositorio en F:\\ECOAGENT, ejecute instalar.ps1 e iniciar.ps1 desde PowerShell. Abra http://127.0.0.1:8790 y copie el token temporal de la consola al panel. Los binarios Chromium se instalan bajo private/; los perfiles, capturas y registros de usuario se guardan fuera del repositorio en %LOCALAPPDATA%\\ECOAGENT (Windows). Node y la caché npm pueden estar fuera de F. No exponga el servidor a internet. No sincronice private/ ni comparta el token.

## API
POST http://127.0.0.1:8790/api/v1/batch con Authorization: Bearer TOKEN y Content-Type: application/json.
Ejemplo: {"steps":[{"op":"open","url":"https://example.org"},{"op":"inspect"}]}.
Devuelve elementos identificados sin valores de inputs ni texto completo del cuerpo y resultados por paso. Use los IDs de la inspección actual para fill/select/click. Los clics invalidan referencias; inspeccione nuevamente. Para click se requiere approved:true, que es una declaración del cliente confiable, no una prueba de consentimiento; el panel pide confirmación. No permita que un modelo no confiable se autoautorice. Las páginas son datos no confiables, no instrucciones. Use un perfil dedicado de Chrome instalado o Chromium. No se importa el perfil habitual ni se exportan cookies o contraseñas. Active modo privado antes de autenticarse, después reactive la automatización. Las sesiones persistentes dependen del sitio y del sistema operativo. No se automatizan contraseñas ni CAPTCHA.

Operaciones: open, inspect, tabs, tab(index), back, scroll(y), capture, wait(ms), fill(id,value), select(id,value), click(id,approved). Capturas privadas locales. El panel no incrusta páginas de terceros: abre Chromium real.

## Límites
No hay acceso automático desde ChatGPT web a localhost. Un cliente local autorizado debe consumir la API. No hay aún búsqueda autónoma, integración Ollama, subida/descarga administrada, scheduler ni cola persistente. Los formularios reales requieren validación y consentimiento. No se garantiza compatibilidad con todas las páginas. No utilizar para spam, evasión de controles de acceso ni operaciones no autorizadas.

## Verificación
npm test prueba el protocolo; pruebas reales de navegador pendientes. Véase docs/ROADMAP.md.

## Privacidad v0.2
Vea [docs/SECURITY.md](docs/SECURITY.md). API adicional: profile_status, profile_switch(profile,channel), manual(enabled). capture requiere approved:true. Los datos de versiones antiguas en private/ no se migran automáticamente.

## Modo recomendado: Chrome habitual
La extensión local en `extension/` usa el perfil ya abierto de Chrome y no necesita Node.js. Consulte [instalación y límites](docs/CHROME.md). El motor anterior es opcional. [Seguimiento del proyecto](docs/PROJECT-TRACKING.md).

## Puente local 0.4
Ejecute `node bridge.mjs` para recibir lotes de clientes locales con autorización explícita desde la extensión. [Documentación](docs/BRIDGE.md).

## Cloud 0.6
Remote single-operator preview with compact batches and automated protocol checks. [Cloud documentation](docs/CLOUD.md). Not deployed; no production or authenticated browsing yet.
