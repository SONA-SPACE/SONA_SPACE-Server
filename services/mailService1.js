const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");

exports.sendEmail1 = async (to, subject, data) => {
  const templatePath = path.join(__dirname, "../template/order.ejs");
  const html = await ejs.renderFile(templatePath, data);
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      // user: process.env.EMAIL_USERNAME,
      // pass: process.env.EMAIL_PASSWORD,
      user: "sonaspace.furniture@gmail.com",
      pass: "ocks ypmy xkiq ykwp",
    },
  });
  const mailOptions = {
    // from: process.env.EMAIL_USERNAME,
    from: "sonaspace.furniture@gmail.com",
    to,
    subject,
    html,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(" Email gửi thành công:", info.response);

    return true;
  } catch (error) {
    console.error(" Lỗi gửi mail:", error.message);
    console.error(" Stack:", error.stack);
    return false;
  }
};
