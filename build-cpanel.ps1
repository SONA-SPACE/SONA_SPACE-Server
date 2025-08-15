# SONA SPACE Server Build Script for cPanel (PowerShell)
# Tạo bởi: GitHub Copilot
# Ngày: $(Get-Date)

Write-Host "🚀 Bắt đầu đóng gói SONA SPACE Server cho cPanel..." -ForegroundColor Green

# Tạo thư mục build
$BUILD_DIR = "sona-space-server-build"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BUILD_NAME = "sona-space-server-$TIMESTAMP"

Write-Host "📁 Tạo thư mục build: $BUILD_NAME" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $BUILD_NAME -Force | Out-Null

# Define các file và folder cần loại trừ
$excludeItems = @(
    "node_modules",
    ".git",
    ".env.local",
    ".env.development", 
    "*.log",
    "test-*.js",
    "check-*.js",
    "debug-*.js",
    "tmp",
    "stderr.log",
    $BUILD_NAME,
    "build-cpanel.sh",
    "build-cpanel.ps1"
)

# Copy source code
Write-Host "📋 Copy source code..." -ForegroundColor Yellow
$sourceItems = Get-ChildItem -Path . | Where-Object { 
    $item = $_
    $shouldExclude = $false
    foreach ($exclude in $excludeItems) {
        if ($item.Name -like $exclude) {
            $shouldExclude = $true
            break
        }
    }
    -not $shouldExclude
}

foreach ($item in $sourceItems) {
    $destination = Join-Path $BUILD_NAME $item.Name
    if ($item.PSIsContainer) {
        Copy-Item -Path $item.FullName -Destination $destination -Recurse -Force
    } else {
        Copy-Item -Path $item.FullName -Destination $destination -Force
    }
}

# Tạo .env template cho production
Write-Host "⚙️ Tạo .env template..." -ForegroundColor Yellow
$envContent = @"
# SONA SPACE Server - Production Environment
# Cập nhật các giá trị này theo cPanel hosting của bạn

# Database Configuration
DB_HOST=localhost
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
DB_DATABASE=your_db_name

# Email Configuration (Gmail SMTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# JWT Secret (thay đổi thành chuỗi ngẫu nhiên mạnh)
JWT_SECRET=your_super_secret_jwt_key_here

# Server Configuration
NODE_ENV=production
PORT=3501

# Cloudinary (nếu sử dụng)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# VNPay (nếu sử dụng)
VNPAY_TMN_CODE=your_tmn_code
VNPAY_SECRET_KEY=your_secret_key
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=your_return_url

# Site URL
SITE_URL=https://yourdomain.com
"@

$envContent | Out-File -FilePath "$BUILD_NAME\.env.production" -Encoding UTF8

# Tạo file .htaccess
Write-Host "🔧 Tạo .htaccess..." -ForegroundColor Yellow
$htaccessContent = @"
# SONA SPACE Server Apache Configuration

# Rewrite engine
RewriteEngine On

# Redirect HTTP to HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Handle Angular and React Router
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Cache static files
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/pdf "access plus 1 month"
    ExpiresByType text/javascript "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>
"@

$htaccessContent | Out-File -FilePath "$BUILD_NAME\.htaccess" -Encoding UTF8

# Tạo production package.json
Write-Host "📦 Tạo production package.json..." -ForegroundColor Yellow
$packageContent = @"
{
  "name": "sona-space-server",
  "version": "1.0.0",
  "description": "SONA SPACE Furniture E-commerce Server",
  "main": "app.js",
  "scripts": {
    "start": "node ./bin/www",
    "install-deps": "npm install --production",
    "setup": "npm run install-deps && node setup-production.js"
  },
  "engines": {
    "node": ">=14.0.0",
    "npm": ">=6.0.0"
  },
  "dependencies": {
    "axios": "^1.10.0",
    "bcryptjs": "^2.4.3",
    "cloudinary": "^2.7.0",
    "cookie-parser": "~1.4.4",
    "cors": "^2.8.5",
    "dayjs": "^1.11.13",
    "debug": "~2.6.9",
    "dotenv": "^16.4.7",
    "ejs": "~2.6.1",
    "express": "~4.16.1",
    "express-ejs-layouts": "^2.5.1",
    "form-data": "^4.0.4",
    "google-auth-library": "^10.1.0",
    "http-errors": "~1.6.3",
    "jsonwebtoken": "^9.0.2",
    "morgan": "~1.9.1",
    "multer": "^2.0.1",
    "mysql2": "^3.13.0",
    "node-fetch": "^2.7.0",
    "nodemailer": "^7.0.4",
    "socket.io": "^4.8.1",
    "vnpay": "^2.3.2"
  }
}
"@

$packageContent | Out-File -FilePath "$BUILD_NAME\package-cpanel.json" -Encoding UTF8

# Tạo setup script
Write-Host "🔧 Tạo setup script..." -ForegroundColor Yellow
$setupContent = @"
const fs = require('fs');
const path = require('path');

console.log('🚀 Thiết lập SONA SPACE Server cho production...');

// Kiểm tra .env file
const envFile = '.env';
if (!fs.existsSync(envFile)) {
    console.log('⚠️ File .env không tồn tại. Copy từ .env.production...');
    if (fs.existsSync('.env.production')) {
        fs.copyFileSync('.env.production', envFile);
        console.log('✅ Đã tạo file .env từ template');
    } else {
        console.log('❌ Vui lòng tạo file .env với cấu hình database và email');
        process.exit(1);
    }
}

// Tạo thư mục cần thiết
const dirs = ['tmp', 'public/uploads', 'logs'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Tạo thư mục: ${dir}`);
    }
});

console.log('🎉 Thiết lập hoàn tất!');
console.log('📝 Nhớ cập nhật file .env với thông tin database và email của bạn');
console.log('🚀 Chạy: npm start để khởi động server');
"@

$setupContent | Out-File -FilePath "$BUILD_NAME\setup-production.js" -Encoding UTF8

# Tạo hướng dẫn
Write-Host "📖 Tạo hướng dẫn cài đặt..." -ForegroundColor Yellow
$guideContent = @"
# 🚀 Hướng dẫn cài đặt SONA SPACE Server trên cPanel

## 📋 Yêu cầu hệ thống
- Node.js >= 14.0.0
- MySQL 5.7+ hoặc MariaDB
- PHP (để chạy phpMyAdmin quản lý database)

## 📂 Cấu trúc file sau khi upload

```
public_html/
├── api/                    # Folder chứa Node.js app
│   ├── app.js
│   ├── package.json
│   ├── .env               # Cấu hình database và email
│   └── ...
└── index.html            # Landing page (optional)
```

## 🔧 Các bước cài đặt

### 1. Upload files lên cPanel
1. Nén toàn bộ folder này thành file `.zip`
2. Vào cPanel > File Manager
3. Tạo folder `api` trong `public_html`
4. Upload và giải nén file zip vào folder `api`

### 2. Cài đặt Node.js (nếu chưa có)
1. Vào cPanel > Node.js
2. Chọn phiên bản Node.js >= 14
3. Set App Root: `/public_html/api`
4. Set Application URL: `yourdomain.com/api`
5. Click "Create"

### 3. Cấu hình database
1. Vào cPanel > MySQL Databases
2. Tạo database mới: `your_db_name`
3. Tạo user và password
4. Import file SQL database (nếu có)

### 4. Cấu hình file .env
Sửa file `.env` với thông tin của bạn:

```env
DB_HOST=localhost
DB_USERNAME=your_cpanel_username_dbname
DB_PASSWORD=your_db_password
DB_DATABASE=your_cpanel_username_dbname

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

JWT_SECRET=your_random_secret_key
NODE_ENV=production
PORT=3000

SITE_URL=https://yourdomain.com
```

### 5. Cài đặt dependencies
Trong cPanel Node.js App:
1. Click "Run NPM Install"
2. Hoặc chạy lệnh: `npm install --production`

### 6. Khởi động ứng dụng
1. Trong cPanel Node.js: Click "Restart"
2. Hoặc chạy: `npm start`

## 🔗 Cấu hình Domain/URL

### Subdomain API
Tạo subdomain: `api.yourdomain.com` trỏ đến `/public_html/api`

### .htaccess redirect
Thêm vào `public_html/.htaccess`:

```apache
RewriteEngine On
RewriteRule ^api/(.*)$ /api/$1 [L]
```

## 📊 Test API

Sau khi cài đặt, test các endpoint:

- `https://yourdomain.com/api/health` - Health check
- `https://yourdomain.com/api/products` - Danh sách sản phẩm
- `https://yourdomain.com/api/auth/login` - Đăng nhập

## 🐛 Troubleshooting

### Lỗi thường gặp:

1. **"Cannot connect to database"**
   - Kiểm tra thông tin DB trong .env
   - Đảm bảo database đã được tạo và import

2. **"Port already in use"**
   - Thay đổi PORT trong .env
   - Restart Node.js app

3. **"Cannot find module"**
   - Chạy lại `npm install`
   - Kiểm tra file package.json

### Log files:
- cPanel Error Logs: `/logs/error.log`
- Application logs: Check trong cPanel Node.js interface

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Node.js version >= 14
2. Database connection
3. Email SMTP settings
4. File permissions (755 cho folders, 644 cho files)

## 🔐 Bảo mật

1. Đặt JWT_SECRET phức tạp
2. Sử dụng HTTPS
3. Cập nhật dependencies thường xuyên
4. Backup database định kỳ

---

**Chúc bạn deploy thành công! 🎉**
"@

$guideContent | Out-File -FilePath "$BUILD_NAME\HUONG-DAN-CPANEL.md" -Encoding UTF8

# Tạo PM2 ecosystem
Write-Host "⚙️ Tạo PM2 ecosystem..." -ForegroundColor Yellow
$ecosystemContent = @"
module.exports = {
  apps: [{
    name: 'sona-space-server',
    script: './bin/www',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }]
};
"@

$ecosystemContent | Out-File -FilePath "$BUILD_NAME\ecosystem.production.js" -Encoding UTF8

# Tạo file nén
Write-Host "📦 Tạo file nén..." -ForegroundColor Yellow
if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
    Compress-Archive -Path $BUILD_NAME -DestinationPath "$BUILD_NAME.zip" -Force
} else {
    Write-Host "⚠️ PowerShell 5.0+ cần thiết để tạo file zip. Vui lòng tự nén folder $BUILD_NAME" -ForegroundColor Red
}

# Hiển thị thông tin build
Write-Host ""
Write-Host "✅ ĐÓNG GÓI HOÀN TẤT!" -ForegroundColor Green
Write-Host "📁 Thư mục build: $BUILD_NAME/" -ForegroundColor Cyan
Write-Host "📦 File nén: $BUILD_NAME.zip" -ForegroundColor Cyan

# Hiển thị kích thước
$folderSize = (Get-ChildItem -Path $BUILD_NAME -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "📋 Kích thước folder: $([math]::Round($folderSize, 2)) MB" -ForegroundColor Yellow

if (Test-Path "$BUILD_NAME.zip") {
    $zipSize = (Get-Item "$BUILD_NAME.zip").Length / 1MB
    Write-Host "📦 Kích thước file zip: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📖 Các bước tiếp theo:" -ForegroundColor Yellow
Write-Host "1. Upload file $BUILD_NAME.zip lên cPanel" -ForegroundColor White
Write-Host "2. Giải nén trong thư mục public_html/api/" -ForegroundColor White
Write-Host "3. Cấu hình file .env với thông tin database" -ForegroundColor White
Write-Host "4. Cài đặt Node.js dependencies" -ForegroundColor White
Write-Host "5. Khởi động ứng dụng" -ForegroundColor White
Write-Host ""
Write-Host "📚 Xem chi tiết trong file: $BUILD_NAME/HUONG-DAN-CPANEL.md" -ForegroundColor Cyan

Write-Host "🎉 Chúc bạn deploy thành công!" -ForegroundColor Green
