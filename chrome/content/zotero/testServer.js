/**
 * Simple test script for DeepTutor Localhost Server
 * 
 * This script can be run to test if the localhost server is working on port 3017
 * 
 * @author DeepTutor Team
 * @license GNU Affero General Public License v3.0
 */

"use strict";

/**
 * Test the localhost server functionality
 */
async function testServer() {
	console.log("🧪 Testing DeepTutor Localhost Server on port 3017...");
	
	try {
		// Test 1: Health check
		console.log("\n1️⃣ Testing health endpoint...");
		const healthResponse = await fetch("http://localhost:3017/health");
		if (healthResponse.ok) {
			const healthData = await healthResponse.json();
			console.log("✅ Health check successful:", healthData);
		} else {
			console.log("❌ Health check failed:", healthResponse.status);
			return;
		}
		
		// Test 2: Send text
		console.log("\n2️⃣ Testing sendText endpoint...");
		const testMessage = "Hello from test script! Server is working correctly on port 3017! 🎉";
		const sendResponse = await fetch("http://localhost:3017/sendText", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ text: testMessage })
		});
		
		if (sendResponse.ok) {
			const sendData = await sendResponse.json();
			console.log("✅ Send text successful:", sendData);
			console.log("🎯 Popup should be displayed in DeepTutor!");
		} else {
			console.log("❌ Send text failed:", sendResponse.status);
		}
		
		console.log("\n🎉 All tests completed!");
		
	} catch (error) {
		console.log("❌ Error testing server:", error.message);
		console.log("💡 Make sure DeepTutor is running and the server is started");
	}
}

/**
 * Quick test function that can be called from browser console
 */
function quickTest() {
	testServer().catch(console.error);
}

// Auto-run test if this script is executed directly
if (typeof window !== "undefined") {
	// Browser environment
	console.log("🌐 Browser environment detected");
	console.log("💡 Run quickTest() in the console to test the server");
	
	// Make it available globally
	window.testDeepTutorServer = testServer;
	window.quickTest = quickTest;
} else {
	// Node.js environment
	console.log("🖥️ Node.js environment detected");
	testServer().catch(console.error);
} 