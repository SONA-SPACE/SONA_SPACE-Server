# Updated cPanel Build Script with Chatbot
Write-Host "🚀 Starting Updated cPanel Build Process (with Chatbot)..." -ForegroundColor Green

# Set directories
$ProjectDir = Get-Location
$BuildDir = Join-Path $ProjectDir "cpanel-build-updated"

# Remove existing build
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
    Write-Host "🗑️ Removed existing build directory" -ForegroundColor Yellow
}
New-Item -ItemType Directory -Path $BuildDir | Out-Null
Write-Host "📁 Created new build directory" -ForegroundColor Green

# Essential files and folders (including chatbot)
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

# Copy essential items
Write-Host "📦 Copying essential files..." -ForegroundColor Yellow
foreach ($item in $EssentialItems) {
    $source = Join-Path $ProjectDir $item
    $dest = Join-Path $BuildDir $item
    
    if (Test-Path $source) {
        if ((Get-Item $source).PSIsContainer) {
            Copy-Item -Recurse -Path $source -Destination $dest
            Write-Host "  ✅ Copied folder: $item" -ForegroundColor Cyan
        } else {
            Copy-Item -Path $source -Destination $dest
            Write-Host "  ✅ Copied file: $item" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  ⚠️ Not found: $item" -ForegroundColor Red
    }
}

# Create production .env with chatbot config
Write-Host "🔧 Creating production environment file..." -ForegroundColor Yellow
$envContent = @"
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
SESSION_SECRET=sona_space_session_secret_production

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# OpenAI Configuration for Chatbot
OPENAI_API_KEY=

# VNPay Configuration
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=
"@

$envPath = Join-Path $BuildDir ".env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8
Write-Host "  ✅ Created .env file with chatbot config" -ForegroundColor Green

# Create htaccess with Socket.IO support
Write-Host "🔧 Creating .htaccess with Socket.IO support..." -ForegroundColor Yellow
$htaccessContent = @'
# Enable Node.js for cPanel
RewriteEngine On

# Handle Socket.IO requests
RewriteCond %{REQUEST_URI} ^/socket\.io/ [NC]
RewriteRule ^(.*)$ app.js [L]

# Handle API requests
RewriteRule ^api/(.*)$ app.js [L]

# Default route
RewriteRule ^$ app.js [L]
RewriteRule (.*) app.js [L]

# Security headers
Header always set X-Frame-Options DENY
Header always set X-Content-Type-Options nosniff
Header always set X-XSS-Protection "1; mode=block"

# CORS headers for API and Socket.IO
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"

# WebSocket support
Header always set Upgrade $http_upgrade
Header always set Connection "upgrade"

# Cache static files
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 month"
</FilesMatch>
'@

$htaccessPath = Join-Path $BuildDir ".htaccess"
$htaccessContent | Out-File -FilePath $htaccessPath -Encoding UTF8
Write-Host "  ✅ Created .htaccess with Socket.IO support" -ForegroundColor Green

# Clean package.json for production
Write-Host "🧹 Optimizing package.json for production..." -ForegroundColor Yellow
$packagePath = Join-Path $BuildDir "package.json"
$packageJson = Get-Content $packagePath | ConvertFrom-Json

# Keep only essential scripts
$packageJson.scripts = @{ 
    "start" = "node ./bin/www"
}

# Remove devDependencies
if ($packageJson.PSObject.Properties.Name -contains "devDependencies") {
    $packageJson.PSObject.Properties.Remove("devDependencies")
}

$packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath $packagePath -Encoding UTF8
Write-Host "  ✅ Optimized package.json" -ForegroundColor Green

# Create deployment guide with chatbot info
Write-Host "📋 Creating updated deployment guide..." -ForegroundColor Yellow
$deployGuideContent = @"
# 🚀 SONA SPACE - cPANEL DEPLOYMENT GUIDE (Updated with Chatbot)

## 📦 New Features in This Build

### 🤖 AI Chatbot System
- **File:** chatbotSocket.js
- **Technology:** Socket.IO + OpenAI GPT-4o-mini
- **Features:** Real-time chat support with AI assistant
- **Database:** Uses chatbot_context table for system prompts

### 📧 Enhanced Email System
- Return rejection notifications with supplier contact
- Professional email templates
- Automatic coupon creation for approved returns

## 🔧 cPanel Deployment Steps

### 1. Upload Files
- Upload all files to cPanel public_html directory
- Extract the build files

### 2. Environment Configuration
**IMPORTANT:** Update .env file with these values:

```env
# Database (Required)
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name

# OpenAI for Chatbot (Required for chat feature)
OPENAI_API_KEY=your_openai_api_key

# Email (Required for notifications)
EMAIL_USER=sonaspace.furniture@gmail.com
EMAIL_PASS=your_gmail_app_password

# VNPay (Optional - for payment)
VNPAY_TMN_CODE=your_vnpay_code
VNPAY_HASH_SECRET=your_vnpay_secret
VNPAY_RETURN_URL=your_return_url

# Cloudinary (Optional - for image upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Database Setup
**Required table for chatbot:**
```sql
CREATE TABLE IF NOT EXISTS chatbot_context (
    id INT AUTO_INCREMENT PRIMARY KEY,
    context_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO chatbot_context (context_text) VALUES 
('Bạn là trợ lý AI thân thiện của Sona Space - chuyên gia nội thất cao cấp. Hỗ trợ khách hàng về sản phẩm, đơn hàng, và dịch vụ.');
```

### 4. Node.js App Setup in cPanel
- **Application Root:** public_html
- **Application URL:** your domain
- **Application Startup File:** app.js
- **Node.js Version:** 16+ (required for Socket.IO)

### 5. Install Dependencies
```bash
cd /home/username/public_html
npm install --production
```

### 6. Environment Variables in cPanel
Add these in Node.js App environment variables:
- NODE_ENV=production
- PORT=3501
- OPENAI_API_KEY=your_key (for chatbot)

### 7. Start Application
Click "Start App" in cPanel Node.js interface

## ✅ Testing Deployment

### API Endpoints:
- GET /api/products
- GET /api/categories  
- POST /api/auth/login
- GET /api/orders (with auth)

### Chatbot Testing:
- WebSocket connection: ws://yourdomain.com/socket.io/
- Events: 'user_message' → 'bot_reply'

### Email Testing:
- Order confirmations
- Return approvals (with coupon)
- Return rejections (with supplier contact)

## 🤖 Chatbot Features

### Real-time Chat:
- Socket.IO connection
- OpenAI GPT-4o-mini integration
- Context-aware responses
- Chat history management

### Admin Configuration:
- Update chatbot_context table to customize AI behavior
- Modify system prompts for specific business needs

### Usage Example:
```javascript
// Frontend integration
const socket = io();
socket.emit('user_message', 'Tôi muốn mua sofa');
socket.on('bot_reply', (response) => {
    console.log(response);
});
```

## 📞 Support & Contact

### Supplier Contact (in rejection emails):
- **Phone:** 0705768791
- **Email:** nguyenhongthai0802@gmail.com
- **Hours:** 8:00-17:00 (Mon-Fri)

### Technical Support:
- **Developer:** nguyenhongthai0802@gmail.com
- **Issues:** Check cPanel error logs
- **Documentation:** This deployment guide

## 🚨 Troubleshooting

### Chatbot Issues:
1. **Bot not responding:**
   - Check OPENAI_API_KEY in .env
   - Verify OpenAI account credits
   - Check chatbot_context table exists

2. **Socket.IO connection failed:**
   - Verify WebSocket support in cPanel
   - Check .htaccess WebSocket configuration
   - Ensure Node.js version 16+

3. **Database errors:**
   - Create chatbot_context table
   - Verify database connection
   - Check table permissions

### Email Issues:
1. **Return rejection emails not sending:**
   - Check EMAIL_USER and EMAIL_PASS
   - Verify Gmail app password
   - Test email service manually

## 🎯 Production Features

✅ **Complete Order Management**
✅ **AI-Powered Chatbot Support**  
✅ **Return/Refund Workflow with Email Notifications**
✅ **Automatic Coupon Generation**
✅ **Professional Email Templates**
✅ **Real-time Customer Support**
✅ **Socket.IO Integration**
✅ **OpenAI GPT Integration**
✅ **Secure API Authentication**
✅ **cPanel Optimized Configuration**

---

**🎉 Ready for Production with AI Chatbot!**
**📅 Built:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**🤖 AI:** OpenAI GPT-4o-mini
**💬 Chat:** Socket.IO Real-time
**📧 Email:** Enhanced notification system
"@

$deployGuidePath = Join-Path $BuildDir "DEPLOYMENT-GUIDE-CHATBOT.md"
$deployGuideContent | Out-File -FilePath $deployGuidePath -Encoding UTF8
Write-Host "  ✅ Created deployment guide with chatbot instructions" -ForegroundColor Green

# Create database setup script
Write-Host "🗄️ Creating database setup script..." -ForegroundColor Yellow
$dbSetupContent = @"
-- SONA SPACE Database Setup for Chatbot
-- Run this SQL script in your cPanel MySQL to add chatbot support

-- Create chatbot_context table if not exists
CREATE TABLE IF NOT EXISTS chatbot_context (
    id INT AUTO_INCREMENT PRIMARY KEY,
    context_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default chatbot context
INSERT INTO chatbot_context (context_text) VALUES 
('Bạn là trợ lý AI thân thiện của Sona Space - chuyên gia nội thất cao cấp. 
Sona Space chuyên cung cấp các sản phẩm nội thất chất lượng cao như sofa, 
bàn ghế, tủ kệ, và phụ kiện trang trí. 

Hỗ trợ khách hàng về:
- Tư vấn sản phẩm nội thất
- Thông tin đơn hàng và giao hàng  
- Chính sách đổi trả và bảo hành
- Hướng dẫn chăm sóc sản phẩm
- Liên hệ: 0705768791 | nguyenhongthai0802@gmail.com

Luôn trả lời một cách thân thiện, chuyên nghiệp và hữu ích.')
ON DUPLICATE KEY UPDATE 
context_text = VALUES(context_text),
updated_at = CURRENT_TIMESTAMP;

-- Verify table creation
SELECT 'Chatbot table created successfully' as status;
SELECT * FROM chatbot_context;
"@

$dbSetupPath = Join-Path $BuildDir "setup-chatbot-database.sql"
$dbSetupContent | Out-File -FilePath $dbSetupPath -Encoding UTF8
Write-Host "  ✅ Created database setup script" -ForegroundColor Green

# Create ZIP file
Write-Host "📦 Creating production ZIP file..." -ForegroundColor Yellow
$zipPath = Join-Path $ProjectDir "SONA_SPACE_CHATBOT_PRODUCTION.zip"
if (Test-Path $zipPath) { 
    Remove-Item $zipPath -Force 
    Write-Host "  🗑️ Removed existing ZIP file" -ForegroundColor Yellow
}

try {
    Compress-Archive -Path "$BuildDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Host "  ✅ Created ZIP file successfully" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to create ZIP: $($_.Exception.Message)" -ForegroundColor Red
}

# Show build summary
Write-Host ""
Write-Host "🎉 BUILD COMPLETED WITH CHATBOT!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host "📁 Build Directory: $BuildDir" -ForegroundColor Yellow
Write-Host "📦 ZIP File: $zipPath" -ForegroundColor Yellow
Write-Host ""

# Show file sizes
$zipSize = if (Test-Path $zipPath) { 
    [math]::Round((Get-Item $zipPath).Length / 1MB, 2) 
} else { 
    "Unknown" 
}
Write-Host "📊 ZIP Size: $zipSize MB" -ForegroundColor Cyan

Write-Host ""
Write-Host "📋 Build Contents:" -ForegroundColor Cyan
Get-ChildItem -Path $BuildDir | ForEach-Object { 
    if ($_.PSIsContainer) {
        $itemCount = (Get-ChildItem -Path $_.FullName -Recurse).Count
        Write-Host "  📁 $($_.Name)/ ($itemCount items)" -ForegroundColor Cyan
    } else {
        $fileSize = [math]::Round($_.Length / 1KB, 1)
        Write-Host "  📄 $($_.Name) ($fileSize KB)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "🤖 NEW FEATURES INCLUDED:" -ForegroundColor Green
Write-Host "  ✅ AI Chatbot with OpenAI GPT-4o-mini" -ForegroundColor White
Write-Host "  ✅ Real-time Socket.IO communication" -ForegroundColor White  
Write-Host "  ✅ Chatbot context management" -ForegroundColor White
Write-Host "  ✅ Enhanced email notifications" -ForegroundColor White
Write-Host "  ✅ Return rejection with supplier contact" -ForegroundColor White
Write-Host "  ✅ Database setup scripts included" -ForegroundColor White

Write-Host ""
Write-Host "📋 DEPLOYMENT CHECKLIST:" -ForegroundColor Yellow
Write-Host "  □ Upload and extract ZIP file" -ForegroundColor White
Write-Host "  □ Run setup-chatbot-database.sql" -ForegroundColor White
Write-Host "  □ Configure .env with OpenAI API key" -ForegroundColor White
Write-Host "  □ Setup Node.js App in cPanel" -ForegroundColor White
Write-Host "  □ Install dependencies: npm install --production" -ForegroundColor White
Write-Host "  □ Start application and test chatbot" -ForegroundColor White

Write-Host ""
Write-Host "🚀 Ready for cPanel deployment with AI Chatbot!" -ForegroundColor Green
Write-Host "📖 See DEPLOYMENT-GUIDE-CHATBOT.md for detailed instructions" -ForegroundColor Yellow
