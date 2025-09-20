# Savium Backend QA Testing Guide

## 🎯 **Testing Overview**

This guide provides comprehensive end-to-end testing scenarios for the Savium AI Backend application. Test the complete user journey from registration to transaction management with multi-currency support and request tracing.

## 🔧 **Prerequisites**

- Application running on: `http://localhost:3000`
- Swagger docs available at: `http://localhost:3000/api/docs`
- MongoDB and Redis services running locally
- Postman, Insomnia, or curl for API testing

---

## 📋 **Test Scenarios**

### **Scenario 1: User Registration & Account Creation**

#### **1.1 User Registration**

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "testuser@savium.ai",
  "password": "SecurePassword123!",
  "firstName": "Juan",
  "lastName": "Pérez",
  "preferredCurrency": "ARS",
  "timezone": "America/Argentina/Buenos_Aires"
}
```

**Expected Results:**

- ✅ Status 201 Created
- ✅ Response contains user data and JWT tokens
- ✅ `x-trace-id` header present in response
- ✅ Password is hashed (not returned in response)

#### **1.2 Account Creation - Personal Account (ARS)**

```bash
POST /api/v1/accounts
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Mi Cuenta Personal",
  "type": "PERSONAL",
  "currency": "ARS",
  "timezone": "America/Argentina/Buenos_Aires",
  "description": "Cuenta personal para gastos diarios"
}
```

**Expected Results:**

- ✅ Status 201 Created
- ✅ Account created with ARS as base currency
- ✅ User is set as owner
- ✅ Request tracing ID in logs

---

### **Scenario 2: Multi-Currency Transaction Testing**

#### **2.1 Create Categories First**

```bash
POST /api/v1/categories
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Comidas y Restaurantes",
  "type": "EXPENSE",
  "color": "#FF6B6B",
  "icon": "🍽️",
  "subcategories": ["restaurant", "fast_food", "groceries"]
}
```

#### **2.2 Create Transaction in Account Currency (ARS)**

```bash
POST /api/v1/transactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Almuerzo en restaurante local",
  "amount": 5500,
  "date": "2025-09-08T15:30:00.000Z",
  "categoryId": "{category_id}",
  "accountId": "{account_id}",
  "subcategoryName": "restaurant",
  "paymentMethod": "CREDIT_CARD",
  "vendor": "La Parolaccia"
}
```

**Expected Results:**

- ✅ Currency should default to account currency (ARS)
- ✅ Amount stored as 5500 ARS
- ✅ Status 201 Created

#### **2.3 Create Transaction in Different Currency (USD)**

```bash
POST /api/v1/transactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Compra en Amazon USA",
  "amount": 25.99,
  "currency": "USD",
  "date": "2025-09-08T10:00:00.000Z",
  "categoryId": "{category_id}",
  "accountId": "{account_id}",
  "subcategoryName": "shopping",
  "paymentMethod": "CREDIT_CARD",
  "vendor": "Amazon",
  "notes": "Libro técnico en dólares"
}
```

**Expected Results:**

- ✅ Currency explicitly set to USD
- ✅ Amount stored as 25.99 USD
- ✅ Different currency than account base

#### **2.4 Create Transaction in EUR**

```bash
POST /api/v1/transactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Hotel en Madrid",
  "amount": 89.50,
  "currency": "EUR",
  "date": "2025-09-07T20:00:00.000Z",
  "categoryId": "{category_id}",
  "accountId": "{account_id}",
  "subcategoryName": "hotel",
  "paymentMethod": "CREDIT_CARD",
  "vendor": "Hotel Europa",
  "tags": ["travel", "vacation"]
}
```

---

### **Scenario 3: Transaction Retrieval & Filtering**

#### **3.1 Get All Transactions (Mixed Currencies)**

```bash
GET /api/v1/transactions?accountId={account_id}&limit=10
Authorization: Bearer {access_token}
```

**Expected Results:**

- ✅ Returns all transactions with their original currencies
- ✅ ARS: 5500, USD: 25.99, EUR: 89.50
- ✅ Each transaction shows its currency field
- ✅ Request tracing ID in response headers

#### **3.2 Get Stats by Currency - ARS Only**

```bash
GET /api/v1/transactions/stats?accountId={account_id}&currency=ARS
Authorization: Bearer {access_token}
```

**Expected Results:**

- ✅ Only shows ARS transactions (5500 ARS)
- ✅ Total amount in ARS
- ✅ Excludes USD and EUR transactions

#### **3.3 Get Stats by Currency - USD Only**

```bash
GET /api/v1/transactions/stats?accountId={account_id}&currency=USD
Authorization: Bearer {access_token}
```

**Expected Results:**

- ✅ Only shows USD transactions (25.99 USD)
- ✅ Total amount in USD
- ✅ Excludes ARS and EUR transactions

#### **3.4 Get Stats by Currency - All Mixed**

```bash
GET /api/v1/transactions/stats?accountId={account_id}
Authorization: Bearer {access_token}
```

**Expected Results:**

- ✅ Shows summary of all currencies
- ✅ Breakdown by currency type
- ✅ Total count across all currencies

---

### **Scenario 4: Family/Couple Account Testing**

#### **4.1 Create Couple Account**

```bash
POST /api/v1/accounts
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Cuenta de Pareja",
  "type": "COUPLE",
  "currency": "USD",
  "description": "Gastos compartidos de la pareja"
}
```

#### **4.2 Create Shared Transaction in Couple Account**

```bash
POST /api/v1/transactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Supermercado semanal",
  "amount": 120.50,
  "date": "2025-09-08T11:00:00.000Z",
  "categoryId": "{category_id}",
  "accountId": "{couple_account_id}",
  "isSharedTransaction": true,
  "splitDetails": {
    "totalAmount": 120.50,
    "splitMethod": "equal",
    "splits": [
      {
        "userId": "{user_id}",
        "amount": 60.25,
        "paid": true
      }
    ]
  }
}
```

**Expected Results:**

- ✅ Uses account currency (USD) when not specified
- ✅ Creates shared transaction structure
- ✅ Split details properly configured

---

### **Scenario 5: Request Tracing Verification**

#### **5.1 Trace ID Consistency**

```bash
# Make multiple requests and verify trace IDs
curl -X GET "http://localhost:3000/api/v1/health" -H "Accept: application/json" -v
curl -X GET "http://localhost:3000/api/v1/transactions" -H "Authorization: Bearer {token}" -v
```

**Expected Results:**

- ✅ Each request has unique `x-trace-id` in response headers
- ✅ UUIDs follow format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- ✅ Different requests have different trace IDs
- ✅ Same request context maintains same trace ID

#### **5.2 Custom Trace ID**

```bash
curl -X GET "http://localhost:3000/api/v1/health" \
  -H "x-trace-id: custom-test-trace-123" \
  -H "Accept: application/json" -v
```

**Expected Results:**

- ✅ Response should return the custom trace ID in headers
- ✅ Application respects provided trace ID

---

### **Scenario 6: Error Handling & Edge Cases**

#### **6.1 Invalid Currency Code**

```bash
POST /api/v1/transactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Test invalid currency",
  "amount": 100,
  "currency": "INVALID",
  "date": "2025-09-08T12:00:00.000Z",
  "categoryId": "{category_id}",
  "accountId": "{account_id}"
}
```

**Expected Results:**

- ✅ Status 400 Bad Request
- ✅ Validation error for invalid currency
- ✅ Error response includes trace ID

#### **6.2 Missing Required Fields**

```bash
POST /api/v1/transactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Incomplete transaction"
}
```

**Expected Results:**

- ✅ Status 400 Bad Request
- ✅ Clear validation error messages
- ✅ Lists all missing required fields

---

### **Scenario 7: File Upload Testing**

#### **7.1 Upload Receipt with Transaction**

```bash
POST /api/v1/transactions/upload
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

# Form data:
files: [receipt1.jpg, receipt2.pdf]
description: "Cena de negocios"
amount: 85.00
currency: "EUR"
date: "2025-09-08T19:00:00.000Z"
categoryId: "{category_id}"
accountId: "{account_id}"
vendor: "Restaurante Barcelona"
```

**Expected Results:**

- ✅ Status 201 Created
- ✅ Files uploaded and linked to transaction
- ✅ EUR currency properly set
- ✅ Transaction created with attachments

---

## 🧪 **Advanced Testing Scenarios**

### **Scenario 8: Business Account with Multiple Currencies**

#### **8.1 Create Business Account**

```bash
POST /api/v1/accounts
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Mi Empresa SAS",
  "type": "BUSINESS",
  "currency": "ARS",
  "description": "Cuenta empresarial con gastos internacionales"
}
```

#### **8.2 Create Multiple Currency Business Transactions**

```bash
# Office supplies in ARS
POST /api/v1/transactions
{
  "description": "Papelería y útiles",
  "amount": 15000,
  "categoryId": "{category_id}",
  "accountId": "{business_account_id}",
  "subcategoryName": "office_supplies"
}

# Software license in USD
POST /api/v1/transactions
{
  "description": "Licencia Adobe Creative Suite",
  "amount": 599.99,
  "currency": "USD",
  "categoryId": "{category_id}",
  "accountId": "{business_account_id}",
  "subcategoryName": "software_subscriptions"
}
```

#### **8.3 Generate Business Reports by Currency**

```bash
GET /api/v1/transactions/category-breakdown?accountId={business_account_id}
GET /api/v1/transactions/stats?accountId={business_account_id}&currency=USD
GET /api/v1/transactions/stats?accountId={business_account_id}&currency=ARS
```

---

## ✅ **Success Criteria**

### **Multi-Currency Support**

- [ ] Account base currency properly set during creation
- [ ] Transactions default to account currency when not specified
- [ ] Transactions accept explicit currency in request body
- [ ] Stats endpoints filter by specific currency correctly
- [ ] Multiple currencies can coexist in same account
- [ ] Currency validation works (only valid ISO codes accepted)

### **Request Tracing**

- [ ] Every response includes unique `x-trace-id` header
- [ ] Trace IDs follow UUID v4 format
- [ ] Custom trace IDs are respected when provided
- [ ] Application logs include trace IDs
- [ ] Error responses include trace IDs

### **Application Health**

- [ ] All endpoints respond correctly
- [ ] MongoDB connection stable
- [ ] Authentication works properly
- [ ] File uploads function correctly
- [ ] Error handling is consistent

### **Performance & Reliability**

- [ ] Response times under 500ms for standard requests
- [ ] Concurrent requests handle properly
- [ ] Database queries optimized
- [ ] Memory usage stable during testing

---

## 🚨 **Common Issues to Check**

1. **Currency Defaults**: Ensure transactions use account currency when not specified in body
2. **Validation**: Check that invalid currencies are rejected properly
3. **Trace ID Format**: Verify UUIDs are properly formatted
4. **Error Handling**: All errors should include trace IDs for debugging
5. **Multi-Account**: Different accounts can have different base currencies
6. **Stats Accuracy**: Currency-filtered stats should only include matching transactions

---

## 📊 **Test Results Template**

```markdown
## Test Execution Results - [Date]

### Scenario 1: User Registration ✅/❌

- Registration: ✅
- Account Creation: ✅
- Currency Setup: ✅

### Scenario 2: Multi-Currency Transactions ✅/❌

- ARS Transaction (default): ✅
- USD Transaction (explicit): ✅
- EUR Transaction (explicit): ✅

### Scenario 3: Currency Filtering ✅/❌

- Stats by ARS: ✅
- Stats by USD: ✅
- Mixed currency retrieval: ✅

### Request Tracing ✅/❌

- Unique trace IDs: ✅
- UUID format: ✅
- Custom trace ID handling: ✅

### Issues Found:

- None / [List any issues discovered]

### Performance Notes:

- Average response time: Xms
- Memory usage: Stable/High
- Database performance: Good/Poor
```

---

## 🔍 **Debugging Tips**

1. **Check Application Logs**: Look for trace IDs in console output
2. **Swagger Documentation**: Use `/api/docs` for interactive testing
3. **Database Inspection**: Verify transactions are stored with correct currencies
4. **Header Analysis**: Always check response headers for trace IDs
5. **Error Messages**: Should be clear and include error codes

This comprehensive testing guide ensures all multi-currency functionality and request tracing work correctly across different account types and user scenarios.
