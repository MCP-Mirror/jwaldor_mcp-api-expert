import { makeRequest } from "./index.js";
async function runTests() {
    console.log("Starting tests for makeRequest function...\n");
    // Test 1: Successful GET request
    console.log("Test 1: Testing successful GET request to Oura Ring API");
    try {
        const result = await makeRequest("https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2024-12-02&end_date=2024-12-11", "GET", {
            Authorization: `Bearer ${process.env.OURA_API_KEY}`,
        }, {});
        if (result) {
            console.log("✅ Test 1 passed: Received response from API");
            console.log("Response:", JSON.stringify(result, null, 2));
        }
        else {
            console.log("❌ Test 1 failed: No response received");
        }
    }
    catch (error) {
        console.log("❌ Test 1 failed with error:", error);
    }
    // Test 2: Invalid API key
    console.log("\nTest 2: Testing with invalid API key");
    //   try {
    //     const result = await makeRequest(
    //       "https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2024-12-02&end_date=2024-12-11",
    //       "GET",
    //       {
    //         Authorization: "Bearer invalid_key",
    //       },
    //       {}
    //     );
    //     if (result === null) {
    //       console.log("✅ Test 2 passed: Properly handled invalid API key");
    //     } else {
    //       console.log(
    //         "❌ Test 2 failed: Should have returned null for invalid API key"
    //       );
    //     }
    //   } catch (error) {
    //     console.log("❌ Test 2 failed with unexpected error:", error);
    //   }
    console.log("\nTests completed!");
}
// Run the tests
runTests().catch((error) => {
    console.error("Error running tests:", error);
    process.exit(1);
});
