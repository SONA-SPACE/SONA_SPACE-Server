const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsImVtYWlsIjoibmd1eWVuaG9uZ3RoYWkwODAyQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczMTg0MTY1NiwiZXhwIjoxNzM5NjE3NjU2fQ.PtWzQHGMw4cQoswJXAH8U0xvPNJGvdyMwDbXf4cQd10";

console.log("Testing middleware with token:", token.substring(0, 20) + "...");

const testMiddleware = async () => {
  try {
    const response = await fetch("http://localhost:3501/api/orders/test-auth", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (error) {
    console.error("Error:", error.message);
  }
};

testMiddleware();
