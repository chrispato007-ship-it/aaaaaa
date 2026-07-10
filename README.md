# Phadiscon LOVE 💖

Aplicación privada para parejas que sincroniza el ciclo menstrual, estados de ánimo, mensajes de amor, cupones y fotos instantáneas de 24 horas en tiempo real.

## 🚀 Cómo ejecutar en Replit

Esta aplicación ya está configurada para funcionar de inmediato en **Replit**.

1. **Importar el proyecto**: Sube este directorio a un Repl de Node.js (TypeScript/React).
2. **Instalar dependencias**: Replit instalará automáticamente los paquetes, pero puedes forzarlo ejecutando `npm install` en la pestaña de la consola.
3. **Iniciar el Servidor**: Haz clic en el botón grande de **Run** en la parte superior. El archivo de configuración `.replit` arrancará el servidor de desarrollo en el puerto `3000` y abrirá la previsualización web.

## 📱 Configuración para Android Studio (Capacitor)

El proyecto incluye soporte para compilarse como aplicación nativa de Android usando **Capacitor**.

1. Construye los activos web:
   ```bash
   npm run build
   ```
2. Sincroniza los archivos con la carpeta nativa de Android:
   ```bash
   npx cap sync
   ```
3. Abre el proyecto en Android Studio:
   ```bash
   npx cap open android
   ```

---
Creado con cariño para Antonia. 💕
