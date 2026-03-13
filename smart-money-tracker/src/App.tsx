import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  PieChart, 
  Wallet, 
  Send, 
  Settings, 
  LogOut, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Menu, 
  X, 
  Smartphone, 
  Utensils, 
  Home, 
  ShoppingBag, 
  Plus,
  Download
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc, 
  orderBy, 
  Timestamp, 
  addDoc 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { format } from 'date-fns';

import { auth, db, signIn, logOut } from './firebase';
import { cn } from './lib/utils';
import { UserProfile, Expense, Income, Remittance, Category, DEFAULT_CATEGORIES } from './types';
import { getSpendingInsights } from './services/aiService';

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string; key?: string | number }) => (
  <div className={cn("bg-white rounded-2xl p-6 shadow-sm border border-black/5", className)}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md",
    secondary: "bg-amber-500 text-white hover:bg-amber-600 shadow-md",
    outline: "border border-emerald-600 text-emerald-600 hover:bg-emerald-50",
    ghost: "text-gray-600 hover:bg-gray-100",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-md"
  };

  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profileRef = doc(db, 'users', u.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || '',
            monthlyIncome: 250,
            currency: 'KD',
            budgetSettings: {
              'Rent': 40,
              'Food Sharing': 15,
              'Mobile Recharge': 5,
              'Send Money Home': 50,
              'Personal Items': 10,
            },
            createdAt: new Date().toISOString(),
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(profileSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const qExpenses = query(collection(db, 'users', user.uid, 'expenses'), orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(qExpenses, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    });

    const qRemittances = query(collection(db, 'users', user.uid, 'remittances'), orderBy('date', 'desc'));
    const unsubRemittances = onSnapshot(qRemittances, (snap) => {
      setRemittances(snap.docs.map(d => ({ id: d.id, ...d.data() } as Remittance)));
    });

    return () => {
      unsubExpenses();
      unsubRemittances();
    };
  }, [user]);

  // AI Insights
  useEffect(() => {
    if (profile && expenses.length > 0) {
      const categoryTotals = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
      }, {} as Record<string, number>);

      const expenseList = Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount: amount as number }));
      
      getSpendingInsights(profile.monthlyIncome, expenseList).then(setAiInsights);
    }
  }, [profile, expenses]);

  // Calculations
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const totalIncome = profile?.monthlyIncome || 0;
  const balance = totalIncome - totalExpenses;
  const totalRemitted = useMemo(() => remittances.reduce((sum, r) => sum + r.amount, 0), [remittances]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    expenses.forEach(e => {
      data[e.category] = (data[e.category] || 0) + e.amount;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];

  const handleExportCSV = () => {
    if (expenses.length === 0) return;

    const headers = ['Date', 'Name', 'Category', 'Amount (KD)', 'Notes'];
    const rows = expenses.map(exp => [
      format(exp.date.toDate(), 'yyyy-MM-dd'),
      `"${exp.name.replace(/"/g, '""')}"`,
      exp.category,
      exp.amount.toFixed(3),
      `"${(exp.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `recent-expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight text-emerald-900">Sharif Lala</h1>
            <p className="text-stone-500 italic">Smart Money Tracker for Kuwait Workers</p>
          </div>
          
          <div className="relative aspect-square w-64 mx-auto">
             <div className="absolute inset-0 bg-emerald-100 rounded-full blur-3xl opacity-50" />
             <div className="relative z-10 flex items-center justify-center h-full">
                <Wallet className="w-32 h-32 text-emerald-600" />
             </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-stone-800">Welcome Back</h2>
            <p className="text-stone-600">Track your salary, expenses, and money sent home easily.</p>
            <Button onClick={signIn} className="w-full py-4 text-lg">
              Sign in with Google
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-emerald-50 border-emerald-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-emerald-700 text-sm font-medium uppercase tracking-wider">Income</p>
                    <h3 className="text-3xl font-bold text-emerald-900">{totalIncome} KD</h3>
                  </div>
                  <TrendingUp className="text-emerald-600" />
                </div>
              </Card>
              <Card className="bg-red-50 border-red-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-red-700 text-sm font-medium uppercase tracking-wider">Expenses</p>
                    <h3 className="text-3xl font-bold text-red-900">{totalExpenses} KD</h3>
                  </div>
                  <TrendingDown className="text-red-600" />
                </div>
              </Card>
              <Card className={cn("border-2", balance >= 0 ? "bg-emerald-600 text-white border-emerald-500" : "bg-red-600 text-white border-red-500")}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="opacity-80 text-sm font-medium uppercase tracking-wider">Balance</p>
                    <h3 className="text-3xl font-bold">{balance} KD</h3>
                  </div>
                  <Wallet className="opacity-80" />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={chartData.length > 0 ? chartData : [{ name: 'No Data', value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        {chartData.length === 0 && <Cell fill="#e5e7eb" />}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {chartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center text-sm">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-gray-600 truncate">{entry.name}</span>
                      <span className="ml-auto font-medium">{entry.value} KD</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="bg-amber-50 border-amber-100">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="text-amber-600" />
                    <h3 className="text-lg font-semibold text-amber-900">AI Smart Insights</h3>
                  </div>
                  <ul className="space-y-3">
                    {aiInsights.map((insight, i) => (
                      <motion.li 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex gap-3 text-amber-800 text-sm"
                      >
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {insight}
                      </motion.li>
                    ))}
                  </ul>
                </Card>

                <Card>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Remittance Tracker</h3>
                    <Send className="text-emerald-600 w-5 h-5" />
                  </div>
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-1">Total Sent to India (Yearly)</p>
                    <h4 className="text-4xl font-bold text-emerald-700">{totalRemitted} KD</h4>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setActiveTab('remittance')}>
                    View History
                  </Button>
                </Card>
              </div>
            </div>

            <Card>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-lg font-semibold">Recent Expenses</h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    className="text-sm flex items-center gap-2 flex-1 sm:flex-none justify-center" 
                    onClick={handleExportCSV}
                    disabled={expenses.length === 0}
                  >
                    <Download size={16} />
                    Export to Excel (CSV)
                  </Button>
                  <Button variant="ghost" className="text-sm flex-1 sm:flex-none" onClick={() => setActiveTab('reports')}>View All</Button>
                </div>
              </div>
              <div className="space-y-4">
                {expenses.slice(0, 5).map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                        {exp.category === 'Rent' && <Home size={20} />}
                        {exp.category === 'Food Sharing' && <Utensils size={20} />}
                        {exp.category === 'Mobile Recharge' && <Smartphone size={20} />}
                        {exp.category === 'Send Money Home' && <Send size={20} />}
                        {exp.category === 'Personal Items' && <ShoppingBag size={20} />}
                        {!['Rent', 'Food Sharing', 'Mobile Recharge', 'Send Money Home', 'Personal Items'].includes(exp.category) && <Plus size={20} />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{exp.name}</p>
                        <p className="text-xs text-gray-500">{exp.category} • {format(exp.date.toDate(), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <p className="font-bold text-red-600">-{exp.amount} KD</p>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <div className="text-center py-8 text-gray-400 italic">No expenses recorded yet.</div>
                )}
              </div>
            </Card>
          </div>
        );
      case 'add':
        return <AddExpenseView onComplete={() => setActiveTab('dashboard')} user={user} />;
      case 'remittance':
        return <RemittanceView remittances={remittances} totalRemitted={totalRemitted} />;
      case 'budget':
        return <BudgetPlannerView profile={profile} user={user} />;
      case 'reports':
        return <ReportsView expenses={expenses} chartData={chartData} COLORS={COLORS} />;
      case 'settings':
        return (
          <div className="space-y-6">
            <Card>
              <h3 className="text-lg font-semibold mb-6">Profile Settings</h3>
              <div className="flex items-center gap-4 mb-8">
                <img src={user.photoURL || ''} alt="" className="w-16 h-16 rounded-full border-2 border-emerald-100" />
                <div>
                  <p className="font-bold text-xl">{user.displayName}</p>
                  <p className="text-gray-500">{user.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 rounded-xl border border-gray-100">
                  <div>
                    <p className="font-medium">Currency</p>
                    <p className="text-sm text-gray-500">Default currency for all transactions</p>
                  </div>
                  <span className="font-bold text-emerald-600">Kuwaiti Dinar (KD)</span>
                </div>
              </div>
            </Card>
            <Button variant="danger" className="w-full py-4 flex items-center justify-center gap-2" onClick={logOut}>
              <LogOut size={20} /> Sign Out
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-24 md:pb-0 md:pl-64">
      <header className="md:hidden bg-white border-b border-black/5 p-4 flex justify-between items-center sticky top-0 z-30">
        <h1 className="text-xl font-bold text-emerald-800">Sharif Lala</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </header>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-black/5 transition-transform duration-300 md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="mb-10 hidden md:block">
            <h1 className="text-2xl font-bold text-emerald-800">Sharif Lala</h1>
            <p className="text-xs text-stone-400 uppercase tracking-widest mt-1">Smart Money Tracker</p>
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <NavItem active={activeTab === 'add'} onClick={() => { setActiveTab('add'); setIsSidebarOpen(false); }} icon={<PlusCircle size={20} />} label="Add Expense" />
            <NavItem active={activeTab === 'remittance'} onClick={() => { setActiveTab('remittance'); setIsSidebarOpen(false); }} icon={<Send size={20} />} label="Remittance" />
            <NavItem active={activeTab === 'budget'} onClick={() => { setActiveTab('budget'); setIsSidebarOpen(false); }} icon={<Wallet size={20} />} label="Budget Planner" />
            <NavItem active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }} icon={<PieChart size={20} />} label="Reports" />
            <NavItem active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} icon={<Settings size={20} />} label="Settings" />
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full" />
              <div className="truncate">
                <p className="font-bold text-sm truncate">{user.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="p-6 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-black/5 flex justify-around p-3 z-30">
        <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={24} />} />
        <MobileNavItem active={activeTab === 'add'} onClick={() => setActiveTab('add')} icon={<PlusCircle size={24} />} />
        <MobileNavItem active={activeTab === 'remittance'} onClick={() => setActiveTab('remittance')} icon={<Send size={24} />} />
        <MobileNavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<PieChart size={24} />} />
      </nav>
    </div>
  );
}

// --- Sub-Views ---

function AddExpenseView({ onComplete, user }: { onComplete: () => void; user: User }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    setIsSubmitting(true);
    try {
      const expenseData = {
        uid: user.uid,
        name,
        amount: parseFloat(amount),
        category,
        date: Timestamp.fromDate(new Date(date)),
        notes,
      };

      await addDoc(collection(db, 'users', user.uid, 'expenses'), expenseData);
      
      if (category === 'Send Money Home') {
        await addDoc(collection(db, 'users', user.uid, 'remittances'), {
          uid: user.uid,
          amount: parseFloat(amount),
          date: Timestamp.fromDate(new Date(date)),
          notes: `Sent via expense: ${name}`,
        });
      }

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Add New Expense</h2>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expense Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Perfume, Dinner, Rent"
              className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KD)</label>
              <input 
                type="number" 
                step="0.001"
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                placeholder="0.000"
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {DEFAULT_CATEGORIES.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none h-24"
            />
          </div>
          <Button type="submit" className="w-full py-4" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Expense'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function RemittanceView({ remittances, totalRemitted }: { remittances: Remittance[]; totalRemitted: number }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Remittance Tracker</h2>
          <p className="text-gray-500">Money sent home to India</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400 uppercase font-bold tracking-tighter">Total Sent</p>
          <p className="text-3xl font-bold text-emerald-600">{totalRemitted} KD</p>
        </div>
      </div>

      <Card className="bg-emerald-900 text-white border-none overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="relative z-10">
          <h3 className="text-lg font-medium opacity-80 mb-2">Smart Saving Tip</h3>
          <p className="text-xl italic">"Sending money during favorable exchange rates can save you up to 5% annually."</p>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">History</h3>
        {remittances.map((rem) => (
          <Card key={rem.id} className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Send size={20} />
              </div>
              <div>
                <p className="font-bold">{rem.amount} KD</p>
                <p className="text-xs text-gray-500">{format(rem.date.toDate(), 'MMMM dd, yyyy')}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{rem.notes || 'Family Support'}</p>
              <CheckCircle2 className="ml-auto text-emerald-500 w-4 h-4 mt-1" />
            </div>
          </Card>
        ))}
        {remittances.length === 0 && (
          <div className="text-center py-12 text-gray-400">No remittance records found.</div>
        )}
      </div>
    </div>
  );
}

function BudgetPlannerView({ profile, user }: { profile: UserProfile | null; user: User }) {
  const [income, setIncome] = useState(profile?.monthlyIncome.toString() || '250');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...profile,
        monthlyIncome: parseFloat(income),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Budget Planner</h2>
      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (KD)</label>
            <div className="relative">
              <input 
                type="number" 
                value={income} 
                onChange={e => setIncome(e.target.value)}
                className="w-full p-4 text-2xl font-bold rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">KD</span>
            </div>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Update Monthly Income'}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Recommended Allocation</h3>
        <div className="space-y-3">
          {Object.entries(profile?.budgetSettings || {}).map(([cat, amt]) => (
            <div key={cat} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100">
              <span className="text-gray-700">{cat}</span>
              <span className="font-bold text-emerald-600">{amt} KD</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsView({ expenses, chartData, COLORS }: { expenses: Expense[]; chartData: any[]; COLORS: string[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Financial Reports</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Expense Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Spending Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Full History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-sm uppercase tracking-wider border-b border-gray-100">
                <th className="pb-4 font-medium">Date</th>
                <th className="pb-4 font-medium">Name</th>
                <th className="pb-4 font-medium">Category</th>
                <th className="pb-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((exp) => (
                <tr key={exp.id} className="group">
                  <td className="py-4 text-sm text-gray-500">{format(exp.date.toDate(), 'MMM dd')}</td>
                  <td className="py-4 font-medium">{exp.name}</td>
                  <td className="py-4 text-sm text-gray-600">{exp.category}</td>
                  <td className="py-4 text-right font-bold text-red-600">-{exp.amount} KD</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- Helpers ---

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
        active 
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
          : "text-gray-500 hover:bg-gray-50 hover:text-emerald-600"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2 rounded-full transition-all",
        active ? "text-emerald-600 scale-110" : "text-gray-400"
      )}
    >
      {icon}
    </button>
  );
}
