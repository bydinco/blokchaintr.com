#!/usr/bin/env python3
"""
Backend API Test Suite for Finansal Yönetim + Cari Hesap Uygulaması
Tests all endpoints with realistic Turkish financial data
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://expense-tracker-2786.preview.emergentagent.com/api"
TEST_USER_EMAIL = "test@test.com"
TEST_USER_PASSWORD = "123456"
NEW_USER_EMAIL = "test2@test.com"
NEW_USER_PASSWORD = "123456"

class FinancialAppTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.created_category_id = None
        self.created_transaction_id = None
        self.created_current_account_id = None
        self.created_ca_transaction_id = None
        
    def log(self, message, status="INFO"):
        print(f"[{status}] {message}")
        
    def test_auth_register(self):
        """Test user registration"""
        self.log("Testing user registration...")
        
        payload = {
            "email": NEW_USER_EMAIL,
            "password": NEW_USER_PASSWORD,
            "full_name": "Test Kullanıcısı"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.log("✅ User registration successful")
                    return True
                else:
                    self.log("❌ Registration response missing required fields", "ERROR")
                    return False
            elif response.status_code == 400:
                self.log("⚠️ User already exists (expected for existing test user)")
                return True
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}", "ERROR")
            return False
    
    def test_auth_login(self):
        """Test user login and store auth token"""
        self.log("Testing user login...")
        
        payload = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.user_id = data["user"]["id"]
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log("✅ Login successful")
                    return True
                else:
                    self.log("❌ Login response missing required fields", "ERROR")
                    return False
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}", "ERROR")
            return False
    
    def test_auth_me(self):
        """Test get current user info"""
        self.log("Testing get current user...")
        
        try:
            response = self.session.get(f"{BASE_URL}/auth/me")
            
            if response.status_code == 200:
                data = response.json()
                if "email" in data and "full_name" in data:
                    self.log("✅ Get current user successful")
                    return True
                else:
                    self.log("❌ User info response missing required fields", "ERROR")
                    return False
            else:
                self.log(f"❌ Get user info failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get user info error: {str(e)}", "ERROR")
            return False
    
    def test_categories_create(self):
        """Test category creation"""
        self.log("Testing category creation...")
        
        payload = {
            "name": "Market Alışverişi",
            "type": "expense",
            "color": "#FF5722",
            "parent_id": None,
            "order": 1
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/categories", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["name"] == "Market Alışverişi":
                    self.created_category_id = data["id"]
                    self.log("✅ Category creation successful")
                    return True
                else:
                    self.log("❌ Category creation response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Category creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Category creation error: {str(e)}", "ERROR")
            return False
    
    def test_categories_list(self):
        """Test category listing"""
        self.log("Testing category listing...")
        
        try:
            response = self.session.get(f"{BASE_URL}/categories")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Category listing successful - Found {len(data)} categories")
                    return True
                else:
                    self.log("❌ Category listing response not a list", "ERROR")
                    return False
            else:
                self.log(f"❌ Category listing failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Category listing error: {str(e)}", "ERROR")
            return False
    
    def test_categories_update(self):
        """Test category update"""
        if not self.created_category_id:
            self.log("⚠️ Skipping category update - no category created")
            return True
            
        self.log("Testing category update...")
        
        payload = {
            "name": "Süpermarket Alışverişi",
            "type": "expense",
            "color": "#FF9800",
            "parent_id": None,
            "order": 1
        }
        
        try:
            response = self.session.put(f"{BASE_URL}/categories/{self.created_category_id}", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if data["name"] == "Süpermarket Alışverişi":
                    self.log("✅ Category update successful")
                    return True
                else:
                    self.log("❌ Category update response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Category update failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Category update error: {str(e)}", "ERROR")
            return False
    
    def test_categories_reorder(self):
        """Test category reordering"""
        if not self.created_category_id:
            self.log("⚠️ Skipping category reorder - no category created")
            return True
            
        self.log("Testing category reordering...")
        
        payload = [
            {"id": self.created_category_id, "order": 5}
        ]
        
        try:
            response = self.session.post(f"{BASE_URL}/categories/reorder", json=payload)
            
            if response.status_code == 200:
                self.log("✅ Category reordering successful")
                return True
            else:
                self.log(f"❌ Category reordering failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Category reordering error: {str(e)}", "ERROR")
            return False
    
    def test_transactions_create(self):
        """Test transaction creation with photo"""
        if not self.created_category_id:
            self.log("⚠️ Skipping transaction creation - no category available")
            return True
            
        self.log("Testing transaction creation...")
        
        # Create a simple base64 image (1x1 pixel PNG)
        sample_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        payload = {
            "type": "expense",
            "amount": 125.50,
            "category_id": self.created_category_id,
            "payment_method": "cash",
            "description": "Migros market alışverişi - günlük ihtiyaçlar",
            "date": datetime.now().isoformat(),
            "photo": sample_image_b64
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/transactions", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["amount"] == 125.50:
                    self.created_transaction_id = data["id"]
                    self.log("✅ Transaction creation successful")
                    return True
                else:
                    self.log("❌ Transaction creation response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Transaction creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Transaction creation error: {str(e)}", "ERROR")
            return False
    
    def test_transactions_list(self):
        """Test transaction listing with filters"""
        self.log("Testing transaction listing...")
        
        try:
            # Test without filter
            response = self.session.get(f"{BASE_URL}/transactions")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Transaction listing successful - Found {len(data)} transactions")
                    
                    # Test with type filter
                    response_filtered = self.session.get(f"{BASE_URL}/transactions?type=expense")
                    if response_filtered.status_code == 200:
                        filtered_data = response_filtered.json()
                        self.log(f"✅ Transaction filtering successful - Found {len(filtered_data)} expense transactions")
                        return True
                    else:
                        self.log("❌ Transaction filtering failed", "ERROR")
                        return False
                else:
                    self.log("❌ Transaction listing response not a list", "ERROR")
                    return False
            else:
                self.log(f"❌ Transaction listing failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Transaction listing error: {str(e)}", "ERROR")
            return False
    
    def test_transactions_get_single(self):
        """Test getting single transaction"""
        if not self.created_transaction_id:
            self.log("⚠️ Skipping single transaction get - no transaction created")
            return True
            
        self.log("Testing single transaction retrieval...")
        
        try:
            response = self.session.get(f"{BASE_URL}/transactions/{self.created_transaction_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["id"] == self.created_transaction_id:
                    self.log("✅ Single transaction retrieval successful")
                    return True
                else:
                    self.log("❌ Single transaction response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Single transaction retrieval failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Single transaction retrieval error: {str(e)}", "ERROR")
            return False
    
    def test_transactions_update(self):
        """Test transaction update"""
        if not self.created_transaction_id:
            self.log("⚠️ Skipping transaction update - no transaction created")
            return True
            
        self.log("Testing transaction update...")
        
        payload = {
            "type": "expense",
            "amount": 150.75,
            "category_id": self.created_category_id,
            "payment_method": "credit_card",
            "description": "Migros market alışverişi - güncellenmiş tutar",
            "date": datetime.now().isoformat(),
            "photo": None
        }
        
        try:
            response = self.session.put(f"{BASE_URL}/transactions/{self.created_transaction_id}", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if data["amount"] == 150.75:
                    self.log("✅ Transaction update successful")
                    return True
                else:
                    self.log("❌ Transaction update response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Transaction update failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Transaction update error: {str(e)}", "ERROR")
            return False
    
    def test_current_accounts_create(self):
        """Test current account creation"""
        self.log("Testing current account creation...")
        
        payload = {
            "name": "Ahmet Yılmaz Müşteri",
            "phone": "+90 532 123 4567",
            "type": "customer"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/current-accounts", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["name"] == "Ahmet Yılmaz Müşteri":
                    self.created_current_account_id = data["id"]
                    self.log("✅ Current account creation successful")
                    return True
                else:
                    self.log("❌ Current account creation response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Current account creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Current account creation error: {str(e)}", "ERROR")
            return False
    
    def test_current_accounts_list(self):
        """Test current accounts listing"""
        self.log("Testing current accounts listing...")
        
        try:
            response = self.session.get(f"{BASE_URL}/current-accounts")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Current accounts listing successful - Found {len(data)} accounts")
                    return True
                else:
                    self.log("❌ Current accounts listing response not a list", "ERROR")
                    return False
            else:
                self.log(f"❌ Current accounts listing failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Current accounts listing error: {str(e)}", "ERROR")
            return False
    
    def test_current_accounts_get_single(self):
        """Test getting single current account"""
        if not self.created_current_account_id:
            self.log("⚠️ Skipping single current account get - no account created")
            return True
            
        self.log("Testing single current account retrieval...")
        
        try:
            response = self.session.get(f"{BASE_URL}/current-accounts/{self.created_current_account_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["id"] == self.created_current_account_id:
                    self.log("✅ Single current account retrieval successful")
                    return True
                else:
                    self.log("❌ Single current account response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Single current account retrieval failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Single current account retrieval error: {str(e)}", "ERROR")
            return False
    
    def test_current_accounts_update(self):
        """Test current account update"""
        if not self.created_current_account_id:
            self.log("⚠️ Skipping current account update - no account created")
            return True
            
        self.log("Testing current account update...")
        
        payload = {
            "name": "Ahmet Yılmaz Müşteri (Güncellenmiş)",
            "phone": "+90 532 999 8877",
            "type": "customer"
        }
        
        try:
            response = self.session.put(f"{BASE_URL}/current-accounts/{self.created_current_account_id}", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "Güncellenmiş" in data["name"]:
                    self.log("✅ Current account update successful")
                    return True
                else:
                    self.log("❌ Current account update response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Current account update failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Current account update error: {str(e)}", "ERROR")
            return False
    
    def test_current_account_transactions_create(self):
        """Test current account transaction creation (Borç/Alacak)"""
        if not self.created_current_account_id:
            self.log("⚠️ Skipping current account transaction - no account created")
            return True
            
        self.log("Testing current account transaction creation...")
        
        # Test credit (alacak) transaction
        payload = {
            "current_account_id": self.created_current_account_id,
            "type": "credit",
            "amount": 1500.00,
            "description": "Satış faturası - Alacak kaydı",
            "date": datetime.now().isoformat()
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/current-accounts/{self.created_current_account_id}/transactions", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["type"] == "credit":
                    self.created_ca_transaction_id = data["id"]
                    self.log("✅ Current account credit transaction successful")
                    
                    # Test debt (borç) transaction
                    debt_payload = {
                        "current_account_id": self.created_current_account_id,
                        "type": "debt",
                        "amount": 500.00,
                        "description": "Ödeme alındı - Borç kaydı",
                        "date": datetime.now().isoformat()
                    }
                    
                    debt_response = self.session.post(f"{BASE_URL}/current-accounts/{self.created_current_account_id}/transactions", json=debt_payload)
                    
                    if debt_response.status_code == 200:
                        self.log("✅ Current account debt transaction successful")
                        return True
                    else:
                        self.log("❌ Current account debt transaction failed", "ERROR")
                        return False
                else:
                    self.log("❌ Current account transaction response invalid", "ERROR")
                    return False
            else:
                self.log(f"❌ Current account transaction failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Current account transaction error: {str(e)}", "ERROR")
            return False
    
    def test_current_account_transactions_list(self):
        """Test current account transactions listing"""
        if not self.created_current_account_id:
            self.log("⚠️ Skipping current account transactions list - no account created")
            return True
            
        self.log("Testing current account transactions listing...")
        
        try:
            response = self.session.get(f"{BASE_URL}/current-accounts/{self.created_current_account_id}/transactions")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Current account transactions listing successful - Found {len(data)} transactions")
                    return True
                else:
                    self.log("❌ Current account transactions listing response not a list", "ERROR")
                    return False
            else:
                self.log(f"❌ Current account transactions listing failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Current account transactions listing error: {str(e)}", "ERROR")
            return False
    
    def test_current_account_balance_calculation(self):
        """Test balance calculation accuracy"""
        if not self.created_current_account_id:
            self.log("⚠️ Skipping balance calculation test - no account created")
            return True
            
        self.log("Testing balance calculation...")
        
        try:
            # Get account details to check balance
            response = self.session.get(f"{BASE_URL}/current-accounts/{self.created_current_account_id}")
            
            if response.status_code == 200:
                data = response.json()
                balance = data.get("balance", 0)
                
                # Expected: 1500 (credit) - 500 (debt) = 1000
                expected_balance = 1000.0
                
                if abs(balance - expected_balance) < 0.01:  # Allow small floating point differences
                    self.log(f"✅ Balance calculation correct: {balance}")
                    return True
                else:
                    self.log(f"❌ Balance calculation incorrect. Expected: {expected_balance}, Got: {balance}", "ERROR")
                    return False
            else:
                self.log(f"❌ Balance calculation test failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Balance calculation test error: {str(e)}", "ERROR")
            return False
    
    def test_dashboard(self):
        """Test dashboard endpoint"""
        self.log("Testing dashboard endpoint...")
        
        try:
            response = self.session.get(f"{BASE_URL}/dashboard")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["total_income", "total_expense", "balance", "recent_transactions", "top_categories"]
                
                if all(field in data for field in required_fields):
                    self.log("✅ Dashboard endpoint successful")
                    self.log(f"   - Total Income: {data['total_income']}")
                    self.log(f"   - Total Expense: {data['total_expense']}")
                    self.log(f"   - Balance: {data['balance']}")
                    self.log(f"   - Recent Transactions: {len(data['recent_transactions'])}")
                    self.log(f"   - Top Categories: {len(data['top_categories'])}")
                    return True
                else:
                    self.log("❌ Dashboard response missing required fields", "ERROR")
                    return False
            else:
                self.log(f"❌ Dashboard endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Dashboard endpoint error: {str(e)}", "ERROR")
            return False
    
    def test_reports(self):
        """Test reports endpoint with date filtering"""
        self.log("Testing reports endpoint...")
        
        try:
            # Test without date filter
            response = self.session.get(f"{BASE_URL}/reports")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["summary", "category_breakdown", "transaction_count"]
                
                if all(field in data for field in required_fields):
                    self.log("✅ Reports endpoint (no filter) successful")
                    
                    # Test with date filter
                    start_date = (datetime.now() - timedelta(days=30)).isoformat()
                    end_date = datetime.now().isoformat()
                    
                    filtered_response = self.session.get(f"{BASE_URL}/reports?start_date={start_date}&end_date={end_date}")
                    
                    if filtered_response.status_code == 200:
                        filtered_data = filtered_response.json()
                        if all(field in filtered_data for field in required_fields):
                            self.log("✅ Reports endpoint (with date filter) successful")
                            self.log(f"   - Transaction Count: {filtered_data['transaction_count']}")
                            self.log(f"   - Categories: {len(filtered_data['category_breakdown'])}")
                            return True
                        else:
                            self.log("❌ Filtered reports response missing required fields", "ERROR")
                            return False
                    else:
                        self.log("❌ Filtered reports endpoint failed", "ERROR")
                        return False
                else:
                    self.log("❌ Reports response missing required fields", "ERROR")
                    return False
            else:
                self.log(f"❌ Reports endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Reports endpoint error: {str(e)}", "ERROR")
            return False
    
    def cleanup_test_data(self):
        """Clean up created test data"""
        self.log("Cleaning up test data...")
        
        try:
            # Delete current account transaction
            if self.created_ca_transaction_id and self.created_current_account_id:
                self.session.delete(f"{BASE_URL}/current-accounts/{self.created_current_account_id}/transactions/{self.created_ca_transaction_id}")
            
            # Delete current account
            if self.created_current_account_id:
                self.session.delete(f"{BASE_URL}/current-accounts/{self.created_current_account_id}")
            
            # Delete transaction
            if self.created_transaction_id:
                self.session.delete(f"{BASE_URL}/transactions/{self.created_transaction_id}")
            
            # Delete category
            if self.created_category_id:
                self.session.delete(f"{BASE_URL}/categories/{self.created_category_id}")
            
            self.log("✅ Test data cleanup completed")
            
        except Exception as e:
            self.log(f"⚠️ Cleanup error (non-critical): {str(e)}")
    
    def run_all_tests(self):
        """Run all backend API tests"""
        self.log("=" * 60)
        self.log("STARTING FINANSAL YÖNETİM BACKEND API TESTS")
        self.log("=" * 60)
        
        test_results = {}
        
        # Authentication Tests (HIGH PRIORITY)
        test_results["auth_register"] = self.test_auth_register()
        test_results["auth_login"] = self.test_auth_login()
        
        if not test_results["auth_login"]:
            self.log("❌ Cannot continue without authentication", "ERROR")
            return test_results
        
        test_results["auth_me"] = self.test_auth_me()
        
        # Categories Tests (HIGH PRIORITY)
        test_results["categories_create"] = self.test_categories_create()
        test_results["categories_list"] = self.test_categories_list()
        test_results["categories_update"] = self.test_categories_update()
        test_results["categories_reorder"] = self.test_categories_reorder()
        
        # Transactions Tests (HIGH PRIORITY)
        test_results["transactions_create"] = self.test_transactions_create()
        test_results["transactions_list"] = self.test_transactions_list()
        test_results["transactions_get_single"] = self.test_transactions_get_single()
        test_results["transactions_update"] = self.test_transactions_update()
        
        # Current Accounts Tests (HIGH PRIORITY)
        test_results["current_accounts_create"] = self.test_current_accounts_create()
        test_results["current_accounts_list"] = self.test_current_accounts_list()
        test_results["current_accounts_get_single"] = self.test_current_accounts_get_single()
        test_results["current_accounts_update"] = self.test_current_accounts_update()
        
        # Current Account Transactions Tests (HIGH PRIORITY)
        test_results["ca_transactions_create"] = self.test_current_account_transactions_create()
        test_results["ca_transactions_list"] = self.test_current_account_transactions_list()
        test_results["balance_calculation"] = self.test_current_account_balance_calculation()
        
        # Dashboard Tests (MEDIUM PRIORITY)
        test_results["dashboard"] = self.test_dashboard()
        
        # Reports Tests (MEDIUM PRIORITY)
        test_results["reports"] = self.test_reports()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for result in test_results.values() if result)
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}")
        
        self.log("=" * 60)
        self.log(f"TOTAL: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!")
        else:
            self.log(f"⚠️ {total - passed} tests failed")
        
        return test_results

if __name__ == "__main__":
    tester = FinancialAppTester()
    results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    if not all(results.values()):
        sys.exit(1)