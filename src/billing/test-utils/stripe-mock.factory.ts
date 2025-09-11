import {Types} from 'mongoose';
import Stripe from 'stripe';

/**
 * Comprehensive Stripe API Mocking Factory
 * Provides mock implementations for all Stripe API methods used in the application
 */
export class StripeMockFactory {
  private static instance: StripeMockFactory;
  private mockStripe: jest.Mocked<Stripe>;

  private constructor() {
    this.setupMockStripe();
  }

  static getInstance(): StripeMockFactory {
    if (!StripeMockFactory.instance) {
      StripeMockFactory.instance = new StripeMockFactory();
    }
    return StripeMockFactory.instance;
  }

  private setupMockStripe(): void {
    this.mockStripe = {
      // Customer methods
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        list: jest.fn()
      },

      // Payment Intent methods
      paymentIntents: {
        create: jest.fn(),
        confirm: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn()
      },

      // Subscription methods
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn()
      },

      // Setup Intent methods
      setupIntents: {
        create: jest.fn(),
        confirm: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn()
      },

      // Payment Method methods
      paymentMethods: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        attach: jest.fn(),
        detach: jest.fn(),
        list: jest.fn()
      },

      // Invoice methods
      invoices: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        finalize: jest.fn(),
        pay: jest.fn(),
        list: jest.fn(),
        upcoming: jest.fn()
      },

      // Webhook methods
      webhooks: {
        constructEvent: jest.fn()
      },

      // Product methods
      products: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        list: jest.fn(),
        delete: jest.fn()
      },

      // Price methods
      prices: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        list: jest.fn()
      },

      // Charge methods
      charges: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        capture: jest.fn(),
        list: jest.fn()
      },

      // Refund methods
      refunds: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        list: jest.fn()
      },

      // Dispute methods
      disputes: {
        retrieve: jest.fn(),
        update: jest.fn(),
        close: jest.fn(),
        list: jest.fn()
      },

      // Event methods
      events: {
        retrieve: jest.fn(),
        list: jest.fn()
      },

      // Balance methods
      balance: {
        retrieve: jest.fn()
      },

      // Balance Transaction methods
      balanceTransactions: {
        retrieve: jest.fn(),
        list: jest.fn()
      }
    } as any;
  }

  getMockStripe(): jest.Mocked<Stripe> {
    return this.mockStripe;
  }

  reset(): void {
    Object.values(this.mockStripe.customers).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.paymentIntents).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.subscriptions).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.setupIntents).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.paymentMethods).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.invoices).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.webhooks).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.products).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.prices).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.charges).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.refunds).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.disputes).forEach(mock => mock.mockReset());
    Object.values(this.mockStripe.events).forEach(mock => mock.mockReset());
  }

  // Mock data factories
  createMockCustomer(overrides: Partial<Stripe.Customer> = {}): Stripe.Customer {
    return {
      id: 'cus_' + this.generateId(),
      object: 'customer',
      created: Math.floor(Date.now() / 1000),
      email: 'test@savium.ai',
      name: 'John Doe',
      phone: '+1234567890',
      address: {
        line1: '123 Main St',
        line2: null,
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      },
      balance: 0,
      currency: 'usd',
      default_source: null,
      delinquent: false,
      description: null,
      discount: null,
      invoice_prefix: 'TEST',
      invoice_settings: {
        custom_fields: null,
        default_payment_method: null,
        footer: null,
        rendering_options: null
      },
      livemode: false,
      metadata: {},
      preferred_locales: [],
      shipping: null,
      sources: {
        object: 'list',
        data: [],
        has_more: false,
        url: '/v1/customers/cus_test/sources'
      } as any,
      subscriptions: {
        object: 'list',
        data: [],
        has_more: false,
        url: '/v1/customers/cus_test/subscriptions'
      } as any,
      tax_exempt: 'none',
      tax_ids: {
        object: 'list',
        data: [],
        has_more: false,
        url: '/v1/customers/cus_test/tax_ids'
      } as any,
      ...overrides
    };
  }

  createMockPaymentIntent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
    const id = 'pi_' + this.generateId();
    return {
      id,
      object: 'payment_intent',
      amount: 2999,
      amount_capturable: 0,
      amount_details: {
        tip: {}
      },
      amount_received: 0,
      application: null,
      application_fee_amount: null,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      canceled_at: null,
      cancellation_reason: null,
      capture_method: 'automatic',
      client_secret: `${id}_secret_test`,
      confirmation_method: 'manual',
      created: Math.floor(Date.now() / 1000),
      currency: 'usd',
      customer: 'cus_test_customer',
      description: 'Test payment intent',
      last_payment_error: null,
      latest_charge: null,
      livemode: false,
      metadata: {},
      next_action: null,
      on_behalf_of: null,
      payment_method: null,
      payment_method_configuration_details: null,
      payment_method_options: {},
      payment_method_types: ['card'],
      processing: null,
      receipt_email: null,
      review: null,
      setup_future_usage: null,
      shipping: null,
      source: null,
      statement_descriptor: null,
      statement_descriptor_suffix: null,
      status: 'requires_payment_method',
      transfer_data: null,
      transfer_group: null,
      ...overrides
    } as Stripe.PaymentIntent;
  }

  createMockSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
    const id = 'sub_' + this.generateId();
    const now = Math.floor(Date.now() / 1000);
    return {
      id,
      object: 'subscription',
      application: null,
      application_fee_percent: null,
      automatic_tax: {
        enabled: false,
        liability: null,
        disabled_reason: null
      } as any,
      billing_cycle_anchor: now,
      billing_thresholds: null,
      cancel_at: null,
      cancel_at_period_end: false,
      canceled_at: null,
      cancellation_details: null,
      collection_method: 'charge_automatically',
      created: now,
      currency: 'usd',
      customer: 'cus_test_customer',
      days_until_due: null,
      default_payment_method: null,
      default_source: null,
      default_tax_rates: [],
      description: null,
      ended_at: null,
      invoice_settings: {} as any,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_' + this.generateId(),
            object: 'subscription_item',
            billing_thresholds: null,
            created: now,
            current_period_start: now,
            current_period_end: now + 2592000,
            discounts: [],
            plan: {id: 'plan_test', object: 'plan'} as any,
            metadata: {},
            price: {
              id: 'price_' + this.generateId(),
              object: 'price',
              active: true,
              billing_scheme: 'per_unit',
              created: now,
              currency: 'usd',
              custom_unit_amount: null,
              livemode: false,
              lookup_key: null,
              metadata: {},
              nickname: null,
              product: 'prod_test',
              recurring: {
                interval: 'month',
                interval_count: 1
              },
              type: 'recurring',
              unit_amount: 999
            } as any,
            quantity: 1,
            subscription: id,
            tax_rates: []
          }
        ],
        has_more: false,
        url: `/v1/subscription_items?subscription=${id}`
      },
      latest_invoice: null,
      livemode: false,
      metadata: {},
      next_pending_invoice_item_invoice: null,
      on_behalf_of: null,
      pause_collection: null,
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'off'
      } as any,
      pending_invoice_item_interval: null,
      pending_setup_intent: null,
      pending_update: null,
      schedule: null,
      start_date: now,
      status: 'active',
      test_clock: null,
      transfer_data: null,
      trial_end: null,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'create_invoice'
        }
      },
      trial_start: null,
      ...overrides
    } as Stripe.Subscription;
  }

  createMockPaymentMethod(overrides: Partial<Stripe.PaymentMethod> = {}): Stripe.PaymentMethod {
    return {
      id: 'pm_' + this.generateId(),
      object: 'payment_method',
      allow_redisplay: 'unspecified',
      billing_details: {
        address: {
          city: null,
          country: null,
          line1: null,
          line2: null,
          postal_code: null,
          state: null
        },
        email: null,
        name: null,
        phone: null,
        tax_id: null
      },
      created: Math.floor(Date.now() / 1000),
      customer: 'cus_test_customer',
      livemode: false,
      metadata: {},
      type: 'card',
      card: {
        brand: 'visa',
        checks: {
          address_line1_check: null,
          address_postal_code_check: null,
          cvc_check: 'pass'
        },
        country: 'US',
        display_brand: 'visa',
        exp_month: 12,
        exp_year: 2025,
        fingerprint: 'test_fingerprint',
        funding: 'credit',
        generated_from: null,
        last4: '4242',
        networks: {
          available: ['visa'],
          preferred: null
        },
        three_d_secure_usage: {
          supported: true
        },
        wallet: null,
        regulated_status: null
      },
      ...overrides
    };
  }

  createMockSetupIntent(overrides: Partial<Stripe.SetupIntent> = {}): Stripe.SetupIntent {
    const id = 'seti_' + this.generateId();
    return {
      id,
      object: 'setup_intent',
      application: null,
      attach_to_self: false,
      cancellation_reason: null,
      client_secret: `${id}_secret_test`,
      created: Math.floor(Date.now() / 1000),
      customer: 'cus_test_customer',
      description: null,
      flow_directions: null,
      last_setup_error: null,
      latest_attempt: null,
      livemode: false,
      mandate: null,
      metadata: {},
      next_action: null,
      on_behalf_of: null,
      payment_method: null,
      payment_method_configuration_details: null,
      payment_method_options: {},
      payment_method_types: ['card'],
      single_use_mandate: null,
      status: 'requires_payment_method',
      usage: 'off_session',
      ...overrides
    } as Stripe.SetupIntent;
  }

  createMockInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
    const id = 'in_' + this.generateId();
    const now = Math.floor(Date.now() / 1000);
    return {
      id,
      object: 'invoice',
      account_country: 'US',
      account_name: 'Savium Finance',
      account_tax_ids: null,
      amount_due: 2999,
      amount_paid: 0,
      amount_remaining: 2999,
      amount_shipping: 0,
      application: null,
      attempt_count: 1,
      attempted: true,
      auto_advance: false,
      automatic_tax: {
        enabled: false,
        liability: null,
        status: null,
        disabled_reason: null,
        provider: null
      } as any,
      billing_reason: 'subscription_cycle',
      collection_method: 'charge_automatically',
      created: now,
      currency: 'usd',
      custom_fields: null,
      customer: 'cus_test_customer',
      customer_address: null,
      customer_email: 'test@savium.ai',
      customer_name: 'John Doe',
      customer_phone: null,
      customer_shipping: null,
      customer_tax_exempt: 'none',
      customer_tax_ids: [],
      default_payment_method: null,
      default_source: null,
      default_tax_rates: [],
      description: null,
      discounts: [],
      due_date: null,
      effective_at: null,
      ending_balance: null,
      footer: null,
      from_invoice: null,
      hosted_invoice_url: `https://invoice.stripe.com/i/test_${id}`,
      invoice_pdf: `https://pay.stripe.com/invoice/${id}/pdf`,
      issuer: {
        type: 'self'
      },
      last_finalization_error: null,
      latest_revision: null,
      lines: {
        object: 'list',
        data: [],
        has_more: false,
        url: `/v1/invoices/${id}/lines`
      } as any,
      livemode: false,
      metadata: {},
      next_payment_attempt: null,
      number: `TEST-${id.slice(-6).toUpperCase()}`,
      on_behalf_of: null,
      payment_settings: {
        payment_method_types: ['card']
      } as any,
      period_end: now + 30 * 24 * 60 * 60,
      period_start: now,
      post_payment_credit_notes_amount: 0,
      pre_payment_credit_notes_amount: 0,
      receipt_number: null,
      starting_balance: 0,
      statement_descriptor: null,
      status: 'draft',
      status_transitions: {
        finalized_at: null,
        marked_uncollectible_at: null,
        paid_at: null,
        voided_at: null
      },
      subtotal: 2999,
      subtotal_excluding_tax: null,
      test_clock: null,
      total: 2999,
      total_discount_amounts: [],
      total_excluding_tax: null,
      webhooks_delivered_at: null,
      ...overrides
    } as Stripe.Invoice;
  }

  createMockCharge(overrides: Partial<Stripe.Charge> = {}): Stripe.Charge {
    return {
      id: 'ch_' + this.generateId(),
      object: 'charge',
      amount: 2999,
      amount_captured: 2999,
      amount_refunded: 0,
      application: null,
      application_fee: null,
      application_fee_amount: null,
      balance_transaction: 'txn_' + this.generateId(),
      billing_details: {
        address: {
          city: null,
          country: null,
          line1: null,
          line2: null,
          postal_code: null,
          state: null
        },
        email: null,
        name: null,
        phone: null,
        tax_id: null
      },
      calculated_statement_descriptor: null,
      captured: true,
      created: Math.floor(Date.now() / 1000),
      currency: 'usd',
      customer: 'cus_test_customer',
      description: 'Test charge',
      disputed: false,
      failure_balance_transaction: null,
      failure_code: null,
      failure_message: null,
      fraud_details: {},
      livemode: false,
      metadata: {},
      on_behalf_of: null,
      outcome: {
        network_status: 'approved_by_network',
        reason: null,
        risk_level: 'normal',
        risk_score: 32,
        seller_message: 'Payment complete.',
        type: 'authorized',
        advice_code: null,
        network_advice_code: null,
        network_decline_code: null
      } as any,
      paid: true,
      payment_intent: 'pi_test_payment_intent',
      payment_method: 'pm_test_payment_method',
      payment_method_details: {
        card: {
          amount_authorized: 2999,
          brand: 'visa',
          checks: {
            address_line1_check: null,
            address_postal_code_check: null,
            cvc_check: 'pass'
          },
          country: 'US',
          exp_month: 12,
          exp_year: 2025,
          extended_authorization: {
            status: 'disabled'
          },
          fingerprint: 'test_fingerprint',
          funding: 'credit',
          incremental_authorization: {
            status: 'unavailable'
          },
          installments: null,
          last4: '4242',
          mandate: null,
          multicapture: {
            status: 'unavailable'
          },
          network: 'visa',
          network_token: {
            used: false
          },
          overcapture: {
            maximum_amount_capturable: 2999,
            status: 'unavailable'
          },
          three_d_secure: null,
          wallet: null,
          authorization_code: null,
          network_transaction_id: null,
          regulated_status: null
        } as any,
        type: 'card'
      },
      receipt_email: null,
      receipt_number: 'TEST-' + this.generateId().slice(-8).toUpperCase(),
      receipt_url: 'https://pay.stripe.com/receipts/test_' + this.generateId(),
      refunded: false,
      refunds: {
        object: 'list',
        data: [],
        has_more: false,
        url: `/v1/charges/ch_test/refunds`
      } as any,
      review: null,
      shipping: null,
      source: null,
      source_transfer: null,
      statement_descriptor: null,
      statement_descriptor_suffix: null,
      status: 'succeeded',
      transfer_data: null,
      transfer_group: null,
      ...overrides
    };
  }

  createMockEvent(type: string, data: any = {}): Stripe.Event {
    return {
      id: 'evt_' + this.generateId(),
      object: 'event',
      api_version: '2024-12-18.acacia',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: type.includes('payment_intent')
            ? 'pi_' + this.generateId()
            : type.includes('customer')
              ? 'cus_' + this.generateId()
              : type.includes('subscription')
                ? 'sub_' + this.generateId()
                : type.includes('invoice')
                  ? 'in_' + this.generateId()
                  : 'obj_' + this.generateId(),
          object: type.split('.')[0],
          ...data
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_' + this.generateId(),
        idempotency_key: null
      },
      type: type as Stripe.Event.Type
    } as Stripe.Event;
  }

  createMockDispute(overrides: Partial<Stripe.Dispute> = {}): Stripe.Dispute {
    return {
      id: 'dp_' + this.generateId(),
      object: 'dispute',
      amount: 2999,
      balance_transactions: [],
      charge: 'ch_' + this.generateId(),
      created: Math.floor(Date.now() / 1000),
      currency: 'usd',
      evidence: {
        access_activity_log: null,
        billing_address: null,
        cancellation_policy: null,
        cancellation_policy_disclosure: null,
        cancellation_rebuttal: null,
        customer_communication: null,
        customer_email_address: null,
        customer_name: null,
        customer_purchase_ip: null,
        customer_signature: null,
        duplicate_charge_documentation: null,
        duplicate_charge_explanation: null,
        duplicate_charge_id: null,
        product_description: null,
        receipt: null,
        refund_policy: null,
        refund_policy_disclosure: null,
        refund_refusal_explanation: null,
        service_date: null,
        service_documentation: null,
        shipping_address: null,
        shipping_carrier: null,
        shipping_date: null,
        shipping_documentation: null,
        shipping_tracking_number: null,
        uncategorized_file: null,
        uncategorized_text: null,
        enhanced_evidence: {}
      } as any,
      evidence_details: {
        due_by: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000),
        has_evidence: false,
        past_due: false,
        submission_count: 0,
        enhanced_eligibility: {}
      } as any,
      is_charge_refundable: true,
      livemode: false,
      metadata: {},
      network_reason_code: '4855',
      reason: 'fraudulent',
      status: 'warning_needs_response',
      ...overrides
    } as Stripe.Dispute;
  }

  // Setup common successful mock responses
  setupSuccessfulMocks(): void {
    // Customer mocks
    (this.mockStripe.customers.create as jest.Mock).mockImplementation((params: any) =>
      Promise.resolve(
        this.createMockCustomer({
          email: params.email,
          name: params.name,
          phone: params.phone,
          address: params.address,
          metadata: params.metadata
        })
      )
    );

    (this.mockStripe.customers.retrieve as jest.Mock).mockImplementation((id: string) => Promise.resolve(this.createMockCustomer({id, })));

    // Payment Intent mocks
    (this.mockStripe.paymentIntents.create as jest.Mock).mockImplementation((params: any) =>
      Promise.resolve(
        this.createMockPaymentIntent({
          amount: params.amount,
          currency: params.currency,
          customer: params.customer,
          description: params.description,
          payment_method_types: params.payment_method_types,
          capture_method: params.capture_method,
          metadata: params.metadata
        })
      )
    );

    (this.mockStripe.paymentIntents.confirm as jest.Mock).mockImplementation((id: string, params: any) =>
      Promise.resolve(
        this.createMockPaymentIntent({
          id,
          status: 'succeeded',
          payment_method: params.payment_method
        })
      )
    );

    // Subscription mocks
    (this.mockStripe.subscriptions.create as jest.Mock).mockImplementation((params: any) =>
      Promise.resolve(
        this.createMockSubscription({
          customer: params.customer,
          metadata: params.metadata,
          automatic_tax: params.automatic_tax
        })
      )
    );

    (this.mockStripe.subscriptions.retrieve as jest.Mock).mockImplementation((id: string) => Promise.resolve(this.createMockSubscription({id})));

    (this.mockStripe.subscriptions.update as jest.Mock).mockImplementation((id: string, params: any) =>
      Promise.resolve(
        this.createMockSubscription({
          id,
          cancel_at_period_end: params.cancel_at_period_end,
          metadata: params.metadata
        })
      )
    );

    (this.mockStripe.subscriptions.cancel as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(
        this.createMockSubscription({
          id,
          status: 'canceled',
          canceled_at: Math.floor(Date.now() / 1000)
        })
      )
    );

    // Setup Intent mocks
    (this.mockStripe.setupIntents.create as jest.Mock).mockImplementation((params: any) =>
      Promise.resolve(
        this.createMockSetupIntent({
          customer: params.customer,
          payment_method_types: params.payment_method_types,
          usage: params.usage,
          metadata: params.metadata
        })
      )
    );

    // Payment Method mocks
    (this.mockStripe.paymentMethods.list as jest.Mock).mockImplementation((params: any) =>
      Promise.resolve({
        object: 'list',
        data: [
          this.createMockPaymentMethod({customer: params.customer, type: params.type}),
          this.createMockPaymentMethod({
            customer: params.customer,
            type: params.type,
            id: 'pm_' + this.generateId()
          })
        ],
        has_more: false,
        url: '/v1/payment_methods'
      })
    );

    (this.mockStripe.paymentMethods.detach as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(this.createMockPaymentMethod({id, customer: null}))
    );

    // Webhook mocks
    (this.mockStripe.webhooks.constructEvent as jest.Mock).mockImplementation((payload, signature, secret) => {
      const event = JSON.parse(payload.toString());
      return this.createMockEvent(event.type, event.data?.object);
    });
  }

  // Setup error mocks for testing failure scenarios
  setupErrorMocks(): void {
    const stripeError = new Error('Test Stripe Error') as any;
    stripeError.type = 'StripeError';
    stripeError.code = 'card_declined';

    (this.mockStripe.paymentIntents.confirm as jest.Mock).mockRejectedValue(stripeError);
    (this.mockStripe.customers.create as jest.Mock).mockRejectedValue(stripeError);
    (this.mockStripe.subscriptions.create as jest.Mock).mockRejectedValue(stripeError);
  }

  // Utility methods
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Helper methods for specific test scenarios
  mockPaymentIntentRequiresAction(paymentIntentId: string): void {
    (this.mockStripe.paymentIntents.confirm as jest.Mock).mockResolvedValue(
      this.createMockPaymentIntent({
        id: paymentIntentId,
        status: 'requires_action',
        next_action: {
          type: 'use_stripe_sdk',
          use_stripe_sdk: {
            type: 'three_d_secure_redirect',
            stripe_js: 'https://js.stripe.com/v3'
          }
        }
      })
    );
  }

  mockPaymentIntentFailed(paymentIntentId: string, errorCode: string = 'card_declined'): void {
    (this.mockStripe.paymentIntents.confirm as jest.Mock).mockResolvedValue(
      this.createMockPaymentIntent({
        id: paymentIntentId,
        status: 'requires_payment_method',
        last_payment_error: {
          code: errorCode as any,
          message: 'Your card was declined.',
          type: 'card_error',
          decline_code: 'generic_decline'
        }
      })
    );
  }

  mockSubscriptionTrialing(subscriptionId: string, trialDays: number = 14): void {
    const now = Math.floor(Date.now() / 1000);
    const trialEnd = now + trialDays * 24 * 60 * 60;

    (this.mockStripe.subscriptions.create as jest.Mock).mockResolvedValue(
      this.createMockSubscription({
        id: subscriptionId,
        status: 'trialing',
        trial_start: now,
        trial_end: trialEnd
      })
    );
  }

  mockWebhookSignatureVerificationFailed(): void {
    (this.mockStripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      const error = new Error('Invalid signature');
      error.name = 'StripeSignatureVerificationError';
      throw error;
    });
  }

  mockRateLimitError(): void {
    const rateLimitError = new Error('Too Many Requests') as any;
    rateLimitError.type = 'StripeRateLimitError';
    rateLimitError.statusCode = 429;

    (this.mockStripe.customers.create as jest.Mock).mockRejectedValue(rateLimitError);
    (this.mockStripe.paymentIntents.create as jest.Mock).mockRejectedValue(rateLimitError);
    (this.mockStripe.subscriptions.create as jest.Mock).mockRejectedValue(rateLimitError);
  }

}

// Export singleton instance
export const stripeMockFactory = StripeMockFactory.getInstance();
