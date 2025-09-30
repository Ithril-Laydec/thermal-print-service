const express = require('express')
const cors = require('cors')

// Controllers
const { getHealth, getVersion } = require('./controllers/healthController')
const { getStatus, setServiceStartTime } = require('./controllers/statusController')
const { printTicket, printRaw } = require('./controllers/printController')
const { getPrinters, getDiagnostics, checkPrinterAvailability } = require('./controllers/printerController')

// Configuration
const { PORT, HOST } = require('./config/config')

const app = express()

// Set service start time
setServiceStartTime(Date.now())

// Middleware
app.use(cors())

// Route-specific middleware
app.post('/print/raw', express.raw({ type: '*/*', limit: '10mb' }), printRaw)
app.use(express.json())

// Routes
app.get('/health', getHealth)
app.get('/version', getVersion)
app.get('/status', getStatus)
app.post('/print/ticket', printTicket)
app.get('/printers', getPrinters)
app.get('/printer/check', checkPrinterAvailability)
app.get('/diagnostics', getDiagnostics)

module.exports = { app, PORT, HOST }