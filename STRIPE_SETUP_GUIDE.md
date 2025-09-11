# Stripe Payment System Setup Guide

This guide provides comprehensive instructions for setting up and configuring the Stripe payment system in your Savium NestJS application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Stripe Account Setup](#stripe-account-setup)
3. [Environment Configuration](#environment-configuration)
4. [Product and Price Configuration](#product-and-price-configuration)
5. [Webhook Configuration](#webhook-configuration)
6. [Security Configuration](#security-configuration)
7. [Testing Setup](#testing-setup)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Node.js 18+ 
- MongoDB 6+
- Redis 7+
- NestJS application with existing user authentication

### Dependencies Installed
The following packages have been installed:
```bash
npm install stripe @types/stripe --legacy-peer-deps
```

## Stripe Account Setup

### 1. Create Stripe Account
1. Go to [https://stripe.com](https://stripe.com)
2. Create a new account or log in to existing account
3. Complete business verification (required for live payments)

### 2. Get API Keys
1. Navigate to **Dashboard** → **Developers** → **API keys**
2. Copy the following keys:
   - **Publishable key** (starts with `pk_`)
   - **Secret key** (starts with `sk_`)

### 3. Create Webhook Endpoint
1. Go to **Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-domain.com/api/v1/stripe/webhook`
4. Select events to listen for (see [Webhook Configuration](#webhook-configuration))
5. Copy the **Webhook signing secret** (starts with `whsec_`)

## Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional: Stripe Client ID for Connect (marketplace scenarios)
STRIPE_CLIENT_ID=ca_your_client_id_here

# Currency and Locale Settings
STRIPE_DEFAULT_CURRENCY=usd
STRIPE_DEFAULT_LOCALE=en

# Trial and Grace Periods (in days)
STRIPE_TRIAL_PERIOD_DAYS=14
STRIPE_GRACE_PERIOD_DAYS=3

# Tax Configuration
STRIPE_AUTOMATIC_TAX=false
STRIPE_COLLECT_TAX_ID=false
STRIPE_DEFAULT_TAX_BEHAVIOR=exclusive

# Security Settings
STRIPE_RADAR_RULES=true
STRIPE_REQUIRE_AUTH=true

# Geographic Restrictions (comma-separated country codes)
STRIPE_ALLOWED_COUNTRIES=US,CA,GB,DE,FR,AU
STRIPE_BLOCKED_COUNTRIES=IR,KP,SY

# Webhook Configuration
STRIPE_WEBHOOK_TOLERANCE=300
STRIPE_MAX_RETRIES=3
STRIPE_RETRY_DELAY=1000

# Testing Configuration (development only)
STRIPE_TEST_CLOCK_ID=
STRIPE_WEBHOOK_TESTING=false
```

## Product and Price Configuration

### 1. Create Products in Stripe Dashboard

#### Personal Account Product
1. Go to **Dashboard** → **Products**
2. Click **Add product**
3. Set details:
   - **Name**: "Savium Personal"
   - **Description**: "Personal finance management"
   - **Pricing**: Set monthly/yearly pricing
4. Copy the **Product ID** and **Price ID**

#### Couple Account Product
- **Name**: "Savium Couple"
- **Description**: "Shared finance management for couples"

#### Family Account Product
- **Name**: "Savium Family"
- **Description**: "Complete family finance management"

#### Business Account Product
- **Name**: "Savium Business"
- **Description**: "Advanced business finance management"

### 2. Add Product Configuration to Environment
```bash
# Personal Plan
STRIPE_PERSONAL_PRICE_ID=price_your_personal_price_id
STRIPE_PERSONAL_PRODUCT_ID=prod_your_personal_product_id

# Couple Plan
STRIPE_COUPLE_PRICE_ID=price_your_couple_price_id
STRIPE_COUPLE_PRODUCT_ID=prod_your_couple_product_id

# Family Plan
STRIPE_FAMILY_PRICE_ID=price_your_family_price_id
STRIPE_FAMILY_PRODUCT_ID=prod_your_family_product_id

# Business Plan
STRIPE_BUSINESS_PRICE_ID=price_your_business_price_id
STRIPE_BUSINESS_PRODUCT_ID=prod_your_business_product_id
```

## Webhook Configuration

### Required Webhook Events
Configure your webhook endpoint to listen for these events:

#### Payment Events
- `payment_intent.created`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `payment_intent.requires_action`

#### Customer Events
- `customer.created`
- `customer.updated`
- `customer.deleted`

#### Subscription Events
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`

#### Invoice Events
- `invoice.created`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.upcoming`

#### Payment Method Events
- `payment_method.attached`
- `payment_method.detached`

#### Other Events
- `setup_intent.succeeded`
- `checkout.session.completed`
- `charge.dispute.created`

### Webhook URL Configuration
Your webhook endpoint will be available at:
```
https://your-domain.com/api/v1/stripe/webhook
```

Make sure this endpoint is publicly accessible and returns a 200 status code.

## Security Configuration

### 1. Enable Stripe Radar (Recommended)
```bash
STRIPE_RADAR_RULES=true
```

### 2. Configure Geographic Restrictions
```bash
# Allow specific countries
STRIPE_ALLOWED_COUNTRIES=US,CA,GB,DE,FR,AU,NZ,JP

# Block high-risk countries (optional)
STRIPE_BLOCKED_COUNTRIES=IR,KP,SY
```

### 3. Set Security Limits
The following security measures are automatically enforced:
- Daily spending limit: $10,000 USD equivalent
- Monthly spending limit: $50,000 USD equivalent
- Failed payment attempts: 5 per 24 hours
- Payment velocity: Max 3 payments per 10 minutes

These limits can be adjusted in:
`src/billing/services/payment-security.service.ts`

## Testing Setup

### 1. Use Test Mode
Ensure you're using test API keys (starting with `sk_test_` and `pk_test_`)

### 2. Test Card Numbers
Use Stripe's test card numbers:
```
# Successful payment
4242424242424242

# Declined payment
4000000000000002

# Requires authentication
4000002500003155
```

### 3. Test Webhooks Locally
Install Stripe CLI for local webhook testing:
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/v1/stripe/webhook

# In another terminal, trigger test events
stripe trigger payment_intent.succeeded
```

## Production Deployment

### 1. Switch to Live Mode
1. Replace test API keys with live keys:
   ```bash
   STRIPE_SECRET_KEY=sk_live_your_live_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
   ```

2. Update webhook endpoint with production URL

### 2. Enable Production Security Features
```bash
STRIPE_RADAR_RULES=true
STRIPE_REQUIRE_AUTH=true
STRIPE_AUTOMATIC_TAX=true  # If required in your jurisdiction
```

### 3. Configure SSL/TLS
Ensure your webhook endpoint is secured with HTTPS.

### 4. Set Up Monitoring
Monitor the following endpoints:
- Payment success rates
- Webhook delivery success
- Error rates and patterns
- Security alerts

## API Endpoints

### Payment Processing
```bash
# Create customer
POST /api/v1/stripe/customer

# Create payment intent
POST /api/v1/stripe/payment-intent

# Confirm payment
POST /api/v1/stripe/payment-intent/{id}/confirm

# Create setup intent (save payment method)
POST /api/v1/stripe/setup-intent
```

### Subscription Management
```bash
# Create subscription
POST /api/v1/stripe/subscription

# Update subscription
PUT /api/v1/stripe/subscription/{id}

# Cancel subscription
DELETE /api/v1/stripe/subscription/{id}

# Get subscription details
GET /api/v1/stripe/subscription/{id}
```

### Payment Methods
```bash
# List payment methods
GET /api/v1/stripe/customer/{id}/payment-methods

# Remove payment method
DELETE /api/v1/stripe/payment-method/{id}
```

### Configuration
```bash
# Get publishable key
GET /api/v1/stripe/config/publishable-key
```

## Database Schema

The system uses the following enhanced schemas:

### EnhancedPayment
- Comprehensive payment tracking
- Status history and audit trail
- Risk assessment data
- Webhook event logging

### Subscription
- Subscription lifecycle management
- Trial period tracking
- Billing cycle management

### BillingCustomer
- Customer profile with Stripe integration
- Payment method storage
- Billing address management

## Error Handling

### Payment Errors
The system handles various payment scenarios:
- Card declined
- Insufficient funds
- Authentication required
- Processing errors

### Security Errors
- Geographic restrictions
- Velocity limits exceeded
- Risk assessment failures

### Webhook Errors
- Signature verification failures
- Event processing errors
- Retry mechanisms

## Troubleshooting

### Common Issues

#### 1. Webhook Signature Verification Failed
```
Error: Invalid signature
```
**Solution**: Verify webhook secret is correctly set in environment variables.

#### 2. Payment Method Not Supported
```
Error: Payment method not supported in your country
```
**Solution**: Check geographic restrictions and enabled payment methods.

#### 3. Subscription Creation Failed
```
Error: No price configured for account type
```
**Solution**: Ensure all product and price IDs are correctly configured.

#### 4. Security Check Failed
```
Error: Payment blocked by security rules
```
**Solution**: Check security service logs for specific violation.

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

### Support Resources
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Webhook Testing Guide](https://stripe.com/docs/webhooks/test)
- [Security Best Practices](https://stripe.com/docs/security)

## Maintenance

### Regular Tasks
1. Monitor webhook delivery rates
2. Review failed payment patterns
3. Update security rules as needed
4. Monitor subscription churn rates
5. Review and update product pricing

### Security Reviews
1. Regularly review security logs
2. Update geographic restrictions as needed
3. Monitor for unusual payment patterns
4. Review and update spending limits

### Performance Monitoring
1. Monitor API response times
2. Track webhook processing times
3. Monitor database query performance
4. Review error rates and patterns

---

## Support

For technical support or questions about this implementation, please refer to:
- Application logs in `LOG_LEVEL=debug` mode
- Stripe Dashboard for payment details
- MongoDB logs for database issues
- Redis logs for caching issues

Remember to never expose sensitive information like API keys in logs or error messages.