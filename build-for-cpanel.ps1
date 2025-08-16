# Build Script for cPanel Deployment
# This script will clean up unnecessary files and prepare the project for production

Write-Host "🚀 Starting cPanel Build Process..." -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Set project directory
$ProjectDir = Get-Location
Write-Host "📁 Project Directory: $ProjectDir" -ForegroundColor Yellow

# Create build directory
$BuildDir = Join-Path $ProjectDir "cpanel-build"
if (Test-Path $BuildDir) {
    Write-Host "🗑️ Removing existing build directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $BuildDir
}

Write-Host "📦 Creating build directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $BuildDir | Out-Null

# List of essential files and folders to keep
$EssentialItems = @(
    "app.js",
    "package.json",
    "package-lock.json",
    ".env.production",
    ".htaccess",
    "ecosystem.config.js",
    "bin",
    "config",
    "middleware", 
    "models",
    "routes",
    "services",
    "template",
    "views",
    "public",
    "migrations",
    "tmp"
)

Write-Host "📋 Copying essential files..." -ForegroundColor Yellow
foreach ($item in $EssentialItems) {
    $sourcePath = Join-Path $ProjectDir $item
    $destPath = Join-Path $BuildDir $item
    
    if (Test-Path $sourcePath) {
        if (Test-Path $sourcePath -PathType Container) {
            # It's a directory
            Write-Host "  📁 Copying folder: $item" -ForegroundColor Cyan
            Copy-Item -Recurse -Path $sourcePath -Destination $destPath
        } else {
            # It's a file
            Write-Host "  📄 Copying file: $item" -ForegroundColor Cyan
            Copy-Item -Path $sourcePath -Destination $destPath
        }
    } else {
        Write-Host "  ⚠️ File not found: $item" -ForegroundColor Red
    }
}

# Create production environment file
Write-Host "🔧 Setting up production environment..." -ForegroundColor Yellow
$prodEnvPath = Join-Path $BuildDir ".env"
$envContent = @"
# Production Environment Configuration
NODE_ENV=production
PORT=3501

# Database Configuration
DB_HOST=fur.timefortea.io.vn
DB_PORT=3306
DB_USER=thainguyen0802
DB_PASS=
DB_NAME=fur_timefortea_io_vn

# Email Configuration
EMAIL_USER=sonaspace.furniture@gmail.com
EMAIL_PASS=rndo lwgk rvqu bqpj

# JWT Configuration
JWT_SECRET=sona_space_secret_key_2024_production

# Cloudinary Configuration (if used)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Other configurations
SESSION_SECRET=sona_space_session_secret_production
"@

$envContent | Out-File -FilePath $prodEnvPath -Encoding UTF8
Write-Host "  ✅ Created .env file" -ForegroundColor Green

# Create .htaccess for cPanel
Write-Host "Creating .htaccess for Node.js..." -ForegroundColor Yellow
$htaccessContent = @'
# Enable Node.js for cPanel
RewriteEngine On
RewriteRule ^$ app.js [L]
RewriteRule (.*) app.js [L]

# Security headers
Header always set X-Frame-Options DENY
Header always set X-Content-Type-Options nosniff
Header always set X-XSS-Protection "1; mode=block"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"

# CORS headers for API
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"

# Cache static files
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 month"
</FilesMatch>
'@

$htaccessPath = Join-Path $BuildDir ".htaccess"
$htaccessContent | Out-File -FilePath $htaccessPath -Encoding UTF8
Write-Host "  Created .htaccess file" -ForegroundColor Green

# Clean up unnecessary files in build
Write-Host "🧹 Cleaning up unnecessary files..." -ForegroundColor Yellow

# Remove development dependencies from package.json
$packageJsonPath = Join-Path $BuildDir "package.json"
if (Test-Path $packageJsonPath) {
    $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
    
    # Keep only production dependencies
    $packageJson.scripts = @{
        "start" = "node ./bin/www"
    }
    
    # Remove devDependencies
    if ($packageJson.PSObject.Properties.Name -contains "devDependencies") {
        $packageJson.PSObject.Properties.Remove("devDependencies")
    }
    
    $packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath $packageJsonPath -Encoding UTF8
    Write-Host "  ✅ Cleaned package.json" -ForegroundColor Green
}

# Remove development files from routes if any
$routesDir = Join-Path $BuildDir "routes"
if (Test-Path $routesDir) {
    Get-ChildItem -Path $routesDir -Filter "*.dev.js" | Remove-Item -Force
    Get-ChildItem -Path $routesDir -Filter "*.test.js" | Remove-Item -Force
    Write-Host "  ✅ Cleaned routes directory" -ForegroundColor Green
}

# Create deployment instructions
Write-Host "📋 Creating deployment instructions..." -ForegroundColor Yellow
$instructionsContent = @"
# 🚀 SONA SPACE - cPanel Deployment Instructions

## 📦 Files Included
This build contains only the essential files needed for production:
- app.js (main application)
- package.json (production dependencies only)
- .env (production environment variables)
- .htaccess (Apache configuration for Node.js)
- All essential folders: bin, config, middleware, models, routes, services, template, views, public

## 🔧 cPanel Deployment Steps

### 1. Upload Files
- Upload all files from this build folder to your cPanel public_html directory
- Or create a subdirectory like /api/ if you want the API in a subfolder

### 2. Install Dependencies
In cPanel Terminal or File Manager > Terminal:
```bash
cd /home/yourusername/public_html
npm install --production
```

### 3. Database Setup
- Make sure your MySQL database is accessible
- Update .env file with correct database credentials:
  - DB_HOST: your database host
  - DB_USER: your database username  
  - DB_PASS: your database password
  - DB_NAME: your database name

### 4. Configure Node.js in cPanel
- Go to cPanel > Software > Setup Node.js App
- Create New App:
  - Node.js Version: Latest available (14+ recommended)
  - Application Mode: Production
  - Application Root: public_html (or your chosen directory)
  - Application URL: your domain or subdomain
  - Application Startup File: app.js

### 5. Environment Variables (in cPanel Node.js App)
Add these environment variables in cPanel Node.js App settings:
- NODE_ENV=production
- PORT=3501 (or the port assigned by cPanel)

### 6. Start Application
- Click "Start App" in cPanel Node.js App interface
- The application should now be running

## 🔍 Verification
Test these endpoints to verify deployment:
- GET /api/products (should return product list)
- GET /api/categories (should return categories)
- POST /api/auth/login (should accept login)

## 🚨 Troubleshooting
- Check error logs in cPanel Node.js App interface
- Verify database connection in .env file
- Ensure all file permissions are correct (755 for directories, 644 for files)
- Check if port is available and not blocked

## 📞 Support
Contact: nguyenhongthai0802@gmail.com | 0705768791

## ✅ Features Included in This Build
- ✅ Complete order management system
- ✅ Return/refund workflow with email notifications
- ✅ Automatic coupon creation for successful returns  
- ✅ Email notifications for order status changes
- ✅ User authentication and authorization
- ✅ Product catalog management
- ✅ Payment integration
- ✅ Admin dashboard functionality
- ✅ Professional email templates
- ✅ Return rejection notifications with supplier contact

---
Built on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Environment: Production
Version: 1.0.0
"@

$instructionsPath = Join-Path $BuildDir "DEPLOYMENT-INSTRUCTIONS.md"
$instructionsContent | Out-File -FilePath $instructionsPath -Encoding UTF8
Write-Host "  ✅ Created deployment instructions" -ForegroundColor Green

# Create ZIP file for easy upload
Write-Host "📦 Creating ZIP file for upload..." -ForegroundColor Yellow
$zipPath = Join-Path $ProjectDir "SONA_SPACE_cPanel_Build.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

try {
    Compress-Archive -Path "$BuildDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Host "  ✅ Created ZIP file: SONA_SPACE_cPanel_Build.zip" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to create ZIP file: $($_.Exception.Message)" -ForegroundColor Red
}

# Show build summary
Write-Host ""
Write-Host "🎉 BUILD COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "📁 Build directory: $BuildDir" -ForegroundColor Yellow
Write-Host "📦 ZIP file: $zipPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Build Contents:" -ForegroundColor Cyan
Get-ChildItem -Path $BuildDir | ForEach-Object {
    if ($_.PSIsContainer) {
        Write-Host "  📁 $($_.Name)/" -ForegroundColor Cyan
    } else {
        Write-Host "  📄 $($_.Name)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "🚀 Ready for cPanel deployment!" -ForegroundColor Green
Write-Host "📖 See DEPLOYMENT-INSTRUCTIONS.md for upload steps" -ForegroundColor Yellow
Write-Host ""
