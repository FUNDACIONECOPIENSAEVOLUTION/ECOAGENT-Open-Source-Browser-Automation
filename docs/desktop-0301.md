# ECOAGENT v0.30.1 — continuidad de navegación y revisión (2026-11-27)

## Cambios de código
- El preview enmascarado valida origen y pantallas sensibles sin rehacer la inspección: las referencias de elementos siguen vigentes tras visualizar.
- `live_follow` y `click_demo` bloquean navegación si hay modificaciones en el borrador estático o adjuntos pendientes, devolviendo `blocked: true` y `reason: unsaved_draft`, sin descartar datos.
- El panel de control humano incorpora la acción **Desmarcar** para casillas de verificación. No habilita envíos externos.
- Pruebas adicionales de guardas de navegación, persistencia de referencias y acceso local al panel.

## Estados independientes y límites
- Código: propuesto v0.30.1; verificar commit y resultado de CI.
- Instalación Windows: última versión confirmada v0.23.2. No asumir despliegue de esta corrección.
- Descubrimiento de MCP en ChatGPT Web: 2 herramientas expuestas en el último diagnóstico frente a 35 registradas en código.
- Conexión real: última prueba `ecoagent_local_health` devolvió `Session terminated`; debe repetirse después de iniciar el túnel.
- Flujo real con autenticación, formularios JS, envío y comprobantes: **no implementado ni validado**. No declarar postulaciones como completadas.

## Criterio de aceptación próximo
1. Comprobar en Windows el servicio local, versión, bloqueo del mantenimiento y túnel sin revelar secretos.
2. Instalar revisión exacta aprobada tras respaldar D: y F: y validar recuperación.
3. En ChatGPT Web, invocar health y comprobar el catálogo real de herramientas, sin inferir que 35 son visibles.
4. En fixture offline probar edición, preview sin caducar refs, bloqueo de navegación con borrador, control humano, devolución a IA, recarga y archivos sintéticos.
5. Implementar y validar por origen flujos dinámicos y autenticación humana separados de los borradores estáticos, con permisos explícitos antes de enviar y con comprobante del proveedor.

Nunca adjuntar el proyecto macro ni credenciales ni sesiones. El portal Pages no ejecuta el navegador.
