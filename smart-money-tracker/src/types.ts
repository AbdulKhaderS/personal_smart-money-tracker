export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  monthlyIncome: number;
  currency: string;
  budgetSettings: Record<string, number>;
  createdAt: string;
}

export interface Expense {
  id: string;
  uid: string;
  name: string;
  amount: number;
  category: string;
  date: any; // Firestore Timestamp
  notes?: string;
}

export interface Income {
  id: string;
  uid: string;
  source: string;
  amount: number;
  date: any; // Firestore Timestamp
}

export interface Remittance {
  id: string;
  uid: string;
  amount: number;
  date: any; // Firestore Timestamp
  notes?: string;
}

export interface Category {
  id: string;
  uid: string;
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES = [
  { name: 'Rent', icon: 'Home', color: '#3B82F6' },
  { name: 'Food Sharing', icon: 'Utensils', color: '#EF4444' },
  { name: 'Mobile Recharge', icon: 'Smartphone', color: '#10B981' },
  { name: 'Send Money Home', icon: 'Send', color: '#F59E0B' },
  { name: 'Personal Items', icon: 'ShoppingBag', color: '#8B5CF6' },
  { name: 'Other', icon: 'Plus', color: '#6B7280' },
];
