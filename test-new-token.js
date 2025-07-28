console.log("Getting new token via login...");

const getNewToken = async () => {
  try {
    // Thử với admin e.hoang@gmail.com
    const response = await fetch("http://localhost:3501/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "e.hoang@gmail.com",
        password: "123456"
      })
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (!data.token) {
      // Thử với nguyenhongthai0802@gmail.com
      console.log("\nThử với admin khác...");
      const response2 = await fetch("http://localhost:3501/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: "nguyenhongthai0802@gmail.com",
          password: "Admin123!"
        })
      });

      const data2 = await response2.json();
      console.log("Status 2:", response2.status);
      console.log("Response 2:", JSON.stringify(data2, null, 2));
    }

    const token = data.token || data2?.token;
    if (token) {
      console.log("\nNew token:", token);
      
      // Test ngay với token mới
      const testResponse = await fetch("http://localhost:3501/api/orders/test-auth", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const testData = await testResponse.text();
      console.log("\nTest auth with new token:");
      console.log("Status:", testResponse.status);
      console.log("Response:", testData);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
};

getNewToken();
