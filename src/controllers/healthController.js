const packageJson = require('../../package.json')
const { getSystemInfo } = require('../utils/system')

/**
 * Health check endpoint
 */
function getHealth(req, res) {
  res.json({
    status: 'ok',
    service: 'thermal-print-service',
    port: process.env.PORT || 20936,
    timestamp: new Date().toISOString()
  })
}

/**
 * Version information endpoint
 */
function getVersion(req, res) {
  const systemInfo = getSystemInfo()

  res.json({
    version: packageJson.version,
    name: packageJson.name,
    description: packageJson.description,
    buildDate: new Date().toISOString(),
    platform: systemInfo.platform,
    arch: systemInfo.arch,
    nodeVersion: systemInfo.nodeVersion
  })
}

module.exports = {
  getHealth,
  getVersion
}