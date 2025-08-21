const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");

exports.sendEmail = async (to, subject, data, templateName) => {
    const templatePath = path.join(__dirname, `../template/${templateName}.ejs`);

    let htmlContent;
    try {
        htmlContent = await ejs.renderFile(templatePath, data);
    } catch (ejsError) {
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
        return true;
    } catch (error) {
        return false;
    }
};
