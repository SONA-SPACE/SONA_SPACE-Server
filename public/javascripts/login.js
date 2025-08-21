document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");
  const togglePassword = document.getElementById("togglePassword");

  const patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // kiểm tra định dạng email chuẩn
    password:
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+={}[\]\\|:;'",.<>/?])[A-Za-z\d!@#$%^&*()_\-+={}[\]\\|:;'",.<>/?]{8,}$/, // ít nhất 1 chữ hoa, thường, số, ký tự đặc biệt
  };

  const messages = {
    email: {
      required: "Vui lòng nhập địa chỉ email",
      invalid: "Email không hợp lệ. Vui lòng nhập đúng định dạng",
      spaces: "Email không được chứa dấu cách",
    },
    password: {
      required: "Vui lòng nhập mật khẩu",
      minLength: "Mật khẩu phải có ít nhất 8 ký tự",
      uppercase: "Mật khẩu phải chứa ít nhất 1 chữ cái in hoa",
      lowercase: "Mật khẩu phải chứa ít nhất 1 chữ cái thường",
      number: "Mật khẩu phải chứa ít nhất 1 chữ số",
      special: "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt",
      spaces: "Mật khẩu không được chứa dấu cách",
    },
  };

  function validateEmail() {
    const email = emailInput.value.trim();

    emailInput.classList.remove("is-valid", "is-invalid");
    emailError.textContent = "";

    if (!email) {
      emailInput.classList.add("is-invalid");
      emailError.textContent = messages.email.required;
      return false;
    }

    if (email.includes(" ")) {
      emailInput.classList.add("is-invalid");
      emailError.textContent = messages.email.spaces;
      return false;
    }

    if (!patterns.email.test(email)) {
      emailInput.classList.add("is-invalid");
      emailError.textContent = messages.email.invalid;
      return false;
    }

    emailInput.classList.add("is-valid");
    return true;
  }

  function validatePassword() {
    const password = passwordInput.value;

    passwordInput.classList.remove("is-valid", "is-invalid");
    passwordError.textContent = "";

    if (!password) {
      passwordInput.classList.add("is-invalid");
      passwordError.textContent = messages.password.required;
      return false;
    }

    if (password.includes(" ")) {
      passwordInput.classList.add("is-invalid");
      passwordError.textContent = messages.password.spaces;
      return false;
    }

    if (password.length < 8) {
      passwordInput.classList.add("is-invalid");
      passwordError.textContent = messages.password.minLength;
      return false;
    }

    if (!/[A-Z]/.test(password)) {
      passwordInput.classList.add("is-invalid");
      passwordError.textContent = messages.password.uppercase;
      return false;
    }

    if (!/[a-z]/.test(password)) {
      passwordInput.classList.add("is-invalid");
      passwordError.textContent = messages.password.lowercase;
      return false;
    }

    if (!/\d/.test(password)) {
      passwordInput.classList.add("is-invalid");
      passwordError.textContent = messages.password.number;
      return false;
    }

    if (!/[!@#$%^&*()_\-+={}[\]\\|:;'",.<>/?]/.test(password)) {
      passwordInput.classList.add("is-invalid");
      passwordError.textContent = messages.password.special;
      return false;
    }

    passwordInput.classList.add("is-valid");
    return true;
  }

  emailInput.addEventListener("input", function () {
    validateEmail();
  });

  passwordInput.addEventListener("input", function () {
    validatePassword();
  });

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();

    if (isEmailValid && isPasswordValid) {
    }
  });
});
