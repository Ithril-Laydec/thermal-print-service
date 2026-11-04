# Thermal printer queue maintenance for Windows.
#
# Keep this file ASCII-only: Windows PowerShell 5 reads BOM-less scripts as ANSI.
#
# Printing itself does NOT go through this script: tickets are sent straight to
# the queue with RawPrint.exe for maximum speed. The service runs this script in
# the background after each print, at startup, and periodically, so a queue
# broken by a USB port change is repaired before the next (second) click.
#
# The thermal printer is identified by its USB VID/PID, never by its USB port
# number (USB001, USB003...), because Windows assigns a new virtual port when the
# printer is plugged into another physical socket. Only allowlisted thermal
# VID/PIDs are accepted, so the queue is never redirected to the HP or EPSON.
#
# Repairs:
#   - queue missing                -> create it on the thermal port
#   - queue on another port        -> drop held jobs, repoint it
#   - queue "Use printer offline"  -> drop held jobs, bring it online
#   - jobs older than -StuckAfterSeconds (queue otherwise correct; printer off,
#     no paper, cover open) -> drop them so they do not print unexpectedly later
# Held jobs are dropped because none of them was printed: they would otherwise
# print in bulk once the queue reaches the printer, after the user re-printed.
#
# Output: a single compressed JSON line on stdout. The exit code is always 0
# when the script ran; failures are reported through the "ok"/"code" fields.

param(
    [string]$PrinterName = 'albaran',
    [string]$DriverName = 'Generic / Text Only',
    [int]$StuckAfterSeconds = 0
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Known ESC/POS 80 mm thermal printers (USB parent device of USBPRINT\...).
$ThermalUsbIds = @(
    'VID_0483&PID_5743', # current thermal (also used by the central server)
    'VID_0FE6&PID_811E'  # legacy "80Series2" thermal
)

$result = [ordered]@{
    ok           = $false
    code         = ''
    printer      = $PrinterName
    port         = ''
    action       = 'none'
    previousPort = ''
    removedJobs  = 0
    detail       = ''
}

function Write-Result {
    $result | ConvertTo-Json -Compress
}

function Add-Action([string]$name) {
    if ($result.action -eq 'none') { $result.action = $name } else { $result.action = "$($result.action)+$name" }
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

function Remove-Jobs($jobs) {
    $count = 0
    foreach ($job in @($jobs)) {
        Remove-PrintJob -PrinterName $PrinterName -ID $job.Id -ErrorAction SilentlyContinue
        $count++
    }
    return $count
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
        Add-Action 'created'
    } elseif ($queue.PortName -ne $port) {
        $result.previousPort = $queue.PortName
        $result.removedJobs += Remove-Jobs (Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue)
        Set-Printer -Name $PrinterName -PortName $port
        Add-Action 'repointed'
    }

    # Windows marks the queue "Use printer offline" when its port loses the
    # printer and keeps it offline after the port is fixed, holding every job.
    # Get-Printer still reports "Normal"; only Win32_Printer exposes the flag.
    $wmiQueue = Get-CimInstance Win32_Printer -Filter "Name='$PrinterName'"
    if ($wmiQueue -and $wmiQueue.WorkOffline) {
        $result.removedJobs += Remove-Jobs (Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue)
        Set-CimInstance -InputObject $wmiQueue -Property @{ WorkOffline = $false }
        Add-Action 'onlined'
    }

    if ($StuckAfterSeconds -gt 0) {
        $limit = (Get-Date).AddSeconds(-$StuckAfterSeconds)
        $stuck = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue |
            Where-Object { $_.SubmittedTime -lt $limit })
        if ($stuck.Count -gt 0) {
            $result.removedJobs += Remove-Jobs $stuck
            $result.detail = (($stuck | ForEach-Object { "$($_.JobStatus)" }) -join ',')
            Add-Action 'unstuck'
        }
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
