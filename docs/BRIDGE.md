# Puente local ECOAGENT 0.4 experimental

Node.js 22+; ejecute node bridge.mjs (no necesita npm install). Recargue la extensión en chrome://extensions. Abra la página objetivo en Chrome, abra ECOAGENT e introduzca la clave OPERADOR de la consola. Un cliente local distinto recibe únicamente CLIENTE. No publicar ninguna clave ni exponer el puerto.

POST http://127.0.0.1:8791/v1/jobs con Authorization: Bearer CLIENTE y JSON:
{"origin":"https://example.org","steps":[{"op":"inspect"}]}
Devuelve id. Consulte GET /v1/jobs/ID con CLIENTE. El operador consulta la cola en la extensión y aprueba cada acción. fill/click requieren label exacto y único; fill además value. No hay ejecución arbitraria ni navegación remota. Los resultados solo se comparten con aprobación explícita; no hay almacenamiento persistente, caducan a los 15 minutos. Si se cierra el popup una tarea puede permanecer running hasta caducar.

El puente es solo local: ChatGPT web no puede llamarlo directamente. No incluye conexión a servicios externos, scheduler ni agente autónomo. La extensión utiliza el perfil actual y conserva las limitaciones de docs/CHROME.md. No enviar datos sensibles a clientes; las etiquetas pueden incluirlos. No se ha realizado auditoría de seguridad ni pruebas reales de Chrome.
