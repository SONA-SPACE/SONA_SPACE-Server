const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/", async (req, res) => {
    const sql =
        "SELECT material_id, material_name, slug, created_at FROM materials ORDER BY created_at DESC";
    try {
        const [results] = await db.query(sql);
        res.status(200).json({ success: true, materials: results });
    } catch (err) {
        console.error("Error fetching materials:", err);
        res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy danh sách vật liệu.",
        });
    }
});

router.get("/:slug", async (req, res) => {
    const { slug } = req.params;

    const sql =
        "SELECT material_id, material_name, slug, created_at FROM materials WHERE slug = ?";
    try {
        const [results] = await db.query(sql, [slug]);
        if (results.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: "Vật liệu không tìm thấy." });
        }
        res.status(200).json({ success: true, material: results[0] });
    } catch (err) {
        console.error("Error fetching material by SLUG:", err);
        res
            .status(500)
            .json({ success: false, message: "Lỗi máy chủ khi lấy vật liệu." });
    }
});

router.post("/", async (req, res) => {
    const { material_name, slug } = req.body;

    if (!material_name || !slug) {
        return res
            .status(400)
            .json({ success: false, message: "Tên vật liệu và slug là bắt buộc." });
    }

    const sql = "INSERT INTO materials (material_name, slug) VALUES (?, ?)";
    try {
        const [result] = await db.query(sql, [material_name, slug]);

        res.status(201).json({
            success: true,
            message: "Vật liệu đã được thêm thành công.",
            material: {
                material_id: result.insertId,
                material_name,
                slug,
                created_at: new Date(),
            },
        });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Slug hoặc tên vật liệu đã tồn tại.",
            });
        }
        console.error("Error adding new material:", err);
        res
            .status(500)
            .json({ success: false, message: "Lỗi máy chủ khi thêm vật liệu mới." });
    }
});

router.put("/:slug", async (req, res) => {
    const oldSlug = req.params.slug;
    const { material_name, slug: newSlug } = req.body;
    if (!material_name || !newSlug) {
        return res.status(400).json({
            success: false,
            message: "Tên vật liệu và slug mới là bắt buộc.",
        });
    }

    try {
        const [materialToUpdate] = await db.query(
            "SELECT material_id FROM materials WHERE slug = ?",
            [oldSlug]
        );
        if (materialToUpdate.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Vật liệu không tìm thấy để cập nhật.",
            });
        }
        const material_id = materialToUpdate[0].material_id;
        const updateSql =
            "UPDATE materials SET material_name = ?, slug = ? WHERE material_id = ?";
        const [result] = await db.query(updateSql, [
            material_name,
            newSlug,
            material_id,
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Vật liệu không tìm thấy hoặc không có thay đổi để cập nhật.",
            });
        }
        res.status(200).json({
            success: true,
            message: "Vật liệu đã được cập nhật thành công.",
        });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Slug mới đã tồn tại cho một vật liệu khác.",
            });
        }
        console.error("Error updating material:", err);
        res
            .status(500)
            .json({ success: false, message: "Lỗi máy chủ khi cập nhật vật liệu." });
    }
});

router.delete("/:slug", async (req, res) => {
    const { slug } = req.params;

    const sql = "DELETE FROM materials WHERE slug = ?";
    try {
        const [result] = await db.query(sql, [slug]);
        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ success: false, message: "Vật liệu không tìm thấy để xóa." });
        }
        res
            .status(200)
            .json({ success: true, message: "Vật liệu đã được xóa thành công." });
    } catch (err) {
        console.error("Error deleting material:", err);
        res
            .status(500)
            .json({ success: false, message: "Lỗi máy chủ khi xóa vật liệu." });
    }
});

module.exports = router;
