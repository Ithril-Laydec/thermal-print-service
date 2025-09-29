const https = require('https')
const packageJson = require('../../package.json')

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Ithril-Laydec/thermal-print-service/master/package.json'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

let cachedUpdateInfo = null
let lastCheck = null

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1
    if (parts1[i] < parts2[i]) return -1
  }
  return 0
}

/**
 * Fetch remote version from GitHub
 */
function fetchRemoteVersion() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'))
    }, 5000)

    https.get(GITHUB_RAW_URL, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        clearTimeout(timeout)
        try {
          const remotePackage = JSON.parse(data)
          resolve(remotePackage.version)
        } catch (error) {
          reject(new Error('Failed to parse remote package.json'))
        }
      })
    }).on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

/**
 * Check for updates with caching
 */
async function checkForUpdates(forceRefresh = false) {
  const now = Date.now()

  // Return cached result if still valid
  if (!forceRefresh && cachedUpdateInfo && lastCheck && (now - lastCheck) < CACHE_DURATION) {
    return cachedUpdateInfo
  }

  const currentVersion = packageJson.version

  try {
    const remoteVersion = await fetchRemoteVersion()
    const comparison = compareVersions(remoteVersion, currentVersion)

    const updateInfo = {
      currentVersion,
      latestVersion: remoteVersion,
      updateAvailable: comparison > 0,
      upToDate: comparison === 0,
      lastChecked: new Date().toISOString()
    }

    // Cache the result
    cachedUpdateInfo = updateInfo
    lastCheck = now

    return updateInfo
  } catch (error) {
    // If check fails, return current version info with error
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      upToDate: null,
      error: error.message,
      lastChecked: new Date().toISOString()
    }
  }
}

/**
 * Get cached update info without making a new request
 */
function getCachedUpdateInfo() {
  return cachedUpdateInfo || {
    currentVersion: packageJson.version,
    latestVersion: null,
    updateAvailable: false,
    upToDate: null,
    lastChecked: null
  }
}

module.exports = {
  checkForUpdates,
  getCachedUpdateInfo,
  compareVersions
}