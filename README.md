# Servicio de Impresión Térmica Multiplataforma

## ⚡ **INSTALACIÓN ULTRA-RÁPIDA**

```bash
cd thermal-print-service
npm install
bun start
```

**¡Y LISTO!** - Automáticamente instala todo lo necesario

## ✅ **LO QUE HACE AUTOMÁTICAMENTE:**

- 🔍 **Detecta tu OS** (Ubuntu/Windows/macOS)
- 📦 **Instala CUPS** (Linux) o drivers genéricos (Windows)
- 🖨️  **Configura impresoras** "ALBARAN" y "Albaranes" como RAW
- 🛠️  **Corrige configuraciones incorrectas** (PostScript → RAW)
- 🔌 **Detecta impresora USB** conectada
- 🚀 **Inicia servidor** HTTP en puerto 20936
- 🎯 **Integración Vue** ya funcionando
- 🔄 **Reinicia servicios** cuando es necesario
- ⚡ **Optimización inteligente** - usa el método más rápido primero
- 💰 **Caracteres especiales MEJORADOS** - 3 métodos automáticos:
  - 🥇 CP850 Europa (€ y tildes nativos)
  - 🥈 UTF-8 directo
  - 🥉 Conversión fallback (€→EUR, á→a)

## 🎯 **CERO CONFIGURACIÓN MANUAL**

### Antes (complejo):
1. Instalar CUPS
2. Configurar drivers
3. Crear impresoras
4. Configurar permisos
5. Detectar dispositivos
6. Iniciar servidor

### Ahora (simple):
1. `bun start`

## 🔧 **Uso desde Vue App (YA INTEGRADO)**

Tu `TicketPrintDialog.vue` ya está configurado - solo selecciona "Térmica" y funciona.

```javascript
// POST http://localhost:20936/print/ticket
{
  "text": "TICKET PRUEBA\nRef: ALB001\nTotal: 25.50€"
}
```

## 📦 **Stack Tecnológico**

- `express`: Servidor HTTP
- `node-thermal-printer`: Driver ESC/POS
- `cors`: CORS para peticiones web
- `auto-setup.js`: Configuración automática de drivers

## ⚙️ **Compatible con:**

- ✅ **Windows 10/11** - Drivers genéricos automáticos
- ✅ **Ubuntu 20.04+** - CUPS automático
- ✅ **macOS** - Guía manual incluida
- ✅ **Impresoras ESC/POS** (80mm, 58mm)
- ✅ **USB y Red**

## 🎛️ **Endpoints Disponibles**

- `POST /print/ticket` - Imprimir ticket
- `GET /health` - Estado del servicio
- `GET /printers` - Impresoras detectadas
- `GET /diagnostics` - Diagnóstico completo

## 🔧 **Comandos Útiles**

```bash
bun start               # Todo automático (optimizado)
npm run test-print      # Probar impresión básica
npm run test-chars      # Probar caracteres especiales (€, á, ñ, etc.)
npm run test-euro       # Test específico € y tildes (3 métodos automáticos)
npm run test-comparativo # 🆚 COMPARAR librerías (@node-escpos vs lpr) - 3 impresiones
npm run check           # Verificar instalación
```

## 🏗️ **Arquitectura**

```
┌─────────────────┐    HTTP     ┌──────────────────┐    ESC/POS    ┌─────────────────┐
│   Vue App       │────────────▶│  Thermal Service │──────────────▶│  Thermal Printer│
│ TicketPrintDialog│             │   (Port 20936)   │               │   (USB/Network) │
└─────────────────┘             └──────────────────┘               └─────────────────┘
                                         │
                                         ▼
                                ┌──────────────────┐
                                │   AutoSetup      │
                                │ • Detect OS      │
                                │ • Install CUPS   │
                                │ • Config Printers│
                                └──────────────────┘
```

## 🚀 **Status: PRODUCCIÓN LISTO**

- ✅ **MVP Completo** - Funciona inmediatamente
- ✅ **Auto-instalación** - Sin configuración manual
- ✅ **Integración Vue** - Frontend conectado
- ✅ **Multiplataforma** - Windows, Ubuntu, macOS
- ✅ **Error Handling** - Diagnóstico automático

## 🎉 **¡3 pasos para imprimir!**

1. **Conecta** impresora USB
2. **Ejecuta** `bun start`
3. **Usa** tu aplicación Vue

**¡Funciona en cualquier OS sin configuración!**

---

## 🤖 **PARA TUS COMPAÑEROS:**

**Solo necesitan ejecutar `bun start` - todo lo demás es automático:**

- ✅ Corrige automáticamente impresoras mal configuradas
- ✅ Instala drivers necesarios automáticamente
- ✅ Configura permisos automáticamente
- ✅ Reinicia servicios automáticamente
- ✅ Sin comandos manuales
- ✅ Sin configuración técnica

**Ve el archivo `PARA_TUS_COMPANEROS.md` para instrucciones simples**