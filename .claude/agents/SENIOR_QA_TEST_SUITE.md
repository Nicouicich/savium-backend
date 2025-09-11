# Senior QA Test Suite - Savium Backend

## 🎯 **Executive Summary**
Comprehensive test suite for validating NestJS backend with MongoDB, Redis, multi-currency support, request tracing, and distributed system resilience. Focus on edge cases, performance, security, and production readiness.

---

## 🔧 **Test Environment Setup**

### **Prerequisites**
- **Backend**: `http://localhost:3000`
- **Database**: MongoDB 6+ with replica set
- **Cache**: Redis 7+ with persistence 
- **Monitoring**: Application logs with trace IDs
- **Tools**: Newman, Artillery, Postman, curl, jq

### **Environment Variables Validation**
```bash
# Verify critical configs before testing
curl -s http://localhost:3000/api/v1/health | jq '.'
# Expected: {"status":"ok","environment":"development","version":"1.0.0"}
```

---

## 🧪 **Critical Path Testing**

### **Test Suite 1: Authentication & Authorization**

#### **T1.1 JWT Token Lifecycle**
```bash
# Registration with trace validation
TRACE_ID=$(uuidgen)
REGISTER_RESPONSE=$(curl -s -H "x-trace-id: $TRACE_ID" -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "senior.qa@savium.ai",
    "password": "ComplexP@ssw0rd!123",
    "firstName": "Senior",
    "lastName": "QA",
    "preferredCurrency": "USD"
  }')

# Validate response structure
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.tokens.accessToken')
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.tokens.refreshToken')

# Test token refresh cycle
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**Senior QA Validation Points:**
- [ ] **Token Entropy**: Verify JWT contains sufficient entropy (>128 bits)
- [ ] **Expiration Strategy**: Access token expires in 15m, refresh in 7d
- [ ] **Race Conditions**: Concurrent refresh requests handled atomically
- [ ] **Security Headers**: CSP, HSTS, X-Frame-Options present
- [ ] **Rate Limiting**: Auth endpoints throttled appropriately

#### **T1.2 Session Management & Redis Integration**
```bash
# Create multiple sessions, verify Redis storage
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "senior.qa@savium.ai", 
      "password": "ComplexP@ssw0rd!123"
    }'
done

# Test logout all functionality
curl -X POST http://localhost:3000/api/v1/auth/logout-all \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Verify session cleanup in Redis
# redis-cli KEYS "session:*" | wc -l  # Should be 0
```

---

### **Test Suite 2: Multi-Currency & Data Integrity**

#### **T2.1 Currency Precision & Rounding**
```bash
# Create account with ARS base currency
ACCOUNT_RESPONSE=$(curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA Test Account",
    "type": "PERSONAL", 
    "currency": "ARS",
    "timezone": "America/Argentina/Buenos_Aires"
  }')

ACCOUNT_ID=$(echo $ACCOUNT_RESPONSE | jq -r '.data._id')

# Test floating point precision edge cases
PRECISION_TESTS=(
  '{"amount": 0.01, "description": "Minimum precision test"}'
  '{"amount": 999999.99, "description": "Maximum precision test"}'
  '{"amount": 33.333333, "description": "Repeating decimal test"}'
  '{"amount": 0.005, "description": "Rounding boundary test"}'
)

for test in "${PRECISION_TESTS[@]}"; do
  curl -X POST http://localhost:3000/api/v1/expenses \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(echo $test | jq '. += {
      "date": "2025-09-08T12:00:00.000Z",
      "categoryId": "507f1f77bcf86cd799439011",
      "accountId": "'$ACCOUNT_ID'"
    }')"
done
```

**Senior Validation:**
- [ ] **Decimal Precision**: MongoDB stores with exact precision (no floating point errors)
- [ ] **Currency Conversion**: If implemented, uses proper exchange rate APIs
- [ ] **Atomic Operations**: Multi-currency calculations are transactional
- [ ] **Data Validation**: Invalid amounts (negative, NaN) properly rejected

#### **T2.2 Multi-Currency Aggregation Testing**
```bash
# Create mixed currency expenses
CURRENCIES=("USD" "EUR" "ARS" "BRL" "JPY")
for currency in "${CURRENCIES[@]}"; do
  curl -X POST http://localhost:3000/api/v1/expenses \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Test expense in '$currency'",
      "amount": 100,
      "currency": "'$currency'",
      "date": "2025-09-08T12:00:00.000Z",
      "categoryId": "507f1f77bcf86cd799439011", 
      "accountId": "'$ACCOUNT_ID'"
    }'
done

# Test aggregation pipelines
curl -X GET "http://localhost:3000/api/v1/expenses/stats?accountId=$ACCOUNT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data'

# Test currency-specific filtering
curl -X GET "http://localhost:3000/api/v1/expenses/stats?accountId=$ACCOUNT_ID&currency=USD" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data'
```

---

### **Test Suite 3: Request Tracing & Observability**

#### **T3.1 Distributed Tracing Validation**
```bash
# Test trace ID propagation through request lifecycle
CUSTOM_TRACE="qa-test-$(date +%s)"

# Create expense with custom trace ID
EXPENSE_RESPONSE=$(curl -v -X POST http://localhost:3000/api/v1/expenses \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-trace-id: $CUSTOM_TRACE" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Tracing test expense",
    "amount": 50,
    "currency": "USD", 
    "date": "2025-09-08T12:00:00.000Z",
    "categoryId": "507f1f77bcf86cd799439011",
    "accountId": "'$ACCOUNT_ID'"
  }' 2>&1)

# Validate trace ID in response headers
echo "$EXPENSE_RESPONSE" | grep -i "x-trace-id: $CUSTOM_TRACE"

# Test trace ID with error scenarios
curl -v -X POST http://localhost:3000/api/v1/expenses \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-trace-id: error-trace-123" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}' 2>&1 | grep -i "x-trace-id"
```

**Senior Validation:**
- [ ] **UUID Format**: Auto-generated trace IDs follow RFC 4122 v4
- [ ] **Header Consistency**: Same trace ID in request/response cycle
- [ ] **Error Propagation**: Trace IDs present in all error responses
- [ ] **Log Correlation**: Application logs contain trace IDs for debugging
- [ ] **Performance Impact**: Tracing adds <5ms overhead per request

#### **T3.2 AsyncLocalStorage Context Testing**
```bash
# Test concurrent requests maintain separate contexts
for i in {1..10}; do
  (curl -X GET "http://localhost:3000/api/v1/expenses?accountId=$ACCOUNT_ID&limit=1" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "x-trace-id: concurrent-test-$i" &)
done
wait

# Verify no context bleeding between concurrent requests
# Check application logs for trace ID separation
```

---

### **Test Suite 4: Database & Performance**

#### **T4.1 Connection Pool & Transaction Testing**
```bash
# Stress test database connections
artillery quick --count 50 --num 10 \
  --header "Authorization=Bearer $ACCESS_TOKEN" \
  http://localhost:3000/api/v1/expenses

# Test transaction rollbacks with invalid data
curl -X POST http://localhost:3000/api/v1/expenses/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'files=@/dev/null' \
  -F 'description=Transaction rollback test' \
  -F 'amount=INVALID_AMOUNT' \
  -F 'accountId='$ACCOUNT_ID''
```

**Senior Validation:**
- [ ] **Connection Pooling**: MongoDB connections properly pooled and reused
- [ ] **Query Performance**: Complex aggregations complete <200ms
- [ ] **Index Utilization**: Explain plans show proper index usage
- [ ] **Memory Leaks**: No memory growth during sustained load
- [ ] **Graceful Degradation**: App handles DB disconnection properly

#### **T4.2 Data Consistency & ACID Properties**
```bash
# Test concurrent expense creation with same account
CONCURRENT_PAYLOAD='{
  "description": "Concurrent test",
  "amount": 100,
  "date": "2025-09-08T12:00:00.000Z", 
  "categoryId": "507f1f77bcf86cd799439011",
  "accountId": "'$ACCOUNT_ID'"
}'

for i in {1..20}; do
  (curl -X POST http://localhost:3000/api/v1/expenses \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$CONCURRENT_PAYLOAD" &)
done
wait

# Verify all expenses created without data corruption
curl -X GET "http://localhost:3000/api/v1/expenses?accountId=$ACCOUNT_ID&limit=50" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data | length'
```

---

### **Test Suite 5: Security & Edge Cases**

#### **T5.1 Input Validation & SQL Injection**
```bash
# Test NoSQL injection attempts
INJECTION_PAYLOADS=(
  '{"description": {"$ne": null}}'
  '{"amount": {"$gt": 0}}'
  '{"categoryId": {"$regex": ".*"}}'
  '{"accountId": ""; return 1; db.dropDatabase(); //"}'
)

for payload in "${INJECTION_PAYLOADS[@]}"; do
  curl -X POST http://localhost:3000/api/v1/expenses \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload"
done

# Test XSS in text fields
curl -X POST http://localhost:3000/api/v1/expenses \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "<script>alert(\"XSS\")</script>",
    "amount": 100,
    "date": "2025-09-08T12:00:00.000Z",
    "categoryId": "507f1f77bcf86cd799439011", 
    "accountId": "'$ACCOUNT_ID'"
  }'
```

**Senior Validation:**
- [ ] **Input Sanitization**: All user inputs properly escaped/validated
- [ ] **Schema Validation**: class-validator catches malformed payloads
- [ ] **Authorization**: Users can only access their own data
- [ ] **Rate Limiting**: Aggressive requests properly throttled
- [ ] **CORS Policy**: Only allowed origins can access API

#### **T5.2 File Upload Security**
```bash
# Create malicious file payloads
echo "<?php system(\$_GET['cmd']); ?>" > malicious.php
echo "#!/bin/bash\nrm -rf /" > malicious.sh

# Test file type validation
curl -X POST http://localhost:3000/api/v1/expenses/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'files=@malicious.php' \
  -F 'files=@malicious.sh' \
  -F 'description=Security test' \
  -F 'amount=100' \
  -F 'accountId='$ACCOUNT_ID''

# Test oversized files
dd if=/dev/zero of=oversized.txt bs=1M count=20  # Create 20MB file
curl -X POST http://localhost:3000/api/v1/expenses/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'files=@oversized.txt' \
  -F 'description=Size test' \
  -F 'amount=100' \
  -F 'accountId='$ACCOUNT_ID''

# Cleanup
rm -f malicious.* oversized.txt
```

---

### **Test Suite 6: Error Handling & Resilience**

#### **T6.1 Circuit Breaker Patterns**
```bash
# Test database disconnection handling
# (Requires stopping MongoDB temporarily)
curl -X GET http://localhost:3000/api/v1/expenses \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test Redis disconnection
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "senior.qa@savium.ai",
    "password": "ComplexP@ssw0rd!123" 
  }'

# Test external service failures (if email service configured)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "failtest@savium.ai",
    "password": "TestPass123!",
    "firstName": "Fail",
    "lastName": "Test"
  }'
```

**Senior Validation:**
- [ ] **Graceful Degradation**: App remains partially functional during outages
- [ ] **Timeout Handling**: Long-running operations timeout appropriately
- [ ] **Retry Logic**: Transient failures automatically retried
- [ ] **Health Checks**: `/health` endpoint reports accurate system status
- [ ] **Error Messages**: Production errors don't leak sensitive information

---

## 📊 **Performance Benchmarks**

### **Load Testing Scenarios**
```bash
# Baseline performance test
artillery quick --count 100 --num 20 \
  --header "Authorization=Bearer $ACCESS_TOKEN" \
  http://localhost:3000/api/v1/health > baseline.json

# Expense creation under load
artillery quick --count 50 --num 10 \
  --header "Authorization=Bearer $ACCESS_TOKEN" \
  --header "Content-Type=application/json" \
  --data '{"description":"Load test","amount":100,"date":"2025-09-08T12:00:00.000Z","categoryId":"507f1f77bcf86cd799439011","accountId":"'$ACCOUNT_ID'"}' \
  --method POST \
  http://localhost:3000/api/v1/expenses > load_test.json

# Database aggregation performance
time curl -X GET "http://localhost:3000/api/v1/expenses/stats?accountId=$ACCOUNT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Performance SLAs:**
- [ ] **Response Time**: P95 < 500ms for read operations
- [ ] **Throughput**: Handle 1000+ concurrent users
- [ ] **Error Rate**: < 0.1% under normal load
- [ ] **Database Performance**: Complex queries < 200ms
- [ ] **Memory Usage**: No leaks over 24h sustained load

---

## 🔍 **Production Readiness Checklist**

### **Security**
- [ ] All endpoints require authentication except `/health` and `/auth`
- [ ] Password hashing uses bcrypt with salt rounds ≥ 12
- [ ] JWT tokens signed with strong secret (256+ bits)
- [ ] HTTPS enforced in production (via reverse proxy)
- [ ] Input validation prevents injection attacks
- [ ] File uploads restricted by type and size
- [ ] Rate limiting configured per endpoint type
- [ ] Security headers (HSTS, CSP, etc.) properly set

### **Observability**
- [ ] Request tracing implemented with UUID v4
- [ ] Structured logging with appropriate levels
- [ ] Health check endpoint reports all dependencies
- [ ] Error tracking with trace correlation
- [ ] Performance metrics collection ready
- [ ] Database query monitoring enabled

### **Scalability**
- [ ] Database connections properly pooled
- [ ] Redis used for session storage
- [ ] Stateless application design
- [ ] Horizontal scaling capabilities verified
- [ ] Background job processing if needed
- [ ] CDN-ready for static assets

### **Data Integrity**
- [ ] Database indexes optimized for query patterns
- [ ] Multi-currency calculations handle precision correctly
- [ ] Backup and recovery procedures tested
- [ ] Data migration scripts available
- [ ] GDPR compliance for user data

---

## 🚨 **Critical Failure Scenarios**

### **Disaster Recovery Testing**
```bash
# Simulate various failure modes and verify recovery

# 1. Database connection loss
# 2. Redis unavailability  
# 3. Memory exhaustion
# 4. Disk space full
# 5. Network partitions
# 6. High CPU utilization
# 7. Malformed configuration
```

---

## 📋 **Senior QA Report Template**

```markdown
## Production Readiness Assessment

### Security Grade: A/B/C/D/F
- Authentication: ✅/❌
- Authorization: ✅/❌  
- Input Validation: ✅/❌
- Data Protection: ✅/❌

### Performance Grade: A/B/C/D/F
- Response Times: X ms (P95)
- Throughput: X req/sec
- Error Rate: X%
- Resource Usage: Stable/Concerning

### Reliability Grade: A/B/C/D/F
- Error Handling: ✅/❌
- Resilience: ✅/❌
- Data Consistency: ✅/❌
- Recovery: ✅/❌

### Critical Issues Found: X
1. [Issue description + severity]
2. [Issue description + severity]

### Recommendations:
1. [Priority recommendations]
2. [Performance optimizations]
3. [Security improvements]

### Production Go/No-Go: GO/NO-GO
Justification: [Detailed reasoning]
```

This senior-level QA suite focuses on production readiness, security, performance, and edge cases that junior QA might miss. Execute systematically and document all findings with trace IDs for developer debugging.