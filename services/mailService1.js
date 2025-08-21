const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");

// Load environment variables if not already loaded
if (!process.env.EMAIL_USER) {
  require('dotenv').config();
}

exports.sendEmail1 = async (to, subject, data, templateType = 'order') => {
  let templatePath;
  
  // Chọn template dựa trên loại email
  switch (templateType) {
    case 'apology':
      templatePath = path.join(__dirname, "../template/apology.ejs");
      break;
    case 'order-failed':
      templatePath = path.join(__dirname, "../template/orderfailed.ejs");
      break;
    case 'return-approved':
      templatePath = path.join(__dirname, "../template/return-approved.ejs");
      break;
    case 'return-rejected':
      templatePath = path.join(__dirname, "../template/return-rejected.ejs");
      break;
    case 'order':
    default:
      templatePath = path.join(__dirname, "../template/order.ejs");
      break;
  }

  const html = await ejs.renderFile(templatePath, data);
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "sonaspace.furniture@gmail.com",
      pass: process.env.EMAIL_PASS || "rndo lwgk rvqu bqpj",
    },
  });
  const mailOptions = {
    from: process.env.EMAIL_USER || "sonaspace.furniture@gmail.com",
    to,
    subject,
    html,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, info };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
