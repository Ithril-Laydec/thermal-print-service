const express = require('express')
const cors = require('cors')

// Controllers
const { getHealth, getVersion } = require('./controllers/healthController')
const { getStatus, setServiceStartTime } = require('./controllers/statusController')
const { printTicket } = require('./controllers/printController')
const { getPrinters, getDiagnostics } = require('./controllers/printerController')

// Configuration
const { PORT, HOST } = require('./config/config')

const app = express()

// Set service start time
setServiceStartTime(Date.now())

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.get('/health', getHealth)
app.get('/version', getVersion)
app.get('/status', getStatus)
app.post('/print/ticket', printTicket)
app.get('/printers', getPrinters)
app.get('/diagnostics', getDiagnostics)

module.exports = { app, PORT, HOST }