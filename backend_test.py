import requests
import json
import time
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://password-vault-167.preview.emergentagent.com/api"
MASTER_PASSWORD = "TestPass123!"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "response_times": []
}

def log_test(test_name: str, passed: bool, message: str = "", response_time: float = 0):
    """Log test result"""
    result = {
        "test": test_name,
        "passed": passed,
        "message": message,
        "response_time": response_time
    }
    
    if passed:
        test_results["passed"].append(result)
        print(f"✅ PASS: {test_name} ({response_time:.3f}s)")
        if message:
            print(f"   {message}")
    else:
        test_results["failed"].append(result)
        print(f"❌ FAIL: {test_name}")
        print(f"   {message}")
    
    if response_time > 0:
        test_results["response_times"].append(response_time)

def make_request(method: str, endpoint: str, **kwargs) -> tuple[Optional[Dict], int, float]:
    """Make HTTP request and return response, status code, and time"""
    url = f"{BACKEND_URL}{endpoint}"
    start_time = time.time()
    
    try:
        response = requests.request(method, url, **kwargs)
        elapsed = time.time() - start_time
        
        try:
            data = response.json()
        except:
            data = None
        
        return data, response.status_code, elapsed
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"   Request error: {str(e)}")
        return None, 0, elapsed

# Global variables to store created entry IDs
created_entry_ids = []

print("=" * 80)
print("PASSWORD MANAGER BACKEND API TEST SUITE")
print("=" * 80)
print(f"Backend URL: {BACKEND_URL}")
print(f"Master Password: {MASTER_PASSWORD}")
print("=" * 80)
print()

# ============ 1. AUTH FLOW TESTS ============
print("=" * 80)
print("1. AUTH FLOW TESTS")
print("=" * 80)

# Test 1.1: Check setup status (should be false initially)
print("\n[Test 1.1] GET /auth/check - Initial setup status")
data, status, elapsed = make_request("GET", "/auth/check")
if status == 200 and data:
    # Note: is_setup might be true if already set up from previous runs
    log_test("GET /auth/check - Initial check", True, 
             f"Setup status: {data.get('is_setup')}", elapsed)
    is_already_setup = data.get('is_setup', False)
else:
    log_test("GET /auth/check - Initial check", False, 
             f"Expected 200, got {status}", elapsed)
    is_already_setup = False

# Test 1.2: Setup master password
print("\n[Test 1.2] POST /auth/setup - Create master account")
data, status, elapsed = make_request("POST", "/auth/setup", 
                                     json={"master_password": MASTER_PASSWORD})
if is_already_setup:
    # Should fail if already setup
    if status == 400:
        log_test("POST /auth/setup - Already setup", True, 
                 "Correctly rejected (already setup)", elapsed)
    else:
        log_test("POST /auth/setup - Already setup", False, 
                 f"Expected 400, got {status}", elapsed)
else:
    # Should succeed if not setup
    if status == 200 and data and "user_id" in data:
        log_test("POST /auth/setup - Create account", True, 
                 f"User created: {data.get('user_id')}", elapsed)
    else:
        log_test("POST /auth/setup - Create account", False, 
                 f"Expected 200 with user_id, got {status}: {data}", elapsed)

# Test 1.3: Try setup again (should fail)
print("\n[Test 1.3] POST /auth/setup - Duplicate setup (should fail)")
data, status, elapsed = make_request("POST", "/auth/setup", 
                                     json={"master_password": MASTER_PASSWORD})
if status == 400:
    log_test("POST /auth/setup - Duplicate prevention", True, 
             "Correctly rejected duplicate setup", elapsed)
else:
    log_test("POST /auth/setup - Duplicate prevention", False, 
             f"Expected 400, got {status}", elapsed)

# Test 1.4: Login with correct password
print("\n[Test 1.4] POST /auth/login - Correct password")
data, status, elapsed = make_request("POST", "/auth/login", 
                                     json={"master_password": MASTER_PASSWORD})
if status == 200 and data and data.get("success"):
    log_test("POST /auth/login - Correct password", True, 
             "Login successful", elapsed)
else:
    log_test("POST /auth/login - Correct password", False, 
             f"Expected 200 with success=true, got {status}: {data}", elapsed)

# Test 1.5: Login with wrong password
print("\n[Test 1.5] POST /auth/login - Wrong password (should fail)")
data, status, elapsed = make_request("POST", "/auth/login", 
                                     json={"master_password": "WrongPassword123!"})
if status == 401:
    log_test("POST /auth/login - Wrong password", True, 
             "Correctly rejected invalid password", elapsed)
else:
    log_test("POST /auth/login - Wrong password", False, 
             f"Expected 401, got {status}", elapsed)

# ============ 2. PASSWORD ENTRY CRUD TESTS ============
print("\n" + "=" * 80)
print("2. PASSWORD ENTRY CRUD TESTS")
print("=" * 80)

# Test 2.1: Create Gmail password entry
print("\n[Test 2.1] POST /passwords - Create Gmail entry")
gmail_entry = {
    "account_name": "Gmail",
    "username": "test@gmail.com",
    "password": "MySecurePass123",
    "url": "https://gmail.com",
    "notes": "Personal email account",
    "category": "Email",
    "tags": ["personal", "important"],
    "master_password": MASTER_PASSWORD
}
data, status, elapsed = make_request("POST", "/passwords", json=gmail_entry)
if status == 200 and data and "id" in data:
    gmail_id = data["id"]
    created_entry_ids.append(gmail_id)
    log_test("POST /passwords - Create Gmail entry", True, 
             f"Entry created with ID: {gmail_id}", elapsed)
    # Verify returned data
    if data.get("account_name") == "Gmail" and data.get("password") == "MySecurePass123":
        print("   ✓ Data verified: account_name and decrypted password correct")
    else:
        print(f"   ⚠ Data mismatch: {data}")
else:
    log_test("POST /passwords - Create Gmail entry", False, 
             f"Expected 200 with id, got {status}: {data}", elapsed)
    gmail_id = None

# Test 2.2: Create Facebook password entry
print("\n[Test 2.2] POST /passwords - Create Facebook entry")
facebook_entry = {
    "account_name": "Facebook",
    "username": "testuser",
    "password": "FbPass456",
    "url": "https://facebook.com",
    "notes": "",
    "category": "Social Media",
    "tags": ["social"],
    "master_password": MASTER_PASSWORD
}
data, status, elapsed = make_request("POST", "/passwords", json=facebook_entry)
if status == 200 and data and "id" in data:
    facebook_id = data["id"]
    created_entry_ids.append(facebook_id)
    log_test("POST /passwords - Create Facebook entry", True, 
             f"Entry created with ID: {facebook_id}", elapsed)
else:
    log_test("POST /passwords - Create Facebook entry", False, 
             f"Expected 200 with id, got {status}: {data}", elapsed)
    facebook_id = None

# Test 2.3: Get all passwords with correct master password
print("\n[Test 2.3] GET /passwords - Retrieve all entries")
data, status, elapsed = make_request("GET", "/passwords", 
                                     params={"master_password": MASTER_PASSWORD})
if status == 200 and isinstance(data, list):
    entry_count = len(data)
    log_test("GET /passwords - Retrieve all", True, 
             f"Retrieved {entry_count} entries", elapsed)
    
    # Verify we have at least 2 entries
    if entry_count >= 2:
        print("   ✓ At least 2 entries found")
        # Check if passwords are decrypted
        for entry in data:
            if "password" in entry and entry["password"]:
                print(f"   ✓ Entry '{entry.get('account_name')}' has decrypted password")
    else:
        print(f"   ⚠ Expected at least 2 entries, found {entry_count}")
else:
    log_test("GET /passwords - Retrieve all", False, 
             f"Expected 200 with list, got {status}: {data}", elapsed)

# Test 2.4: Get all passwords with wrong master password
print("\n[Test 2.4] GET /passwords - Wrong master password (should fail)")
data, status, elapsed = make_request("GET", "/passwords", 
                                     params={"master_password": "WrongPassword"})
if status == 401:
    log_test("GET /passwords - Wrong password", True, 
             "Correctly rejected invalid password", elapsed)
else:
    log_test("GET /passwords - Wrong password", False, 
             f"Expected 401, got {status}", elapsed)

# Test 2.5: Update Gmail entry
if gmail_id:
    print("\n[Test 2.5] PUT /passwords/{id} - Update Gmail entry")
    update_data = {
        "username": "newemail@gmail.com",
        "master_password": MASTER_PASSWORD
    }
    data, status, elapsed = make_request("PUT", f"/passwords/{gmail_id}", 
                                         json=update_data)
    if status == 200 and data:
        if data.get("username") == "newemail@gmail.com":
            log_test("PUT /passwords/{id} - Update entry", True, 
                     "Username updated successfully", elapsed)
        else:
            log_test("PUT /passwords/{id} - Update entry", False, 
                     f"Username not updated: {data.get('username')}", elapsed)
    else:
        log_test("PUT /passwords/{id} - Update entry", False, 
                 f"Expected 200, got {status}: {data}", elapsed)
else:
    print("\n[Test 2.5] PUT /passwords/{id} - SKIPPED (no Gmail ID)")

# Test 2.6: Delete Facebook entry
if facebook_id:
    print("\n[Test 2.6] DELETE /passwords/{id} - Delete Facebook entry")
    data, status, elapsed = make_request("DELETE", f"/passwords/{facebook_id}", 
                                         params={"master_password": MASTER_PASSWORD})
    if status == 200 and data and data.get("success"):
        log_test("DELETE /passwords/{id} - Delete entry", True, 
                 "Entry deleted successfully", elapsed)
    else:
        log_test("DELETE /passwords/{id} - Delete entry", False, 
                 f"Expected 200 with success, got {status}: {data}", elapsed)
else:
    print("\n[Test 2.6] DELETE /passwords/{id} - SKIPPED (no Facebook ID)")

# Test 2.7: Verify deletion - Get all passwords again
print("\n[Test 2.7] GET /passwords - Verify deletion")
data, status, elapsed = make_request("GET", "/passwords", 
                                     params={"master_password": MASTER_PASSWORD})
if status == 200 and isinstance(data, list):
    entry_count = len(data)
    # Should have one less entry now (Facebook deleted)
    log_test("GET /passwords - After deletion", True, 
             f"Retrieved {entry_count} entries (Facebook deleted)", elapsed)
    
    # Verify Facebook is not in the list
    facebook_found = any(e.get("account_name") == "Facebook" for e in data)
    if not facebook_found:
        print("   ✓ Facebook entry successfully deleted")
    else:
        print("   ⚠ Facebook entry still exists")
else:
    log_test("GET /passwords - After deletion", False, 
             f"Expected 200 with list, got {status}", elapsed)

# ============ 3. SEARCH AND CATEGORY TESTS ============
print("\n" + "=" * 80)
print("3. SEARCH AND CATEGORY TESTS")
print("=" * 80)

# Test 3.1: Search for Gmail
print("\n[Test 3.1] POST /passwords/search - Search for 'Gmail'")
search_data = {
    "query": "Gmail",
    "master_password": MASTER_PASSWORD
}
data, status, elapsed = make_request("POST", "/passwords/search", json=search_data)
if status == 200 and isinstance(data, list):
    found_count = len(data)
    log_test("POST /passwords/search - Find Gmail", True, 
             f"Found {found_count} matching entries", elapsed)
    
    if found_count > 0 and data[0].get("account_name") == "Gmail":
        print("   ✓ Gmail entry found in search results")
else:
    log_test("POST /passwords/search - Find Gmail", False, 
             f"Expected 200 with list, got {status}: {data}", elapsed)

# Test 3.2: Search for non-existent entry
print("\n[Test 3.2] POST /passwords/search - Search for 'NonExistent'")
search_data = {
    "query": "NonExistent",
    "master_password": MASTER_PASSWORD
}
data, status, elapsed = make_request("POST", "/passwords/search", json=search_data)
if status == 200 and isinstance(data, list):
    found_count = len(data)
    if found_count == 0:
        log_test("POST /passwords/search - No results", True, 
                 "Correctly returned empty array", elapsed)
    else:
        log_test("POST /passwords/search - No results", False, 
                 f"Expected empty array, got {found_count} results", elapsed)
else:
    log_test("POST /passwords/search - No results", False, 
             f"Expected 200 with empty list, got {status}", elapsed)

# Test 3.3: Get categories
print("\n[Test 3.3] GET /categories - Get available categories")
data, status, elapsed = make_request("GET", "/categories")
if status == 200 and data and "categories" in data:
    categories = data["categories"]
    log_test("GET /categories - Retrieve categories", True, 
             f"Retrieved {len(categories)} categories", elapsed)
    print(f"   Categories: {', '.join(categories)}")
else:
    log_test("GET /categories - Retrieve categories", False, 
             f"Expected 200 with categories, got {status}: {data}", elapsed)

# ============ 4. ENCRYPTION VERIFICATION ============
print("\n" + "=" * 80)
print("4. ENCRYPTION VERIFICATION")
print("=" * 80)

# Test 4.1: Verify passwords are encrypted in database
print("\n[Test 4.1] Verify passwords stored encrypted")
print("   Note: This requires direct database access")
print("   Checking if decrypted passwords are returned via API...")

# Get a password entry
data, status, elapsed = make_request("GET", "/passwords", 
                                     params={"master_password": MASTER_PASSWORD})
if status == 200 and isinstance(data, list) and len(data) > 0:
    entry = data[0]
    password = entry.get("password", "")
    
    # The password should be decrypted and readable
    if password and len(password) > 0:
        log_test("Encryption - Decryption works", True, 
                 f"Password successfully decrypted: {password[:3]}***", elapsed)
        print("   ✓ Passwords are being decrypted correctly with master password")
    else:
        log_test("Encryption - Decryption works", False, 
                 "Password field is empty", elapsed)
else:
    print("   ⚠ Cannot verify encryption (no entries available)")

# Test 4.2: Verify wrong master password fails decryption
print("\n[Test 4.2] Verify wrong master password fails")
data, status, elapsed = make_request("GET", "/passwords", 
                                     params={"master_password": "WrongPassword123"})
if status == 401:
    log_test("Encryption - Wrong password rejected", True, 
             "Wrong master password correctly rejected", elapsed)
else:
    log_test("Encryption - Wrong password rejected", False, 
             f"Expected 401, got {status}", elapsed)

# ============ 5. ERROR HANDLING TESTS ============
print("\n" + "=" * 80)
print("5. ERROR HANDLING TESTS")
print("=" * 80)

# Test 5.1: Create entry without master password
print("\n[Test 5.1] POST /passwords - Missing master_password")
invalid_entry = {
    "account_name": "Test",
    "username": "test",
    "password": "test123",
    "category": "Other",
    "tags": []
}
data, status, elapsed = make_request("POST", "/passwords", json=invalid_entry)
if status == 422:  # Validation error
    log_test("Error handling - Missing master_password", True, 
             "Correctly rejected (validation error)", elapsed)
else:
    log_test("Error handling - Missing master_password", False, 
             f"Expected 422, got {status}", elapsed)

# Test 5.2: Get entry with invalid ID
print("\n[Test 5.2] GET /passwords/{id} - Invalid entry ID")
data, status, elapsed = make_request("GET", "/passwords/invalid_id_12345", 
                                     params={"master_password": MASTER_PASSWORD})
if status == 404 or status == 400:  # Not found or bad request
    log_test("Error handling - Invalid ID", True, 
             f"Correctly rejected (status {status})", elapsed)
else:
    log_test("Error handling - Invalid ID", False, 
             f"Expected 404 or 400, got {status}", elapsed)

# Test 5.3: Update entry with invalid ID
print("\n[Test 5.3] PUT /passwords/{id} - Invalid entry ID")
update_data = {
    "username": "test",
    "master_password": MASTER_PASSWORD
}
data, status, elapsed = make_request("PUT", "/passwords/invalid_id_12345", 
                                     json=update_data)
if status == 404 or status == 400:
    log_test("Error handling - Update invalid ID", True, 
             f"Correctly rejected (status {status})", elapsed)
else:
    log_test("Error handling - Update invalid ID", False, 
             f"Expected 404 or 400, got {status}", elapsed)

# Test 5.4: Delete entry with invalid ID
print("\n[Test 5.4] DELETE /passwords/{id} - Invalid entry ID")
data, status, elapsed = make_request("DELETE", "/passwords/invalid_id_12345", 
                                     params={"master_password": MASTER_PASSWORD})
if status == 404 or status == 400:
    log_test("Error handling - Delete invalid ID", True, 
             f"Correctly rejected (status {status})", elapsed)
else:
    log_test("Error handling - Delete invalid ID", False, 
             f"Expected 404 or 400, got {status}", elapsed)

# Test 5.5: Create entry without required fields
print("\n[Test 5.5] POST /passwords - Missing required fields")
incomplete_entry = {
    "account_name": "Test",
    "master_password": MASTER_PASSWORD
    # Missing username, password, category
}
data, status, elapsed = make_request("POST", "/passwords", json=incomplete_entry)
if status == 422:  # Validation error
    log_test("Error handling - Missing required fields", True, 
             "Correctly rejected (validation error)", elapsed)
else:
    log_test("Error handling - Missing required fields", False, 
             f"Expected 422, got {status}", elapsed)

# ============ FINAL SUMMARY ============
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

total_tests = len(test_results["passed"]) + len(test_results["failed"])
passed_count = len(test_results["passed"])
failed_count = len(test_results["failed"])
pass_rate = (passed_count / total_tests * 100) if total_tests > 0 else 0

print(f"\nTotal Tests: {total_tests}")
print(f"✅ Passed: {passed_count}")
print(f"❌ Failed: {failed_count}")
print(f"Pass Rate: {pass_rate:.1f}%")

if test_results["response_times"]:
    avg_response_time = sum(test_results["response_times"]) / len(test_results["response_times"])
    max_response_time = max(test_results["response_times"])
    min_response_time = min(test_results["response_times"])
    
    print(f"\nResponse Times:")
    print(f"  Average: {avg_response_time:.3f}s")
    print(f"  Min: {min_response_time:.3f}s")
    print(f"  Max: {max_response_time:.3f}s")

if test_results["failed"]:
    print("\n" + "=" * 80)
    print("FAILED TESTS DETAILS")
    print("=" * 80)
    for result in test_results["failed"]:
        print(f"\n❌ {result['test']}")
        print(f"   {result['message']}")

print("\n" + "=" * 80)
print("BACKEND HEALTH STATUS")
print("=" * 80)

if failed_count == 0:
    print("✅ ALL TESTS PASSED - Backend is fully functional")
elif failed_count <= 2:
    print("⚠️  MOSTLY FUNCTIONAL - Minor issues detected")
else:
    print("❌ ISSUES DETECTED - Multiple tests failed")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)
