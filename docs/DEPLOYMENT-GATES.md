# Condiciones para publicar el servidor Cloud
1. Alojamiento independiente de Deriv con presupuesto aprobado y HTTPS.
2. Chromium sandbox activo, firewall de salida que bloquea IP privadas, loopback y metadata, lista de orígenes públicos evaluados. No usar túnel público al motor local que tiene sesiones.
3. Claves cliente y operador distintas, generadas fuera del repositorio, rotación, límite de solicitudes. Auto read desactivado hasta prueba.
4. Prueba real de health, autorización negativa, navegación pública y cierre del navegador.
5. Integración autorizada: OpenAPI para cliente compatible o adaptador MCP de alcance mínimo si la cuenta admite apps personalizadas. No instalar silenciosamente una herramienta. Confirmar permisos y soporte de plan.
6. Solo después: sesiones aisladas y persistentes, control humano, archivos, permisos de escritura por tarea y registro de comprobantes.
Estado: motor local probado; Cloud no desplegado. No se ha aprobado costo de alojamiento ni comprobado compatibilidad de sandbox/firewall en Railway. No prometer gratuidad ilimitada.
