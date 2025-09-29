const packageJson = require('../../package.json')
const { getSystemInfo, detectThermalPrinters, getConfiguredPrinters } = require('../utils/system')
const { checkForUpdates } = require('../utils/update-checker')

let serviceStartTime = Date.now()

/**
 * Set service start time
 */
function setServiceStartTime(startTime) {
  serviceStartTime = startTime
}

/**
 * Complete status endpoint with system information
 */
async function getStatus(req, res) {
  try {
    const uptime = Math.floor((Date.now() - serviceStartTime) / 1000)
    const systemInfo = getSystemInfo()
    const detection = await detectThermalPrinters()
    const printersConfigured = await getConfiguredPrinters()

    // Check for updates (cached, non-blocking)
    const updateInfo = await checkForUpdates()

    res.json({
      version: packageJson.version,
      updateInfo: updateInfo,
      uptime: uptime,
      platform: systemInfo.platform,
      arch: systemInfo.arch,
      nodeVersion: systemInfo.nodeVersion,
      memory: {
        total: systemInfo.totalMemory,
        free: systemInfo.freeMemory,
        used: systemInfo.usedMemory
      },
      printers: {
        configured: printersConfigured,
        detection: detection
      },
      health: 'ok',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      error: 'Error getting status',
      details: error.message
    })
  }
}

module.exports = {
  getStatus,
  setServiceStartTime
}