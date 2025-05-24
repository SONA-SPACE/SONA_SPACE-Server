const db = require('./config/database');
const express = require('express');
const app = express();

// Import the categories router
const categoriesRouter = require('./routes/categories');

// Set up middleware for testing
app.use(express.json());

// Mount the router at a test endpoint
app.use('/test-categories', categoriesRouter);

// Create a test request and response
const mockRequest = {
  params: {},
  query: {}
};

// Create a mock response object
const mockResponse = {
  status: function(code) {
    console.log(`Response status: ${code}`);
    return this;
  },
  json: function(data) {
    console.log('Response data:', JSON.stringify(data, null, 2));
    return this;
  }
};

async function debugCategoryRoute() {
  try {
    console.log("=== Debugging Category Route ===");
    
    // Test direct SQL query first
    console.log("\n1. Testing direct SQL query:");
    try {
      const sql = `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
        FROM category c
        ORDER BY c.category_name ASC
      `;
      
      console.log("SQL Query:", sql);
      const [categories] = await db.query(sql);
      console.log(`Query successful: Found ${categories.length} categories`);
      if (categories.length > 0) {
        console.log("First category sample:", categories[0]);
      }
    } catch (error) {
      console.error("Database query error:", error);
      console.error("SQL Error Code:", error.code);
      console.error("SQL Error Message:", error.message);
      console.error("SQL Error State:", error.sqlState);
    }
    
    // Check DB connection status
    console.log("\n2. Verifying database connection:");
    try {
      const connection = await db.getConnection();
      console.log("Database connection successful");
      connection.release();
    } catch (error) {
      console.error("Database connection error:", error);
    }
    
    // Try to execute the route handler directly
    console.log("\n3. Testing route handler directly:");
    try {
      // Get the route handler for GET /
      const router = categoriesRouter.stack.find(layer => 
        layer.route && layer.route.path === '/' && layer.route.methods.get
      );
      
      if (router && router.route && router.route.stack) {
        const handler = router.route.stack[0].handle;
        console.log("Found GET / route handler, executing...");
        
        // Execute the handler with mock request/response
        await handler(mockRequest, mockResponse);
      } else {
        console.log("Could not find the GET / route handler");
      }
    } catch (error) {
      console.error("Error executing route handler:", error);
    }
    
    console.log("\n=== Debug Complete ===");
  } catch (error) {
    console.error("Debug process failed:", error);
  } finally {
    // Don't close the connection so we can inspect the results
    setTimeout(() => {
      console.log("\nClosing database connection...");
      db.end();
    }, 1000);
  }
}

debugCategoryRoute(); 