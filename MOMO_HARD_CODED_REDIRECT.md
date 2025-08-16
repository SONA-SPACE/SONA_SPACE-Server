# MoMo Redirect - Final Solution (Hard-coded)

## 🎯 **Vấn đề:**
MoMo payment vẫn redirect về URL dài với query parameters thay vì redirect trực tiếp đến frontend route.

## ✅ **Giải pháp cuối cùng - Hard-coded URLs:**

### 1. **MoMo Redirect Route (Hard-coded):**
```javascript
router.get("/redirect/momo", (req, res) => {
  const { resultCode, orderId } = req.query;

  if (parseInt(resultCode) === 0) {
    return res.redirect(`https://timefortea.io.vn/dat-hang-thanh-cong/${orderId}`);
  }

  return res.redirect(`https://timefortea.io.vn/`);
});
```

### 2. **Environment Variables được cập nhật:**
```env
API_URL=https://timefortea.io.vn
SITE_URL=https://timefortea.io.vn
```

## 🧪 **Test Case:**
Với URL hiện tại:
```
https://timefortea.io.vn/api/orders/redirect/momo?orderId=SN39119063&resultCode=0&...
```

**Kết quả mong đợi:**
```
https://timefortea.io.vn/dat-hang-thanh-cong/SN39119063
```

## 📦 **Deploy Instructions:**

1. **Upload:** `SONA_SPACE_REDIRECT_FINAL.zip` (20.42 MB)
2. **Extract** và overwrite toàn bộ files
3. **Restart** server
4. **Test** MoMo payment với URL hiện tại

## 🔍 **Debugging Steps nếu vẫn không work:**

### Kiểm tra server logs:
```bash
pm2 logs SONASPACE
```

### Test redirect trực tiếp:
```bash
curl -I "https://timefortea.io.vn/api/orders/redirect/momo?orderId=TEST123&resultCode=0"
```

### Expected Response:
```
HTTP/1.1 302 Found
Location: https://timefortea.io.vn/dat-hang-thanh-cong/TEST123
```

## 🎯 **Lý do hard-code:**
- ✅ Không phụ thuộc environment variables
- ✅ Đảm bảo redirect đúng 100%
- ✅ Không bị ảnh hưởng bởi cấu hình server

---
**File:** `SONA_SPACE_REDIRECT_FINAL.zip`  
**Size:** 20.42 MB  
**Date:** August 16, 2025 01:26  
**Status:** ✅ Hard-coded Redirect - Ready for Production
