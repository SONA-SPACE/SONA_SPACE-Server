
<!-- API Documentation -->
<div class="api-docs">
  <h3>API Documentation - Banner Endpoints</h3>
  
  <div class="api-endpoint">
    <div class="endpoint-title">
      <span class="method get">GET</span>
      <span class="endpoint-url">/api/banners/page/:pageType</span>
    </div>
    <div class="endpoint-description">
      Lấy danh sách banner theo loại trang (page_type)
    </div>
    <div class="code-example">
      // Ví dụ: Lấy banner cho trang chủ
      fetch('/api/banners/page/home')
        .then(response => response.json())
        .then(data => {
          // data là mảng các banner của trang chủ
          console.log(data);
        });
    </div>
  </div>
  
  <div class="api-endpoint">
    <div class="endpoint-title">
      <span class="method get">GET</span>
      <span class="endpoint-url">/api/banners/pages?types=home,san-pham,danh-muc</span>
    </div>
    <div class="endpoint-description">
      Lấy danh sách banner cho nhiều loại trang cùng lúc
    </div>
    <div class="code-example">
      // Ví dụ: Lấy banner cho trang chủ và trang sản phẩm
      fetch('/api/banners/pages?types=home,san-pham')
        .then(response => response.json())
        .then(data => {
          // data là object với key là page_type và value là mảng banner
          const homeBanners = data.home;
          const productBanners = data['san-pham'];
          console.log(homeBanners, productBanners);
        });
    </div>
  </div>
  
  <div class="api-endpoint">
    <div class="endpoint-title">
      <span class="method post">POST</span>
      <span class="endpoint-url">/api/banners/pages</span>
    </div>
    <div class="endpoint-description">
      Lấy danh sách banner cho nhiều loại trang cùng lúc (sử dụng POST)
    </div>
    <div class="code-example">
      // Ví dụ: Lấy banner cho nhiều trang
      fetch('/api/banners/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageTypes: ['home', 'san-pham', 'danh-muc']
        })
      })
        .then(response => response.json())
        .then(data => {
          // Xử lý dữ liệu banner theo từng trang
          console.log(data);
        });
    </div>
  </div>
  
  <div class="api-endpoint">
    <div class="endpoint-title">
      <span class="method get">GET</span>
      <span class="endpoint-url">/api/banners/page-types</span>
    </div>
    <div class="endpoint-description">
      Lấy danh sách tất cả các loại trang có banner
    </div>
    <div class="code-example">
      // Ví dụ: Lấy danh sách các loại trang
      fetch('/api/banners/page-types')
        .then(response => response.json())
        .then(pageTypes => {
          // pageTypes là mảng các page_type
          console.log(pageTypes);
        });
    </div>
  </div>
  
  <h3 class="mt-4">Ví dụ triển khai Slider</h3>
  <div class="api-endpoint">
    <div class="endpoint-description">
      Ví dụ code để tạo slider banner cho trang web
    </div>
    <div class="code-example">
      // HTML cần có
      /*
      <div class="banner-slider" id="homeBannerSlider">
        <!-- Banners sẽ được thêm vào đây -->
      </div>
      */
      
      // JavaScript để tạo slider
      document.addEventListener('DOMContentLoaded', function() {
        // Lấy banner cho trang hiện tại
        const currentPage = 'home'; // Thay đổi theo trang hiện tại
        
        fetch(`/api/banners/page/${currentPage}`)
          .then(response => response.json())
          .then(banners => {
            if (banners.length > 0) {
              createBannerSlider('homeBannerSlider', banners);
            }
          })
          .catch(error => console.error('Error loading banners:', error));
          
        // Hàm tạo slider
        function createBannerSlider(containerId, banners) {
          const container = document.getElementById(containerId);
          if (!container) return;
          
          // Tạo HTML cho slider
          let sliderHTML = `
            <div class="swiper-container">
              <div class="swiper-wrapper">
          `;
          
          // Thêm các slide
          banners.forEach(banner => {
            sliderHTML += `
              <div class="swiper-slide">
                <a href="${banner.link_url || '#'}" class="banner-link">
                  <img src="${banner.image_url}" alt="${banner.title}" class="banner-image">
                  <div class="banner-content">
                    <h2 class="banner-title">${banner.title}</h2>
                    ${banner.subtitle ? `<p class="banner-subtitle">${banner.subtitle}</p>` : ''}
                  </div>
                </a>
              </div>
            `;
          });
          
          // Đóng container và thêm điều hướng + phân trang
          sliderHTML += `
              </div>
              <div class="swiper-pagination"></div>
              <div class="swiper-button-next"></div>
              <div class="swiper-button-prev"></div>
            </div>
          `;
          
          // Thêm HTML vào container
          container.innerHTML = sliderHTML;
          
          // Khởi tạo Swiper (cần thêm thư viện Swiper)
          new Swiper('.swiper-container', {
            loop: true,
            autoplay: {
              delay: 5000,
              disableOnInteraction: false,
            },
            pagination: {
              el: '.swiper-pagination',
              clickable: true,
            },
            navigation: {
              nextEl: '.swiper-button-next',
              prevEl: '.swiper-button-prev',
            },
          });
        }
      });
    </div>
  </div>
  
  <div class="api-endpoint">
    <div class="endpoint-description">
      Ví dụ triển khai nhiều slider cho các vị trí khác nhau trên trang
    </div>
    <div class="code-example">
      // Lấy banner cho nhiều vị trí cùng lúc
      document.addEventListener('DOMContentLoaded', function() {
        // Định nghĩa các vị trí cần banner
        const pageTypes = ['home', 'danh-muc', 'san-pham'];
        
        fetch(`/api/banners/pages?types=${pageTypes.join(',')}`)
          .then(response => response.json())
          .then(data => {
            // Tạo slider cho từng vị trí
            Object.keys(data).forEach(pageType => {
              const banners = data[pageType];
              if (banners.length > 0) {
                // ID container tương ứng với từng vị trí
                const containerId = `${pageType}BannerSlider`;
                createBannerSlider(containerId, banners);
              }
            });
          })
          .catch(error => console.error('Error loading banners:', error));
      });
    </div>
  </div>
</div>