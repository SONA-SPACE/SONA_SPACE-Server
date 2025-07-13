const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");
const fs = require('fs');


exports.sendEmail = async (to, subject, data, templateName) => {
    const templatePath = path.join(__dirname, "../template/otpEmail.ejs");


    console.log(`Đường dẫn template đang được tìm kiếm: ${templatePath}`);
    if (!fs.existsSync(templatePath)) {
        console.error(`LỖI DEBUG: File template KHÔNG TỒN TẠI tại đường dẫn: ${templatePath}`);

        throw new Error(`File template EJS không tìm thấy tại: ${templatePath}. Vui lòng kiểm tra lại tên file và đường dẫn.`);
    }


    let htmlContent;
    try {
        htmlContent = await ejs.renderFile(templatePath, data);
    } catch (ejsError) {
        console.error(`Lỗi khi render template EJS '${templatePath}':`, ejsError);

        throw new Error(`Không thể render template email: ${ejsError.message}`);
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "sonaspace.furniture@gmail.com",
            pass: "ocks ypmy xkiq ykwp",
        },
    });

    const mailOptions = {
        from: "sonaspace.furniture@gmail.com",
        to,
        subject,
        html: htmlContent,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email '${subject}' đã được gửi thành công đến ${to} bằng template ${templatePath}`);
        return true;
    } catch (error) {
        console.error("Lỗi khi gửi email:", error);
        return false;
    }
};
