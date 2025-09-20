export enum TransactionCategory {
  // Essential Categories
  FOOD_DINING = 'food_dining',
  TRANSPORTATION = 'transportation',
  HOUSING = 'housing',
  UTILITIES = 'utilities',
  HEALTHCARE = 'healthcare',

  // Lifestyle Categories
  ENTERTAINMENT = 'entertainment',
  SHOPPING = 'shopping',
  TRAVEL = 'travel',
  EDUCATION = 'education',
  FITNESS = 'fitness',

  // Financial Categories
  INVESTMENTS = 'investments',
  INSURANCE = 'insurance',
  TAXES = 'taxes',
  DEBT_PAYMENTS = 'debt_payments',
  SAVINGS = 'savings',

  // Business Categories (for business accounts)
  OFFICE_SUPPLIES = 'office_supplies',
  MARKETING = 'marketing',
  PROFESSIONAL_SERVICES = 'professional_services',
  SOFTWARE_SUBSCRIPTIONS = 'software_subscriptions',
  EQUIPMENT = 'equipment',

  // Other
  GIFTS_DONATIONS = 'gifts_donations',
  PERSONAL_CARE = 'personal_care',
  CHILDCARE = 'childcare',
  PET_CARE = 'pet_care',
  MISCELLANEOUS = 'miscellaneous'
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  DIGITAL_WALLET = 'digital_wallet',
  CHECK = 'check',
  OTHER = 'other'
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  CAD = 'CAD',
  AUD = 'AUD',
  CHF = 'CHF',
  CNY = 'CNY',
  INR = 'INR',
  BRL = 'BRL',
  MXN = 'MXN',
  ARS = 'ARS', // Argentine Peso
  COP = 'COP', // Colombian Peso
  CLP = 'CLP', // Chilean Peso
  PEN = 'PEN' // Peruvian Sol
}

// Category configurations with icons and colors
export const CATEGORY_CONFIG = {
  [TransactionCategory.FOOD_DINING]: {
    icon: '🍽️',
    color: '#FF6B6B',
    subcategories: [
      'restaurant',
      'fast_food',
      'groceries',
      'coffee',
      'alcohol',
      'delivery'
    ]
  },

  [TransactionCategory.TRANSPORTATION]: {
    icon: '🚗',
    color: '#4ECDC4',
    subcategories: [
      'gas',
      'public_transport',
      'taxi_uber',
      'parking',
      'maintenance',
      'car_insurance'
    ]
  },

  [TransactionCategory.HOUSING]: {
    icon: '🏠',
    color: '#45B7D1',
    subcategories: [
      'rent_mortgage',
      'maintenance',
      'furniture',
      'home_improvement',
      'security'
    ]
  },

  [TransactionCategory.UTILITIES]: {
    icon: '💡',
    color: '#F9CA24',
    subcategories: [
      'electricity',
      'water',
      'gas',
      'internet',
      'phone',
      'cable_tv'
    ]
  },

  [TransactionCategory.HEALTHCARE]: {
    icon: '🏥',
    color: '#6C5CE7',
    subcategories: [
      'doctor_visits',
      'pharmacy',
      'dental',
      'vision',
      'therapy',
      'medical_equipment'
    ]
  },

  [TransactionCategory.ENTERTAINMENT]: {
    icon: '🎬',
    color: '#FD79A8',
    subcategories: [
      'movies',
      'concerts',
      'games',
      'streaming_services',
      'books',
      'hobbies'
    ]
  },

  [TransactionCategory.SHOPPING]: {
    icon: '🛒',
    color: '#00B894',
    subcategories: [
      'clothing',
      'electronics',
      'home_goods',
      'personal_items',
      'gifts'
    ]
  },

  [TransactionCategory.TRAVEL]: {
    icon: '✈️',
    color: '#0984E3',
    subcategories: [
      'flights',
      'hotels',
      'car_rental',
      'activities',
      'meals',
      'souvenirs'
    ]
  },

  [TransactionCategory.EDUCATION]: {
    icon: '🎓',
    color: '#A29BFE',
    subcategories: [
      'tuition',
      'books',
      'supplies',
      'courses',
      'training'
    ]
  },

  [TransactionCategory.FITNESS]: {
    icon: '💪',
    color: '#00CEC9',
    subcategories: [
      'gym_membership',
      'personal_trainer',
      'sports_equipment',
      'supplements',
      'classes'
    ]
  },

  [TransactionCategory.MISCELLANEOUS]: {
    icon: '❓',
    color: '#636E72',
    subcategories: [
      'other',
      'unknown'
    ]
  }
};

// AI categorization keywords mapping
export const CATEGORY_KEYWORDS = {
  [TransactionCategory.FOOD_DINING]: [
    'restaurant',
    'food',
    'dining',
    'lunch',
    'dinner',
    'breakfast',
    'pizza',
    'burger',
    'coffee',
    'starbucks',
    'mcdonalds',
    'kfc',
    'grocery',
    'supermarket',
    'market',
    'walmart',
    'target'
  ],

  [TransactionCategory.TRANSPORTATION]: [
    'gas',
    'fuel',
    'uber',
    'lyft',
    'taxi',
    'bus',
    'train',
    'subway',
    'parking',
    'toll',
    'car',
    'vehicle',
    'automotive',
    'shell',
    'exxon'
  ],

  [TransactionCategory.HOUSING]: [
    'rent',
    'mortgage',
    'home',
    'apartment',
    'house',
    'property',
    'furniture',
    'ikea',
    'home depot',
    'lowes'
  ],

  [TransactionCategory.UTILITIES]: [
    'electric',
    'electricity',
    'power',
    'water',
    'gas',
    'internet',
    'phone',
    'mobile',
    'cable',
    'tv',
    'utility'
  ],

  [TransactionCategory.HEALTHCARE]: [
    'doctor',
    'hospital',
    'medical',
    'pharmacy',
    'medicine',
    'dental',
    'dentist',
    'therapy',
    'health',
    'clinic',
    'cvs',
    'walgreens'
  ],

  [TransactionCategory.ENTERTAINMENT]: [
    'movie',
    'cinema',
    'theater',
    'concert',
    'music',
    'netflix',
    'spotify',
    'game',
    'gaming',
    'entertainment',
    'fun'
  ],

  [TransactionCategory.SHOPPING]: [
    'shopping',
    'store',
    'mall',
    'amazon',
    'ebay',
    'clothing',
    'clothes',
    'shoes',
    'electronics',
    'best buy'
  ],

  [TransactionCategory.TRAVEL]: [
    'travel',
    'flight',
    'airline',
    'hotel',
    'booking',
    'airbnb',
    'vacation',
    'trip',
    'tourism',
    'expedia'
  ]
};
