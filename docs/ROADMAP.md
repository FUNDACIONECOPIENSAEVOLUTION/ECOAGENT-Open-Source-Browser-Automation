# Plan de finalización

1. v0.1: API local, panel, inspección DOM compacta, perfiles, clic/fill/select, capturas. Validar en Windows con formulario de prueba y sesiones legítimas.
2. v0.2: referencias semánticas robustas, manejo de diálogos, pestañas, checkbox, carga/descarga desde directorio autorizado, evidencia y confirmación local vinculada al origen/acción, cancelación.
3. v0.3: agente local Ollama opcional, planificador JSON, límites de pasos/tiempo, detección de bucles, filtrado de datos sensibles antes de enviarlos al modelo, defensa ante instrucciones maliciosas de páginas. Sin ejecución arbitraria de código.
4. v0.4: cola persistente SQLite, tareas programadas locales, plantillas de formularios, expedientes privados, deduplicación de postulaciones y comprobantes reales. Separar perfil institucional y personal.
5. v0.5: cliente API para integraciones autorizadas, canal saliente autenticado opcional con revisión de seguridad; nunca publicar el puerto local ni credenciales. GitHub Pages sirve solo información pública.
6. v1.0: pruebas E2E, instalación portable Windows, auditoría de seguridad, licencia y dependencias revisadas, medición de coste y consumo de tokens frente a llamadas individuales.

Criterio ECOFUND: no contar borradores como radicados; comprobar elegibilidad y autorización, no enviar macroproyecto ni inventar datos. No automatizar CAPTCHA ni eludir restricciones.
