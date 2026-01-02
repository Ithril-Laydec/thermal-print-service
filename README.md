# Thermal Print Service

Servicio minimalista para impresión térmica ESC/POS con soporte HTTPS.

## Características

- ✅ Impresión térmica directa (ESC/POS)
- 🔒 Soporte HTTPS con certificados locales
- 🚀 Detección automática de impresoras
- 📦 Instalación en un solo comando
- 🔄 Fallback automático HTTP/HTTPS

## Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST   | `/print-thermal` | Imprime buffer binario ESC/POS (térmica) |
| POST   | `/print-pickup` | Imprime buffer binario ESC/P2 en diplodocus (matricial) |
| GET    | `/health` | Health check del servicio |
| GET    | `/version` | Versión del servicio y protocolo |

### Impresoras soportadas

| Impresora | Endpoint | Protocolo | Ubicación |
|-----------|----------|-----------|-----------|
| albaran (térmica) | `/print-thermal` | ESC/POS | USB local |
| diplodocus (EPSON LQ-590) | `/print-pickup` | ESC/P2 | Windows de Jesús |

### Diferencia ESC/POS vs ESC/P2

- **ESC/POS**: Protocolo para impresoras térmicas de tickets (comandos como `1B 40` reset, `1D 56` corte)
- **ESC/P2**: Protocolo para impresoras matriciales EPSON (comandos similares pero incompatibles)

El frontend genera el buffer con el protocolo correcto según el endpoint.

## Instalación

⭐ **UN SOLO COMANDO que lo instala TODO** (incluyendo Bun, mkcert, certificados SSL y el servicio):

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://github.com/Ithril-Laydec/thermal-print-service/raw/master/installers/install.sh | bash
```

### Windows (PowerShell como Administrador)

```powershell
irm https://github.com/Ithril-Laydec/thermal-print-service/raw/master/installers/install.ps1 | iex
```

✨ **Qué hace automáticamente:**
- ✅ Instala Bun (si no está instalado)
- ✅ Instala mkcert (para certificados HTTPS)
- ✅ Configura la Certificate Authority local
- ✅ Genera certificados SSL para localhost
- ✅ Descarga e instala el servicio
- ✅ Lo configura como servicio del sistema
- ✅ Lo inicia automáticamente

🔄 **Actualización**: El mismo comando detecta si ya está instalado y lo actualiza, regenerando los certificados si es necesario.

## Desarrollo Local con HTTPS

Para desarrollar con HTTPS localmente:

### 1. Instalar mkcert

**Ubuntu/Linux:**
```bash
# Instalar mkcert
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert

# Instalar CA local (una sola vez)
mkcert -install
```

**Windows (PowerShell como Administrador):**
```powershell
# Con Chocolatey
choco install mkcert

# O descargar directamente
# https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe
# Renombrar a mkcert.exe y mover a C:\Windows\System32\

# Instalar CA local (una sola vez)
mkcert -install
```

### 2. Generar certificados

```bash
# En el directorio del proyecto
cd thermal-print-service
mkcert localhost 127.0.0.1 ::1
```

Esto generará:
- `localhost+2.pem` (certificado)
- `localhost+2-key.pem` (clave privada)

### 3. Iniciar el servicio

```bash
bun start
```

El servicio detectará automáticamente los certificados y correrá en HTTPS:
```
🖨️  Servicio de impresión térmica
🔒 https://localhost:20936
✅ Certificados SSL cargados correctamente
```

Sin certificados, corre en HTTP:
```
🖨️  Servicio de impresión térmica
📡 http://localhost:20936
⚠️  Sin certificados SSL - ejecutando en HTTP
💡 Para HTTPS, genera certificados con: mkcert localhost 127.0.0.1 ::1
```

## Configuración del Frontend (Vue)

El frontend también necesita certificados para HTTPS. Genera los certificados en el directorio del proyecto:

```bash
# En el directorio raíz del proyecto o en vue/
mkcert localhost 127.0.0.1 ::1
```

Vite detectará automáticamente los certificados y correrá en `https://localhost:5173`

## Scripts

```bash
bun start          # Iniciar servicio
bun run dev        # Desarrollo con auto-reload
```

## Estructura del Proyecto

```
thermal-print-service/
├── src/
│   ├── config/
│   │   └── config.js              # Configuración (puerto, host)
│   ├── controllers/
│   │   └── printController.js     # Endpoint /print
│   ├── services/
│   │   └── RawEscposService.js    # Escritura directa a /dev/usb/lp0
│   └── server.js                   # Servidor Express con HTTPS
├── installers/                     # Scripts de instalación
├── localhost+2.pem                 # Certificado SSL (generado)
├── localhost+2-key.pem             # Clave privada (generada)
└── package.json
```

## Arquitectura

### Linux
```
Frontend (Vue HTTPS)
    ↓
    POST /print-thermal (buffer ESC/POS)
    ↓
Thermal Print Service (Express + HTTPS)
    ↓
/dev/usb/lp0 (Impresora Térmica)
```

### Windows
```
Frontend (Vue HTTPS)
    ↓
    POST /print-thermal o /print-pickup (buffer binario)
    ↓
Thermal Print Service (Express + HTTPS)
    ↓
    RawPrint.exe "nombre_impresora" buffer.bin
    ↓
Impresora Windows (albaran, diplodocus, etc.)
```

**Por qué RawPrint.exe:** Windows no permite escribir directamente a dispositivos USB. RawPrint.exe usa la API nativa `winspool.drv` para enviar datos RAW a cualquier impresora compartida.

## Solución de Problemas

### El servicio no arranca en HTTPS

1. Verifica que los certificados existan:
   ```bash
   ls localhost+2*.pem
   ```

2. Regenera los certificados:
   ```bash
   mkcert localhost 127.0.0.1 ::1
   ```

### Warnings de certificado en el navegador

1. Verifica que mkcert esté instalado correctamente:
   ```bash
   mkcert -install
   ```

2. Reinicia el navegador completamente

### Permisos de impresora (Linux)

```bash
# Añadir usuario al grupo lp
sudo usermod -a -G lp $USER

# Configurar permisos del dispositivo
sudo chmod 666 /dev/usb/lp0
```

### Windows: "No se encontró impresora SATO" (ETIMEDOUT)

**Síntoma**: El servicio no encuentra impresoras aunque están instaladas. Log muestra:
```
Error buscando impresoras: spawnSync cmd.exe ETIMEDOUT
```

**Causa**: El servicio corre como `LocalSystem`. PowerShell `Get-Printer` puede hacer timeout cuando se ejecuta desde este contexto.

**Solución**: El código usa `wmic printer get name` en lugar de PowerShell. Si ves este error, actualiza el servicio:
```powershell
irm https://github.com/Ithril-Laydec/thermal-print-service/raw/master/installers/install.ps1 | iex
```

### Windows: Primera petición falla, al recargar funciona (no confirmado)

**Síntoma**: La primera impresión desde el navegador falla silenciosamente, pero al recargar la página funciona.

**Causa probable (no confirmada)**: El navegador podría bloquear la primera petición HTTPS al certificado auto-firmado hasta que el usuario lo acepta.

**Posible solución**: Asegurarse de que el CA local de mkcert está instalado en el sistema:
```powershell
mkcert -install
```
Y reiniciar el navegador completamente.

## Conexiones Remotas (SSH)

### Oficina - Windows de Jesús

```bash
ssh Usuario@192.168.0.17
```

## Licencia

MIT
