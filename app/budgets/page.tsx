"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const CATEGORIES = [
  "Salary",
  "Food",
  "Transport",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Health",
  "Education",
  "Other",
];

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  month: number;
  year: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  transaction_date: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

const DEMO_BUDGETS: Budget[] = [
  { id: "db1", category: "Food", monthly_limit: 500, month: 6, year: 2026 },
  { id: "db2", category: "Transport", monthly_limit: 200, month: 6, year: 2026 },
  { id: "db3", category: "Entertainment", monthly_limit: 100, month: 6, year: 2026 },
  { id: "db4", category: "Utilities", monthly_limit: 150, month: 6, year: 2026 },
];

const DEMO_BUDGET_TRANSACTIONS: Transaction[] = [
  { id: "d4", amount: 280, type: "expense", category: "Food", transaction_date: "2026-06-08" },
  { id: "d7", amount: 180, type: "expense", category: "Food", transaction_date: "2026-06-14" },
  { id: "d5", amount: 95, type: "expense", category: "Utilities", transaction_date: "2026-06-10" },
  { id: "d6", amount: 60, type: "expense", category: "Entertainment", transaction_date: "2026-06-12" },
  { id: "d8", amount: 120, type: "expense", category: "Transport", transaction_date: "2026-06-15" },
];

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [userId, setUserId] = useState<string>("");

  // Form state
  const [category, setCategory] = useState("Food");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsGuest(true);
        setBudgets(DEMO_BUDGETS);
        setTransactions(DEMO_BUDGET_TRANSACTIONS);
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("finsage_users")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(profile?.role === "admin");

      // Load budgets for current month
      const { data: budgetData } = await supabase
        .from("finsage_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .order("category");

      setBudgets(budgetData || []);

      // Load this month's expense transactions
      const monthStart = new Date(currentYear, currentMonth - 1, 1)
        .toISOString()
        .split("T")[0];
      const { data: txnData } = await supabase
        .from("finsage_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("transaction_date", monthStart);

      setTransactions(txnData || []);
      setLoading(false);
    }
    load();
  }, [currentMonth, currentYear]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("finsage_budgets")
      .upsert(
        {
          user_id: userId,
          category,
          monthly_limit: Number(monthlyLimit),
          month: currentMonth,
          year: currentYear,
        },
        { onConflict: "user_id,category,month,year" }
      )
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Budget saved!");
      setBudgets((prev) => {
        const exists = prev.find((b) => b.category === data.category);
        if (exists) {
          return prev.map((b) => (b.category === data.category ? data : b));
        }
        return [...prev, data];
      });
      setShowForm(false);
      setMonthlyLimit("");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this budget?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("finsage_budgets").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete budget");
    } else {
      toast.success("Budget removed");
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    }
  }

  function getSpent(cat: string) {
    return transactions
      .filter((t) => t.category === cat)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  const totalBudget = budgets.reduce((sum, b) => sum + b.monthly_limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + getSpent(b.category), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav isAdmin={isAdmin} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Budgets</h1>
            <p className="text-slate-400 mt-1">
              {now.toLocaleString("default", { month: "long", year: "numeric" })} budget management
            </p>
          </div>
          {!isGuest && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Set Budget
            </Button>
          )}
        </div>

        {/* Summary Card */}
        {budgets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <p className="text-slate-400 text-sm mb-1">Total Budgeted</p>
              <p className="text-3xl font-bold text-blue-400">{formatCurrency(totalBudget)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <p className="text-slate-400 text-sm mb-1">Total Spent</p>
              <p className={`text-3xl font-bold ${totalSpent > totalBudget ? "text-red-400" : "text-green-400"}`}>
                {formatCurrency(totalSpent)}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <p className="text-slate-400 text-sm mb-1">Remaining</p>
              <p className={`text-3xl font-bold ${totalBudget - totalSpent < 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatCurrency(totalBudget - totalSpent)}
              </p>
            </div>
          </div>
        )}

        {/* Add Budget Form */}
        {showForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-6">Set Category Budget</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
              <div className="space-y-2">
                <Label className="text-slate-300">Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Monthly Limit ($)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="500"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
                >
                  {submitting ? "Saving..." : "Save Budget"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Budget List */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-slate-500 mb-3">No budgets set for this month</p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Create your first budget
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {budgets.map((budget) => {
              const spent = getSpent(budget.category);
              const pct = Math.min((spent / budget.monthly_limit) * 100, 100);
              const isOver = spent > budget.monthly_limit;
              const isWarning = !isOver && pct > 80;

              return (
                <div
                  key={budget.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-semibold text-lg">{budget.category}</h3>
                      {isOver ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Over budget
                        </Badge>
                      ) : isWarning ? (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Warning
                        </Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          On track
                        </Badge>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mb-3">
                    <Progress
                      value={pct}
                      className={`h-3 ${isOver ? "[&>div]:bg-red-500" : isWarning ? "[&>div]:bg-orange-400" : "[&>div]:bg-blue-500"}`}
                    />
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      Spent:{" "}
                      <span className={`font-semibold ${isOver ? "text-red-400" : "text-white"}`}>
                        {formatCurrency(spent)}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Budget:{" "}
                      <span className="font-semibold text-white">
                        {formatCurrency(budget.monthly_limit)}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Remaining:{" "}
                      <span
                        className={`font-semibold ${budget.monthly_limit - spent < 0 ? "text-red-400" : "text-green-400"}`}
                      >
                        {formatCurrency(budget.monthly_limit - spent)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
