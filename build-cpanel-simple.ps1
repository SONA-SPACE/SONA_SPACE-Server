# Simple cPanel Build Script
Write-Host "Starting cPanel Build Process..." -ForegroundColor Green

# Set directories
$ProjectDir = Get-Location
$BuildDir = Join-Path $ProjectDir "cpanel-build"

# Remove existing build
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Path $BuildDir | Out-Null

# Essential files and folders
$EssentialItems = @(
    "app.js",
    "package.json", 
    "package-lock.json",
    "bin",
    "config",
    "middleware",
    "models", 
    "routes",
    "services",
    "template",
    "views",
    "public",
    "migrations"
)

# Copy essential items
Write-Host "Copying essential files..." -ForegroundColor Yellow
foreach ($item in $EssentialItems) {
    $source = Join-Path $ProjectDir $item
    $dest = Join-Path $BuildDir $item
    
    if (Test-Path $source) {
        if ((Get-Item $source).PSIsContainer) {
            Copy-Item -Recurse -Path $source -Destination $dest
            Write-Host "  Copied folder: $item" -ForegroundColor Cyan
        } else {
            Copy-Item -Path $source -Destination $dest
            Write-Host "  Copied file: $item" -ForegroundColor Cyan
        }
    }
}

# Create production .env
Write-Host "Creating production environment file..." -ForegroundColor Yellow
$envContent = @"
NODE_ENV=production
PORT=3501
DB_HOST=fur.timefortea.io.vn
DB_PORT=3306
DB_USER=thainguyen0802
DB_PASS=
DB_NAME=fur_timefortea_io_vn
EMAIL_USER=sonaspace.furniture@gmail.com
EMAIL_PASS=rndo lwgk rvqu bqpj
JWT_SECRET=sona_space_secret_key_2024_production
SESSION_SECRET=sona_space_session_secret_production
"@

$envPath = Join-Path $BuildDir ".env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8

# Create htaccess
Write-Host "Creating htaccess file..." -ForegroundColor Yellow
$htaccessContent = @"
RewriteEngine On
RewriteRule ^$ app.js [L]
RewriteRule (.*) app.js [L]
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"
"@

$htaccessPath = Join-Path $BuildDir ".htaccess"
$htaccessContent | Out-File -FilePath $htaccessPath -Encoding UTF8

# Clean package.json
Write-Host "Cleaning package.json..." -ForegroundColor Yellow
$packagePath = Join-Path $BuildDir "package.json"
$packageJson = Get-Content $packagePath | ConvertFrom-Json
$packageJson.scripts = @{ "start" = "node ./bin/www" }
if ($packageJson.PSObject.Properties.Name -contains "devDependencies") {
    $packageJson.PSObject.Properties.Remove("devDependencies")
}
$packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath $packagePath -Encoding UTF8

# Create ZIP
Write-Host "Creating ZIP file..." -ForegroundColor Yellow
$zipPath = Join-Path $ProjectDir "SONA_SPACE_cPanel.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path "$BuildDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "BUILD COMPLETED!" -ForegroundColor Green
Write-Host "Build folder: $BuildDir" -ForegroundColor Yellow  
Write-Host "ZIP file: $zipPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Contents:" -ForegroundColor Cyan
Get-ChildItem -Path $BuildDir | ForEach-Object { 
    Write-Host "  $($_.Name)" -ForegroundColor White 
}
Write-Host ""
Write-Host "Ready for cPanel upload!" -ForegroundColor Green
