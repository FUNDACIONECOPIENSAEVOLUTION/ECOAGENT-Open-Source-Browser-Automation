# ECOAGENT Direct para el Chrome habitual

La extensión usa el perfil de Chrome en el que el usuario la instala. No crea perfiles nuevos ni copia el administrador de contraseñas. Chrome gestiona el inicio de sesión y la persistencia según su configuración. Si tiene varios perfiles de Chrome, instale la extensión únicamente en el que desea usar.

## Instalación sin Node
1. Descargue o clone el repositorio.
2. Abra chrome://extensions y active Modo desarrollador.
3. Pulse Cargar descomprimida y seleccione la carpeta extension.
4. Abra una página normal, inicie sesión manualmente y pulse el icono ECOAGENT.
5. Inspeccione la pestaña, diligencie o autorice clics. Si navega a otra página, vuelva a inspeccionar.

## Privacidad
Permisos mínimos activeTab y scripting. Sin permisos de cookies, historial, contraseñas, almacenamiento ni acceso permanente a todos los sitios. No se envían datos a un servidor. No se devuelve el valor de campos; las etiquetas pueden contener datos personales. Se bloquean formularios con campos de contraseña o códigos detectados por heurística, no toda posible autenticación. No autorice acciones sobre páginas sospechosas. No es una auditoría de seguridad.

## Estado
Prototipo de extensión v0.3.0. Opera la pestaña activa y el DOM principal, no iframes ni shadow DOM. El lote JSON se ejecuta en el popup y necesita confirmación por acción de escritura/clic. No hay puente remoto, tareas de fondo ni acceso directo de ChatGPT. Cerrar el popup puede interrumpir el lote. El motor Node previo sigue disponible como modo alternativo, con perfil dedicado. Pendiente probar en Chrome real.
