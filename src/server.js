const express = require('express')
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const { execFile } = require('child_process')
const {
	printRaw,
	printPickup,
	printLabels,
} = require('./controllers/printController')
const { PORT, HOST } = require('./config/config')

// Keepalive: en Windows, previene que el OS page-out el proceso y el print spooler
// tras períodos de inactividad (causa raíz del "hay que pulsar dos veces")
if (process.platform === 'win32') {
	const KEEPALIVE_INTERVAL = 5 * 60 * 1000 // 5 minutos
	const rawPrintExe = path.join(
		__dirname,
		'..',
		'installers',
		'bin',
		'RawPrint.exe',
	)

	setInterval(() => {
		// Warmup 1: Mantener RawPrint.exe en caché del OS (llamada sin impresora = falla rápido pero carga el .exe)
		execFile(
			rawPrintExe,
			[],
			{ timeout: 3000, windowsHide: true },
			() => {},
		)
		// Warmup 2: Mantener wmic accesible para búsqueda de impresoras
		execFile(
			'wmic',
			['printer', 'get', 'name'],
			{ timeout: 5000, windowsHide: true },
			() => {},
		)
		console.log(`🔄 Keepalive: warm-up ejecutado`)
	}, KEEPALIVE_INTERVAL)

	console.log(
		`⏰ Keepalive configurado: cada ${KEEPALIVE_INTERVAL / 60000} min`,
	)
}

const app = express()

// Middleware
app.use(cors())
app.options('*', cors()) // Habilitar preflight para todas las rutas
app.use(express.json())
app.post(
	'/print-thermal',
	express.raw({ type: '*/*', limit: '10mb' }),
	printRaw,
)
app.post(
	'/print-pickup',
	express.raw({ type: '*/*', limit: '10mb' }),
	printPickup,
)
app.post(
	'/print-labels',
	express.raw({ type: '*/*', limit: '10mb' }),
	printLabels,
)

// Health check
app.get('/health', (req, res) => {
	res.json({ status: 'ok' })
})

// Version endpoint
app.get('/version', (req, res) => {
	const packageJson = require('../package.json')
	res.json({
		version: packageJson.version,
		name: packageJson.name,
		https: !!credentials,
		protocol: credentials ? 'https' : 'http',
	})
})

// Función para buscar certificados.
//
// Prioridad 1 — variables de entorno CERT_FILE / KEY_FILE:
//   Usadas por el modo servidor (--server --domain <fqdn>) para apuntar
//   a los certificados Let's Encrypt instalados por acme.sh en
//   /opt/thermal-print-service/certs/<fqdn>.{pem,key}.
//   El unit systemd las exporta cuando se instala con --domain.
//
// Prioridad 2 — certificados mkcert localhost (modo cliente / desarrollo):
//   Busca localhost+2.pem / localhost+2-key.pem en el directorio raíz del
//   proyecto, exactamente como antes. Este comportamiento NO cambia.
//
// Si ninguno existe, el servidor arranca en HTTP (fallback ya existente).
function findCertificates() {
	// Priority 1: explicit cert paths via env vars (server mode / Let's Encrypt)
	const envCert = process.env.CERT_FILE
	const envKey = process.env.KEY_FILE
	if (envCert && envKey) {
		if (fs.existsSync(envCert) && fs.existsSync(envKey)) {
			return {
				cert: fs.readFileSync(envCert),
				key: fs.readFileSync(envKey),
			}
		}
		// Vars set but files missing: warn and fall through to mkcert lookup
		console.warn(
			`⚠️  CERT_FILE/KEY_FILE definidos pero no encontrados: ${envCert}, ${envKey}`,
		)
	}

	// Priority 2: mkcert localhost certs (client mode / local dev)
	const cert = path.join(__dirname, '..', 'localhost+2.pem')
	const key = path.join(__dirname, '..', 'localhost+2-key.pem')

	if (fs.existsSync(cert) && fs.existsSync(key)) {
		return {
			cert: fs.readFileSync(cert),
			key: fs.readFileSync(key),
		}
	}

	return null
}

// Iniciar servidor (HTTPS si hay certificados, HTTP si no)
const credentials = findCertificates()

if (credentials) {
	// Servidor HTTPS
	const httpsServer = https.createServer(credentials, app)
	httpsServer.listen(PORT, HOST, () => {
		console.log('🖨️  Servicio de impresión térmica')
		console.log(`🔒 https://${HOST}:${PORT}`)
		console.log('POST /print-thermal - Imprime buffer ESC/POS (térmica)')
		console.log('POST /print-pickup  - Imprime en diplodocus (matricial)')
		console.log('POST /print-labels  - Imprime etiquetas SBPL (SATO)')
		console.log('GET  /health        - Health check')
		console.log('GET  /version       - Versión del servicio')
		console.log('✅ Certificados SSL cargados correctamente')
	})
} else {
	// Fallback a HTTP
	const httpServer = http.createServer(app)
	httpServer.listen(PORT, HOST, () => {
		console.log('🖨️  Servicio de impresión térmica')
		console.log(`📡 http://${HOST}:${PORT}`)
		console.log('POST /print-thermal - Imprime buffer ESC/POS (térmica)')
		console.log('POST /print-pickup  - Imprime en diplodocus (matricial)')
		console.log('POST /print-labels  - Imprime etiquetas SBPL (SATO)')
		console.log('GET  /health        - Health check')
		console.log('GET  /version       - Versión del servicio')
		console.log('⚠️  Sin certificados SSL - ejecutando en HTTP')
		console.log(
			'💡 Para HTTPS, genera certificados con: mkcert localhost 127.0.0.1 ::1',
		)
	})
}
