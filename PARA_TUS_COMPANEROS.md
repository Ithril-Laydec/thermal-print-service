# 👥 PARA TUS COMPAÑEROS DE EQUIPO

## 🚀 **SOLO NECESITAN HACER ESTO:**

```bash
cd thermal-print-service
npm install
bun start
```

**¡ESO ES TODO!**

## ✅ **Lo que pasa automáticamente:**

1. 🔍 **Detecta** si ya hay impresoras configuradas
2. 🛠️  **Corrige** configuraciones incorrectas (PostScript → RAW)
3. 📦 **Instala** CUPS y dependencias si faltan
4. 🖨️  **Configura** impresoras térmicas "ALBARAN" y "Albaranes"
5. 👥 **Configura** permisos de usuario
6. 🔄 **Reinicia** servicios cuando es necesario
7. ⚡ **Optimiza** método de impresión (usa el más rápido)
8. 🔤 **Convierte** caracteres especiales (€→EUR, á→a, ñ→n)
9. 🚀 **Inicia** servidor de impresión

## 📱 **Desde la aplicación Vue:**

1. Ir a cualquier albarán
2. Clic en "Imprimir ticket"
3. Seleccionar "Térmica"
4. Clic en "Imprimir"

**¡Funciona inmediatamente!**

## 🔧 **Si hay algún problema:**

```bash
# Para reiniciar el servicio:
Ctrl+C
bun start

# Para verificar estado:
npm run check
```

## 🎯 **Compatible con:**

- ✅ Ubuntu/Linux (automático)
- ✅ Windows (automático)
- ✅ Cualquier impresora térmica ESC/POS
- ✅ Conexión USB

## ⚠️ **Nota importante:**

El servicio puede pedir `sudo` la primera vez para instalar/configurar CUPS. Es normal y necesario.

---

**¿Problemas?** El sistema corrige automáticamente casi todo. Solo asegúrate de que la impresora esté conectada por USB y encendida.