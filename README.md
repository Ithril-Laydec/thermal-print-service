# Servicio de Impresión Térmica Multiplataforma

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Ithril-Laydec/thermal-print-service)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Servicio local auto-instalable para impresión térmica ESC/POS con detección automática desde aplicaciones web.

## 🚀 **INSTALACIÓN CON UN CLICK**

### Para Usuarios Finales

1. Abre la aplicación web
2. Selecciona "Impresión Térmica"
3. Click en "Instalar Servicio" si no está instalado
4. Descarga y ejecuta el instalador para tu sistema
5. ¡Listo! El servicio se inicia automáticamente

### Instalación Manual

**Ubuntu/Linux:**
```bash
chmod +x installers/install-ubuntu.sh
./installers/install-ubuntu.sh
```

**Windows (PowerShell como Administrador):**
```powershell
.\installers\install-windows.ps1
```

## ⚡ **DESARROLLO LOCAL**

```bash
cd thermal-print-service
npm install
npm start
```

**¡Y LISTO!** - Automáticamente instala y configura todo lo necesario

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

### Impresión
- `POST /print/ticket` - Imprimir ticket

### Estado y Diagnóstico
- `GET /health` - Estado básico del servicio
- `GET /version` - Información de versión
- `GET /status` - Estado completo con diagnóstico
- `GET /printers` - Impresoras detectadas
- `GET /diagnostics` - Diagnóstico completo

### Ejemplos

```bash
# Verificar versión
curl http://localhost:20936/version

# Obtener estado completo
curl http://localhost:20936/status

# Imprimir ticket
curl -X POST http://localhost:20936/print/ticket \
  -H "Content-Type: application/json" \
  -d '{"text": "TICKET DE PRUEBA\nTotal: 25.50€"}'
```

## 🔧 **Comandos Útiles**

### Desarrollo
```bash
npm start               # Iniciar servicio (puerto 20936)
npm run test-print      # Probar impresión básica
npm run test-chars      # Probar caracteres especiales (€, á, ñ, etc.)
npm run check           # Verificar instalación
```

### Producción (Servicio Instalado)
```bash
# Ubuntu/Linux
sudo systemctl status thermal-print    # Ver estado
sudo systemctl restart thermal-print   # Reiniciar
sudo systemctl stop thermal-print      # Detener
sudo journalctl -u thermal-print -f    # Ver logs en tiempo real

# Windows (PowerShell como Admin)
Get-Service ThermalPrintService        # Ver estado
Restart-Service ThermalPrintService    # Reiniciar
Stop-Service ThermalPrintService       # Detener
```

### Actualización
```bash
# Ubuntu/Linux
./installers/update-service.sh

# Windows (PowerShell como Admin)
.\installers\update-service.ps1
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

## 🚀 **Características**

- ✅ **Instalación con 1 Click** - Desde la aplicación web
- ✅ **Auto-Start** - Se inicia con el sistema operativo
- ✅ **Auto-Actualización** - Detección automática de nuevas versiones
- ✅ **Detección Inteligente** - Frontend detecta si está instalado/actualizado
- ✅ **Multiplataforma** - Ubuntu, Windows (macOS en desarrollo)
- ✅ **Diagnóstico Completo** - Endpoints de estado y versión
- ✅ **Zero Config** - Configuración automática de impresoras
- ✅ **Caracteres Especiales** - Soporte completo para € y tildes
- ✅ **Múltiples Métodos** - Fallback automático si un método falla

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

## 📂 **Estructura del Proyecto**

```
thermal-print-service/
├── server.js                    # Servidor principal con endpoints
├── config.js                    # Configuración (puerto, host)
├── auto-setup.js                # Configuración automática de drivers
├── package.json                 # Dependencias y versión
├── installers/                  # Scripts de instalación
│   ├── install-ubuntu.sh        # Instalador Ubuntu/Debian
│   ├── install-windows.ps1      # Instalador Windows
│   ├── update-service.sh        # Actualizador Linux
│   └── update-service.ps1       # Actualizador Windows
├── systemd/                     # Archivos de servicio
│   └── thermal-print.service    # Servicio systemd para Linux
└── README.md                    # Este archivo
```

## 🔄 **Flujo de Trabajo Completo**

### 1. Usuario Final
1. Abre aplicación Vue → Selecciona impresión térmica
2. Ve indicador: 🔴 "Servicio no instalado"
3. Click en "Instalar Servicio"
4. Descarga instalador para su OS
5. Ejecuta instalador (un comando)
6. Servicio se instala y queda activo
7. Frontend detecta: 🟢 "Funcionando v1.0.0"
8. Usuario puede imprimir normalmente

### 2. Nueva Versión Disponible
1. Frontend detecta: 🟡 "Actualización disponible (v1.0.1)"
2. Usuario click en "Actualizar Servicio"
3. Descarga actualizador
4. Ejecuta actualizador (un comando)
5. Servicio se actualiza automáticamente
6. Frontend detecta: 🟢 "Funcionando v1.0.1"

### 3. Integración con Frontend Vue

```vue
<script setup>
import ThermalServiceStatus from '@/components/thermal-print/ThermalServiceStatus.vue'
import { useThermalPrintService } from '@/composables/useThermalPrintService'

const thermalService = useThermalPrintService()

// El composable detecta automáticamente:
// - Si está instalado
// - Si está corriendo
// - Versión instalada vs disponible
// - Estado del servicio
</script>

<template>
  <ThermalServiceStatus :inline="true" :show-details="true" />
</template>
```

## 📚 **Documentación Adicional**

- [DISTRIBUCION.md](./DISTRIBUCION.md) - Guía completa de distribución (GitHub o API)
- [PARA_TUS_COMPANEROS.md](./PARA_TUS_COMPANEROS.md) - Instrucciones simples para usuarios
- [INSTALACION.md](./INSTALACION.md) - Guía de instalación manual detallada

## 🐛 **Troubleshooting**

### Servicio no se inicia

**Ubuntu:**
```bash
sudo journalctl -u thermal-print -n 50
sudo systemctl status thermal-print
```

**Windows:**
```powershell
Get-Service ThermalPrintService
Get-EventLog -LogName Application -Source ThermalPrintService -Newest 20
```

### Puerto 20936 ya en uso

```bash
# Linux
sudo lsof -i :20936
sudo kill <PID>

# Windows
netstat -ano | findstr :20936
taskkill /PID <PID> /F
```

### Frontend no detecta servicio

1. Verifica que esté corriendo: `curl http://localhost:20936/health`
2. Verifica CORS: El servicio acepta peticiones desde cualquier origen
3. Verifica firewall: El puerto 20936 debe estar abierto localmente

## 🤝 **Contribuir**

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 **Licencia**

MIT License - Ver [LICENSE](LICENSE) para más detalles