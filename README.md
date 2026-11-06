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

⭐ **UN SOLO COMANDO que lo instala TODO** (incluyendo Bun, certificados SSL y el servicio):

### Linux (Ubuntu/Debian) — tres modos

#### Modo cliente (por defecto)

Instala el servicio escuchando en `localhost` con certificado mkcert.
Ideal para PCs con impresora térmica USB local.

```bash
curl -fsSL https://github.com/Ithril-Laydec/thermal-print-service/raw/master/installers/install.sh | bash
```

✨ Qué hace:
- ✅ Instala Bun y mkcert
- ✅ Configura CA local y genera certificados SSL para localhost
- ✅ Descarga e instala el servicio (HOST=localhost)
- ✅ Lo configura como servicio systemd y lo inicia

#### Modo servidor (`--server`)

Instala el servicio escuchando en todas las interfaces (`0.0.0.0`).
Ideal para un servidor Linux con impresoras físicas accesible desde la LAN.

```bash
curl -fsSL https://github.com/Ithril-Laydec/thermal-print-service/raw/master/installers/install.sh | bash -s -- --server
```

Si ya tienes un certificado emitido para el dominio (ver modo siguiente), pásalo con `--domain`:

```bash
curl -fsSL .../install.sh | bash -s -- --server --domain print.tu-dominio.com
```

✨ Qué hace adicionalmente:
- ✅ HOST=0.0.0.0 en el unit systemd
- ✅ Mantiene CUPS solo para la HP (`hp://`): enmascara `cups-browsed` y `cups.path`,
  elimina toda cola `usb://` y desactiva la autoconfiguración de `system-config-printer-udev`
  (override vacío en `/etc/udev/rules.d/70-printers.rules` y `configure-printer@.service`
  enmascarado). Esa autoconfiguración creaba colas `usb://` en cada arranque e imprimía una
  página de prueba que desvinculaba `usblp` de la matricial EPSON, haciendo desaparecer
  `/dev/printer/diplodocus` hasta reconectar el USB
- ✅ Reengancha `usblp` en las interfaces de impresora USB que hayan quedado sin driver y
  verifica al final que no quedan colas `usb://` y que existen los enlaces `/dev/printer/*`
- ✅ Asegura el módulo `usblp` (cargado y persistente en `/etc/modules-load.d/`)
- ✅ Instala `curl` si no está presente
- ✅ Configura UFW: detecta el puerto real de sshd (no asume 22) y lo permite antes de habilitar
  el firewall, evitando cortes en puertos no estándar; luego abre el 20936 desde la subred LAN
- ✅ Crea `/etc/sudoers.d/thermal-print-reload` con permiso NOPASSWD acotado a
  `systemctl restart thermal-print` para el usuario del servicio, validado con `visudo -cf`
- ✅ Si se pasa `--domain`, exporta `CERT_FILE`/`KEY_FILE` en el unit apuntando a
  `/opt/thermal-print-service/certs/<fqdn>.{pem,key}`

#### Modo servidor + emitir certificado (`--server --issue-cert`)

Emite un certificado Let's Encrypt vía DNS-01 con deSEC y lo configura automáticamente.

```bash
curl -fsSL .../install.sh | bash -s -- \
  --server \
  --issue-cert \
  --domain print.tu-dominio.com \
  --dedyn-token TU_TOKEN_DESEC
```

✨ Qué hace adicionalmente:
- ✅ Valida el token deSEC **antes** de tocar nada (distingue error de red de token inválido)
- ✅ Instala `acme.sh` si no está presente y emite el certificado (`--keylength ec-256`) **antes**
  de parar el servicio ni hacer backup — si `--issue` falla (propagación DNS, red), el script
  aborta limpiamente sin haber detenido el servicio en ningún momento
- ✅ Instala el certificado en `/opt/thermal-print-service/certs/<fqdn>.{pem,key}` una vez que
  los archivos del proyecto están en su lugar
- ✅ Configura renovación automática con `--reloadcmd "sudo systemctl restart thermal-print"`
  (funciona sin contraseña gracias a la regla sudoers creada en modo servidor)
- ✅ El unit systemd exporta `CERT_FILE`/`KEY_FILE` apuntando a esas rutas

> **Nota**: `DEDYN_TOKEN` es la variable que usa el plugin `dns_desec` de acme.sh.
> Obtén tu token en https://desec.io → Cuenta → Token API.

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
- ✅ Optimiza el sistema para impresión confiable (desactiva USB suspend, configura print spooler, reduce paginación)
- ✅ Lo inicia automáticamente

🔄 **Actualización**: El mismo comando detecta si ya está instalado y lo actualiza (idempotente).

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
    térmica y diplodocus: execFile → RawPrint.exe "cola" buffer.bin (async, sin cmd.exe)
    ↓
Impresora Windows (albaran, diplodocus)
```

**Velocidad primero, reparación en segundo plano.** El ticket se envía directo
a la cola y el servicio responde en cuanto el spooler lo acepta. Nada en el
camino de impresión espera a PowerShell, a la búsqueda USB ni a la impresión
física. Después de cada impresión (vaya bien o mal), al arrancar y cada 5
minutos, `installers/bin/print-thermal.ps1` repara la cola `albaran` en segundo
plano. Las pasadas nunca se solapan y las peticiones seguidas se agrupan:

1. Identifica la térmica por el VID/PID USB del dispositivo padre (lista
   blanca: `0483:5743` y `0FE6:811E`), nunca por número de puerto, así que
   nunca reasigna la cola a la HP ni a la EPSON.
2. Si la cola no existe la crea (`Generic / Text Only`). Si apunta a otro
   puerto (la térmica se ha cambiado de toma USB) o está en "Usar impresora sin
   conexión", elimina los trabajos retenidos (nunca se imprimieron y saldrían
   todos de golpe) y la corrige. Si ya está bien, no toca nada.
3. 65 s después de una impresión elimina los trabajos que llevan más de 60 s en
   cola (sin papel, tapa abierta, apagada) para que no salgan más tarde.

Consecuencia aceptada: tras cambiar la térmica de toma, el primer ticket se
pierde y el segundo clic ya imprime.

El servicio corre como `LocalSystem` porque `NetworkService` no puede cambiar el
puerto de una cola ni eliminar trabajos.

**SATO (todas las plataformas):** los trabajos se envían de uno en uno, en
orden, por TCP. Con la cola libre, `/print-labels` responde en cuanto abre la
conexión (si la SATO no es accesible, sigue devolviendo error). Si hay un envío
en curso, el trabajo queda en cola y responde al momento. Los fallos posteriores
solo quedan en el log.

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

IP dinámica: localízala por NetBIOS (`JESUS`) y conecta con usuario explícito:

```bash
ssh -l "jesús" <ip>
```

## Licencia

MIT
