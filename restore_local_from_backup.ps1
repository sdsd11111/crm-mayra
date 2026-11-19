# ====================================================================
# Script de Restauración del Backup en DB Local (StackCP / CPanel)
# Uso: .\restore_local_from_backup.ps1
# Toma el snapshot más reciente descargado y lo inyecta a StackCP
# ====================================================================

$backupDir = "$PSScriptRoot\backups"
$latestBackup = Get-ChildItem "$backupDir\crm_mayra_prod_*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $latestBackup) {
    Write-Host "⚠️ No hay ningún archivo de backup en $backupDir. Ejecuta primero .\backup_mayra_vps.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Backup encontrado: $($latestBackup.Name)" -ForegroundColor Cyan
Write-Host "⏳ Descomprimiendo archivo temporal..." -ForegroundColor Cyan

$tempSql = "$backupDir\temp_restore.sql"

# Descomprimir gzip nativo en PowerShell
$inputFs = [System.IO.File]::OpenRead($latestBackup.FullName)
$outputFs = [System.IO.File]::Create($tempSql)
$gzStream = New-Object System.IO.Compression.GZipStream($inputFs, [System.IO.Compression.CompressionMode]::Decompress)
$gzStream.CopyTo($outputFs)
$gzStream.Close()
$outputFs.Close()
$inputFs.Close()

Write-Host "🚀 Inyectando datos a la base de pruebas (StackCP: crmmayra-313931fe4c)..." -ForegroundColor Cyan

# Credenciales StackCP de tu .env local
$dbHost = "mysql.us.stackcp.com"
$dbPort = 46603
$dbUser = "crmmayra-313931fe4c"
$dbPass = "hc8uft-dckg8o-6Fcnpk"
$dbName = "crmmayra-313931fe4c"

# Ejecutar vía el VPS para no requerir cliente mysql instalado en Windows
$key = "$PSScriptRoot\vps-entrada\agenda_vps_nueva"
$vpsHost = "root@178.238.238.158"

scp -i $key -o StrictHostKeyChecking=no "$tempSql" "${vpsHost}:/tmp/restore_stackcp.sql"
ssh -i $key -o StrictHostKeyChecking=no $vpsHost "mysql -h $dbHost -P $dbPort -u $dbUser -p'$dbPass' $dbName < /tmp/restore_stackcp.sql && rm -f /tmp/restore_stackcp.sql"

Remove-Item -Path $tempSql -Force -ErrorAction SilentlyContinue

Write-Host "✅ Base de datos de pruebas (StackCP) sincronizada al 100% con la copia de producción!" -ForegroundColor Green
