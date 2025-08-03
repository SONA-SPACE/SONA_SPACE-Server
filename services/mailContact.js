const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");

exports.sendEmailFromCustomer = async (from, subject, data, templateName) => {
  const templatePath = path.join(__dirname, `../template/${templateName}.ejs`);

  let htmlContent;
  try {
    htmlContent = await ejs.renderFile(templatePath, data);
  } catch (ejsError) {
    console.error(
      `Lỗi khi render template EJS '${templateName}.ejs':`,
      ejsError
    );
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
    from,
    to: "sonaspace.furniture@gmail.com",
    subject,
    replyTo: from,
    text: "Yêu cầu hỗ trợ từ khách hàng",
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(
      `Khách hàng '${from}' đã gửi email với tiêu đề '${subject}' đến SonaSpace bằng template ${templateName}.ejs`
    );
    return true;
  } catch (error) {
    console.error("Lỗi khi gửi email từ khách hàng:", error);
    return false;
  }
};
