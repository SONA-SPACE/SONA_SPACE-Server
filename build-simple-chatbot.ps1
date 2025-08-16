# Simple Chatbot Production Build Script
Write-Host "Building SONA SPACE with Chatbot for cPanel..." -ForegroundColor Green

# Setup directories
$ProjectDir = Get-Location
$BuildDir = Join-Path $ProjectDir "cpanel-build-chatbot"

# Clean and create build directory
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Path $BuildDir | Out-Null

# Essential files including chatbot
$EssentialItems = @(
    "app.js",
    "chatbotSocket.js",
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

# Copy files
Write-Host "Copying files..." -ForegroundColor Yellow
foreach ($item in $EssentialItems) {
    $source = Join-Path $ProjectDir $item
    $dest = Join-Path $BuildDir $item
    
    if (Test-Path $source) {
        if ((Get-Item $source).PSIsContainer) {
            Copy-Item -Recurse -Path $source -Destination $dest
            Write-Host "  Copied: $item/" -ForegroundColor Cyan
        } else {
            Copy-Item -Path $source -Destination $dest
            Write-Host "  Copied: $item" -ForegroundColor Cyan
        }
    }
}

# Create production .env
Write-Host "Creating production .env..." -ForegroundColor Yellow
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
OPENAI_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=
"@

$envPath = Join-Path $BuildDir ".env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8

# Create .htaccess with Socket.IO support
Write-Host "Creating .htaccess..." -ForegroundColor Yellow
$htaccessContent = @"
RewriteEngine On
RewriteRule ^$ app.js [L]
RewriteRule (.*) app.js [L]
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"
Header always set Upgrade `$http_upgrade
Header always set Connection "upgrade"
"@

$htaccessPath = Join-Path $BuildDir ".htaccess"
$htaccessContent | Out-File -FilePath $htaccessPath -Encoding UTF8

# Create chatbot database setup
Write-Host "Creating database setup..." -ForegroundColor Yellow
$dbContent = @"
-- Chatbot Database Setup
CREATE TABLE IF NOT EXISTS chatbot_context (
    id INT AUTO_INCREMENT PRIMARY KEY,
    context_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO chatbot_context (context_text) VALUES 
('Bạn là trợ lý AI thân thiện của Sona Space - chuyên gia nội thất cao cấp. Hỗ trợ khách hàng về sản phẩm, đơn hàng, và dịch vụ. Liên hệ: 0705768791')
ON DUPLICATE KEY UPDATE context_text = VALUES(context_text);
"@

$dbPath = Join-Path $BuildDir "setup-chatbot.sql"
$dbContent | Out-File -FilePath $dbPath -Encoding UTF8

# Clean package.json
Write-Host "Optimizing package.json..." -ForegroundColor Yellow
$packagePath = Join-Path $BuildDir "package.json"
$packageJson = Get-Content $packagePath | ConvertFrom-Json
$packageJson.scripts = @{ "start" = "node ./bin/www" }
if ($packageJson.PSObject.Properties.Name -contains "devDependencies") {
    $packageJson.PSObject.Properties.Remove("devDependencies")
}
$packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath $packagePath -Encoding UTF8

# Create deployment guide
Write-Host "Creating deployment guide..." -ForegroundColor Yellow
$guideContent = @"
# SONA SPACE - cPanel Deployment with AI Chatbot

## New Features
- AI Chatbot with OpenAI GPT-4o-mini
- Real-time chat via Socket.IO
- Enhanced email notifications
- Return rejection with supplier contact

## Deployment Steps

1. Upload files to cPanel public_html
2. Run setup-chatbot.sql in MySQL
3. Update .env with your OpenAI API key
4. Setup Node.js App in cPanel:
   - Startup file: app.js
   - Node.js version: 16+
5. Install dependencies: npm install --production
6. Start application

## Required Environment Variables
- OPENAI_API_KEY: Your OpenAI API key for chatbot
- DB_PASS: Your database password
- EMAIL_PASS: Gmail app password

## Testing
- API: GET /api/products
- Chatbot: WebSocket connection to /socket.io/
- Email: Order notifications working

## Support
Phone: 0705768791
Email: nguyenhongthai0802@gmail.com
"@

$guidePath = Join-Path $BuildDir "DEPLOYMENT-GUIDE.md"
$guideContent | Out-File -FilePath $guidePath -Encoding UTF8

# Create ZIP
Write-Host "Creating ZIP file..." -ForegroundColor Yellow
$zipPath = Join-Path $ProjectDir "SONA_SPACE_CHATBOT_PRODUCTION.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path "$BuildDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

# Show results
Write-Host ""
Write-Host "BUILD COMPLETED!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host "Build folder: $BuildDir" -ForegroundColor Yellow
Write-Host "ZIP file: $zipPath" -ForegroundColor Yellow

$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "ZIP size: $zipSize MB" -ForegroundColor Cyan

Write-Host ""
Write-Host "Contents:" -ForegroundColor Cyan
Get-ChildItem -Path $BuildDir | ForEach-Object { 
    Write-Host "  $($_.Name)" -ForegroundColor White 
}

Write-Host ""
Write-Host "NEW FEATURES:" -ForegroundColor Green
Write-Host "  AI Chatbot (chatbotSocket.js)" -ForegroundColor White
Write-Host "  OpenAI GPT-4o-mini integration" -ForegroundColor White
Write-Host "  Socket.IO real-time chat" -ForegroundColor White
Write-Host "  Enhanced email system" -ForegroundColor White
Write-Host "  Return rejection notifications" -ForegroundColor White

Write-Host ""
Write-Host "Ready for cPanel deployment!" -ForegroundColor Green
