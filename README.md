# Thermal Print Service

Servicio minimalista para impresión térmica ESC/POS con soporte HTTPS.

## Características

- ✅ Impresión térmica directa (ESC/POS)
- 🔒 Soporte HTTPS con certificados locales
- 🚀 Detección automática de impresoras
- 📦 Instalación en un solo comando
- 🔄 Fallback automático HTTP/HTTPS

## Endpoints

| Método | Endpoint         | Descripción                                             |
| ------ | ---------------- | ------------------------------------------------------- |
| POST   | `/print-thermal` | Imprime buffer binario ESC/POS (térmica)                |
| POST   | `/print-pickup`  | Imprime buffer binario ESC/P2 en diplodocus (matricial) |
| POST   | `/print-labels`  | Imprime etiquetas SBPL en SATO WS412                    |
| GET    | `/health`        | Health check del servicio                               |
| GET    | `/version`       | Versión del servicio y protocolo                        |

### Impresoras soportadas

| Impresora                 | Endpoint         | Protocolo | Ubicación        |
| ------------------------- | ---------------- | --------- | ---------------- |
| albaran (térmica)         | `/print-thermal` | ESC/POS   | USB local        |
| diplodocus (EPSON LQ-590) | `/print-pickup`  | ESC/P2    | Windows de Jesús |
| SATO WS412 (etiquetas)    | `/print-labels`  | SBPL      | USB local        |

### Protocolos de impresión

- **ESC/POS**: Protocolo para impresoras térmicas de tickets (comandos como `1B 40` reset, `1D 56` corte)
- **ESC/P2**: Protocolo para impresoras matriciales EPSON (comandos similares pero incompatibles con ESC/POS)
- **SBPL**: SATO Barcode Printer Language para etiquetas (comandos como `A` origen, `H` calor, `Q` cantidad)

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
- ✅ **[Windows]** Optimiza el sistema para impresión confiable (desactiva USB suspend, configura print spooler, reduce paginación)
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
    POST /print-thermal, /print-pickup o /print-labels (buffer binario)
    ↓
Thermal Print Service (Express + HTTPS + Keepalive)
    ↓
    execFile → RawPrint.exe "nombre_impresora" buffer.bin (async, sin cmd.exe)
    ↓
Impresora Windows (albaran, diplodocus, SATO WS412, etc.)
```

**Por qué RawPrint.exe:** Windows no permite escribir directamente a dispositivos USB. RawPrint.exe usa la API nativa `winspool.drv` para enviar datos RAW a cualquier impresora compartida.

**Por qué execFile async en lugar de execSync:** `execSync` lanza `cmd.exe` como intermediario, que tras idle puede quedar paginado en disco y hacer timeout. `execFile` invoca RawPrint.exe directamente sin cmd.exe. Al ser async, no bloquea el event loop durante la impresión, permitiendo concurrencia real.

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

### Windows: Primera impresión tras idle hace timeout (hay que pulsar dos veces)

**Síntoma**: Tras varios minutos sin imprimir, la primera impresión falla con ETIMEDOUT. La segunda funciona. Log muestra:

```
Error imprimiendo en Windows: spawnSync C:\WINDOWS\system32\cmd.exe ETIMEDOUT
```

**Causa raíz**: `execSync` ejecuta comandos en Windows lanzando `cmd.exe /d /s /c "RawPrint.exe ..."`. Tras idle, Windows pagina procesos en memoria. Al invocar `execSync`, cmd.exe debe cargarse desde disco y hace timeout (30s). La segunda llamada funciona porque cmd.exe ya está en memoria. Además, `execSync` es bloqueante: durante el timeout, todo el event loop de Node.js/Bun queda congelado.

**Soluciones implementadas**:

1. **`execFile` async en lugar de `execSync`**: Invoca `RawPrint.exe` directamente sin pasar por cmd.exe, evitando el overhead de arranque tras idle. Al ser async, no bloquea el event loop.
2. **Retry automático**: 2 intentos con 1s de delay — si el primer intento falla por timeout (proceso paginado), el segundo normalmente funciona porque el proceso ya está caliente.
3. **Keepalive timer** (cada 5 min): Ejecuta warm-up de `RawPrint.exe` y `wmic` periódicamente para mantenerlos en memoria, evitando paginación tras idle prolongado.
4. **Optimizaciones del sistema** (install.ps1): Desactiva USB Selective Suspend, asegura Print Spooler en Automatic, y deshabilita paginación de ejecutables del sistema (`DisablePagingExecutive`).

**Por qué estas soluciones**:

- **Sin cmd.exe**: Reduce superficie de paginación (un ejecutable menos en la cadena de llamadas)
- **Async**: Libera el event loop — otras peticiones concurrentes no se bloquean
- **Retry**: Failsafe ante procesos paginados sin agregar latencia constante
- **Keepalive**: Prevención activa — impide que Windows pagine los ejecutables críticos
- **Optimizaciones de sistema**: Reduce agresividad de paginación de Windows en idle

Si experimentas este problema, actualiza el servicio:

```powershell
irm https://github.com/Ithril-Laydec/thermal-print-service/raw/master/installers/install.ps1 | iex
```

## Conexiones Remotas (SSH)

### Oficina - Windows de Jesús

```bash
ssh Usuario@192.168.0.17
```

## Licencia

MIT
