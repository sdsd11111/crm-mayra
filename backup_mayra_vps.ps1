# ====================================================================
# Script de Backup Automático y Sincronización a Local (CRM Mayra)
# Uso: .\backup_mayra_vps.ps1
# Descarga un snapshot comprimido de crm_mayra_prod directo a tu PC
# ====================================================================

$key = "$PSScriptRoot\vps-entrada\agenda_vps_nueva"
$vpsHost = "root@178.238.238.158"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "$PSScriptRoot\backups"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$localFile = "$backupDir\crm_mayra_prod_$timestamp.sql.gz"
$remoteScript = "mkdir -p /root/backups/crm-mayra && mysqldump -u root crm_mayra_prod | gzip > /tmp/mayra_backup_$timestamp.sql.gz"

Write-Host "📦 [1/3] Generando snapshot comprimido en VPS..." -ForegroundColor Cyan
ssh -i $key -o StrictHostKeyChecking=no $vpsHost $remoteScript

Write-Host "📥 [2/3] Descargando snapshot a tu máquina local ($localFile)..." -ForegroundColor Cyan
scp -i $key -o StrictHostKeyChecking=no "${vpsHost}:/tmp/mayra_backup_$timestamp.sql.gz" "$localFile"

Write-Host "🧹 [3/3] Limpiando archivo temporal en VPS..." -ForegroundColor Cyan
ssh -i $key -o StrictHostKeyChecking=no $vpsHost "rm -f /tmp/mayra_backup_$timestamp.sql.gz"

if (Test-Path $localFile) {
    $size = (Get-Item $localFile).Length / 1KB
    Write-Host "✅ Backup completado exitosamente: $localFile ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "❌ Ocurrió un error al transferir el archivo de backup." -ForegroundColor Red
}
