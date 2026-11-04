# Thermal printer queue guard and RAW printer for Windows.
#
# Keep this file ASCII-only: Windows PowerShell 5 reads BOM-less scripts as ANSI.
#
# The thermal printer is identified by its USB VID/PID, never by its USB port
# number (USB001, USB003...), because Windows assigns a new virtual port when the
# printer is plugged into another physical socket. The queue is then repointed
# to the port the printer currently uses. Only allowlisted thermal VID/PIDs are
# accepted, so the queue is never redirected to the HP LaserJet or the EPSON.
#
# Modes:
#   -File <path>   ensure the queue, send the RAW file, and wait until the
#                  spooler has delivered it (the job leaves the queue).
#   (no -File)     only ensure the queue (installer and periodic self-healing).
#
# Output: a single compressed JSON line on stdout. The exit code is always 0
# when the script ran; failures are reported through the "ok"/"code" fields.

param(
    [string]$PrinterName = 'albaran',
    [string]$DriverName = 'Generic / Text Only',
    [string]$File = '',
    [string]$RawPrintExe = '',
    [int]$DrainTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Known ESC/POS 80 mm thermal printers (USB parent device of USBPRINT\...).
$ThermalUsbIds = @(
    'VID_0483&PID_5743', # current thermal (also used by the central server)
    'VID_0FE6&PID_811E'  # legacy "80Series2" thermal
)

$result = [ordered]@{
    ok          = $false
    code        = ''
    printer     = $PrinterName
    port        = ''
    action      = 'none'
    previousPort = ''
    removedJobs = 0
    detail      = ''
}

function Write-Result {
    $result | ConvertTo-Json -Compress
}

function Find-ThermalPort {
    $found = @()
    $devices = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
        Where-Object { $_.InstanceId -like 'USBPRINT\*' })
    foreach ($device in $devices) {
        $parent = (Get-PnpDeviceProperty -InstanceId $device.InstanceId -KeyName DEVPKEY_Device_Parent -ErrorAction SilentlyContinue).Data
        if (-not $parent) { continue }
        $isThermal = $false
        foreach ($id in $ThermalUsbIds) {
            if ($parent.ToUpperInvariant().Contains($id)) { $isThermal = $true }
        }
        if (-not $isThermal) { continue }
        # usbprint names its child device after the virtual port: ...&USB005
        $port = ($device.InstanceId -split '&')[-1].ToUpperInvariant()
        if ($port -notmatch '^USB\d{3}$') { continue }
        $found += [pscustomobject]@{ Port = $port; Parent = $parent; InstanceId = $device.InstanceId }
    }
    return ,$found
}

function Remove-AllJobs {
    $jobs = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue)
    foreach ($job in $jobs) {
        Remove-PrintJob -PrinterName $PrinterName -ID $job.Id -ErrorAction SilentlyContinue
    }
    return $jobs.Count
}

try {
    $candidates = Find-ThermalPort
    if ($candidates.Count -eq 0) {
        $result.code = 'THERMAL_NOT_CONNECTED'
        Write-Result
        exit 0
    }
    if ($candidates.Count -gt 1) {
        $result.code = 'THERMAL_AMBIGUOUS'
        $result.detail = (($candidates | ForEach-Object { $_.Port }) -join ',')
        Write-Result
        exit 0
    }

    $port = $candidates[0].Port
    $result.port = $port
    if (-not (Get-PrinterPort -Name $port -ErrorAction SilentlyContinue)) {
        $result.code = 'PORT_MISSING'
        Write-Result
        exit 0
    }

    $queue = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    if (-not $queue) {
        if (-not (Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue)) {
            Add-PrinterDriver -Name $DriverName
        }
        Add-Printer -Name $PrinterName -DriverName $DriverName -PortName $port
        $result.action = 'created'
    } elseif ($queue.PortName -ne $port) {
        # Every queued job targeted a port without the printer, so none of them
        # was printed. Drop them before repointing; otherwise stale tickets would
        # print in bulk as soon as the queue reaches the printer again.
        $result.previousPort = $queue.PortName
        $result.removedJobs = Remove-AllJobs
        Set-Printer -Name $PrinterName -PortName $port
        $result.action = 'repointed'
    }

    # Windows marks the queue "Use printer offline" when its port loses the
    # printer, and keeps it offline after the port is fixed: the spooler then
    # holds every job. Jobs held while offline were never printed either.
    $wmiQueue = Get-CimInstance Win32_Printer -Filter "Name='$PrinterName'"
    if ($wmiQueue -and $wmiQueue.WorkOffline) {
        $result.removedJobs += Remove-AllJobs
        Set-CimInstance -InputObject $wmiQueue -Property @{ WorkOffline = $false }
        if ($result.action -eq 'none') { $result.action = 'onlined' } else { $result.action = "$($result.action)+onlined" }
    }

    if (-not $File) {
        $result.ok = $true
        Write-Result
        exit 0
    }

    $rawOutput = & $RawPrintExe $PrinterName $File 2>&1
    if ($LASTEXITCODE -ne 0) {
        $result.code = 'RAWPRINT_FAILED'
        $result.detail = ($rawOutput | Out-String).Trim()
        Write-Result
        exit 0
    }

    # WritePrinter success only means the spooler accepted the bytes. The job
    # leaves the queue once the port monitor has delivered it to the printer.
    $deadline = (Get-Date).AddSeconds($DrainTimeoutSeconds)
    do {
        $pending = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue)
        if ($pending.Count -eq 0) { break }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)

    if ($pending.Count -gt 0) {
        # The printer is attached but not printing (off, no paper, cover open).
        # Remove the stuck jobs so they do not print unexpectedly later; the
        # caller reports the failure and the user retries.
        $result.detail = (($pending | ForEach-Object { "$($_.JobStatus)" }) -join ',')
        $result.removedJobs += Remove-AllJobs
        $result.code = 'NOT_PRINTED'
        Write-Result
        exit 0
    }

    $result.ok = $true
    Write-Result
    exit 0
} catch {
    $result.code = 'SCRIPT_ERROR'
    $result.detail = $_.Exception.Message
    Write-Result
    exit 0
}
