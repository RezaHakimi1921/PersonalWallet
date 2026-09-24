# PersonalWallet — pulls the latest nightly DB backup from the VPS down to this
# computer. Runs entirely independently of Claude (Windows Task Scheduler only) --
# needs nothing but OpenSSH client (built into Windows 10/11) and the SSH key below.

$ErrorActionPreference = 'Stop'

$SshKey    = "$env:USERPROFILE\.ssh\personalwallet_claude"
$SshHost   = "cluadai@78.39.51.105"
$SshPort   = 2238
$RemoteDir = "/home/personalwallet/personalwallet/backups"
$LocalDir  = "D:\PersonalWallet\backups"
$LogFile   = Join-Path $LocalDir "sync.log"
$KeepCount = 30
$NtfyTopic = "pw-590a5dd3a7f749b1"

function Write-Log([string]$msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Add-Content -Path $LogFile -Value $line -Encoding utf8
}

function Send-Alert([string]$msg) {
    try {
        $payload = @{
            topic    = $NtfyTopic
            title    = "خطای بک‌آپ محلی PersonalWallet"
            message  = $msg
            priority = 4
            tags     = @("warning")
        } | ConvertTo-Json
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        Invoke-RestMethod -Uri "https://ntfy.sh" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -TimeoutSec 15 | Out-Null
    } catch {
        # If even the alert fails, there's nothing more to do -- the log file still has the real error.
    }
}

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

$sshOpts = @("-o", "ConnectTimeout=15", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-p", "$SshPort", "-i", $SshKey)
$scpOpts = @("-o", "ConnectTimeout=15", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-P", "$SshPort", "-i", $SshKey)

try {
    $latest = & ssh @sshOpts $SshHost "ls -t $RemoteDir/*.sql.gz 2>/dev/null | head -1"
    if ($LASTEXITCODE -ne 0 -or -not $latest) {
        throw "اتصال SSH برقرار نشد یا لیست بک‌آپ‌های سرور خالی بود (exit code $LASTEXITCODE)."
    }
    $latest = $latest.Trim()
    $fileName = Split-Path $latest -Leaf
    $localPath = Join-Path $LocalDir $fileName

    if (Test-Path $localPath) {
        Write-Log "قبلاً دانلود شده، کاری لازم نیست: $fileName"
    } else {
        & scp @scpOpts "${SshHost}:$latest" $localPath
        if ($LASTEXITCODE -ne 0) { throw "scp با کد خطای $LASTEXITCODE شکست خورد." }
        Write-Log "دانلود شد: $fileName"
    }

    $old = Get-ChildItem -Path $LocalDir -Filter "*.sql.gz" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepCount
    foreach ($f in $old) {
        Remove-Item $f.FullName -Force
        Write-Log "حذف نسخه‌ی قدیمی (بیش از $KeepCount نسخه): $($f.Name)"
    }
}
catch {
    $errMsg = $_.Exception.Message
    Write-Log "خطا: $errMsg"
    Send-Alert "دانلود بک‌آپ روزانه‌ی PersonalWallet شکست خورد: $errMsg"
}
