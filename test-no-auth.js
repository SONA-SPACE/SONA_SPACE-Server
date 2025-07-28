console.log("Testing no-auth endpoint...");

const testNoAuth = async () => {
  try {
    const response = await fetch("http://localhost:3501/api/orders/test-no-auth", {
      method: "GET"
    });

    const data = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (error) {
    console.error("Error:", error.message);
  }
};

testNoAuth();
