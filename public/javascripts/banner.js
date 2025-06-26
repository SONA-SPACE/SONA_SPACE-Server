document.addEventListener("DOMContentLoaded", function () {
  let bannerIdToDelete = null;

  // Hàm để lấy danh sách banner từ API
  const fetchBanners = async () => {
    try {
      const response = await fetch("/api/banners");
      if (!response.ok) {
        throw new Error("Không thể lấy dữ liệu banner");
      }

      const banners = await response.json();
      renderBanners(banners);
    } catch (error) {
      console.error("Error fetching banners:", error);
      document.getElementById("banners-list").innerHTML = `
          <tr>
            <td colspan="8" class="text-center text-danger">
              Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.
            </td>
          </tr>
        `;
    }
  };

  // Hàm để hiển thị danh sách banner
  const renderBanners = (banners) => {
    const bannersList = document.getElementById("banners-list");
    bannersList.innerHTML = "";

    if (banners.length === 0) {
      bannersList.innerHTML = `
          <tr>
            <td colspan="8" class="text-center">
              Chưa có banner nào. <a href="/dashboard/banners/add">Thêm banner mới</a>
            </td>
          </tr>
        `;
      return;
    }

    const template = document.getElementById("banner-row-template");

    banners.forEach((banner) => {
      const clone = document.importNode(template.content, true);

      clone.querySelector(".banner-id").textContent = banner.id;
      clone.querySelector(".banner-image").src =
        banner.image_url || "/images/no-image.png";
      clone.querySelector(".banner-title").textContent = banner.title;
      clone.querySelector(".banner-subtitle").textContent =
        banner.subtitle || "";
      clone.querySelector(".banner-link").textContent = banner.link_url || "";
      clone.querySelector(".banner-position").textContent =
        banner.position || 0;

      const statusElement = clone.querySelector(".banner-status");
      if (banner.status === "active") {
        statusElement.innerHTML =
          '<span class="badge badge-success">Hiển thị</span>';
      } else {
        statusElement.innerHTML =
          '<span class="badge badge-secondary">Ẩn</span>';
      }

      const editButton = clone.querySelector(".edit-banner");
      editButton.href = `/dashboard/banners/edit/${banner.id}`;

      const deleteButton = clone.querySelector(".delete-banner");
      deleteButton.addEventListener("click", () => {
        bannerIdToDelete = banner.id;
        $("#delete-banner-modal").modal("show");
      });

      bannersList.appendChild(clone);
    });
  };

  // Xử lý xóa banner
  document
    .getElementById("confirm-delete-banner")
    .addEventListener("click", async () => {
      if (!bannerIdToDelete) return;

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          alert("Bạn cần đăng nhập để thực hiện thao tác này");
          return;
        }

        const response = await fetch(`/api/banners/${bannerIdToDelete}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Không thể xóa banner");
        }

        $("#delete-banner-modal").modal("hide");
        fetchBanners(); // Tải lại danh sách sau khi xóa

        // Hiển thị thông báo thành công
        alert("Xóa banner thành công");
      } catch (error) {
        console.error("Error deleting banner:", error);
        alert("Đã xảy ra lỗi khi xóa banner. Vui lòng thử lại sau.");
      }
    });

  // Tải danh sách banner khi trang được tải
  fetchBanners();
});
