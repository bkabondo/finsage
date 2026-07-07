"use client";

import { useState, useEffect, useCallback } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Filter, X } from "lucide-react";
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

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string;
  transaction_date: string;
  created_at: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "d1", type: "income", amount: 3500, category: "Salary", description: "Monthly salary", transaction_date: "2026-06-01", created_at: "2026-06-01T00:00:00Z" },
  { id: "d2", type: "income", amount: 450, category: "Freelance", description: "Design project", transaction_date: "2026-06-05", created_at: "2026-06-05T00:00:00Z" },
  { id: "d3", type: "expense", amount: 1200, category: "Rent", description: "Monthly rent", transaction_date: "2026-06-01", created_at: "2026-06-01T00:00:00Z" },
  { id: "d4", type: "expense", amount: 280, category: "Food", description: "Groceries", transaction_date: "2026-06-08", created_at: "2026-06-08T00:00:00Z" },
  { id: "d5", type: "expense", amount: 95, category: "Utilities", description: "Internet + electric", transaction_date: "2026-06-10", created_at: "2026-06-10T00:00:00Z" },
  { id: "d6", type: "expense", amount: 60, category: "Entertainment", description: "Streaming services", transaction_date: "2026-06-12", created_at: "2026-06-12T00:00:00Z" },
  { id: "d7", type: "expense", amount: 180, category: "Food", description: "Restaurants", transaction_date: "2026-06-14", created_at: "2026-06-14T00:00:00Z" },
  { id: "d8", type: "expense", amount: 120, category: "Transport", description: "Gas + Uber", transaction_date: "2026-06-15", created_at: "2026-06-15T00:00:00Z" },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Form state
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("Food");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (filterType) params.set("type", filterType);
    if (filterStartDate) params.set("start_date", filterStartDate);
    if (filterEndDate) params.set("end_date", filterEndDate);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setLoading(false);
  }, [filterCategory, filterType, filterStartDate, filterEndDate]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setIsGuest(true);
        setTransactions(DEMO_TRANSACTIONS);
        setLoading(false);
        return;
      }
      supabase
        .from("finsage_users")
        .select("role")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          setIsAdmin(profile?.role === "admin");
        });
      fetchTransactions();
    });
  }, [fetchTransactions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, type, category, description, transaction_date: transactionDate }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to add transaction");
    } else {
      toast.success("Transaction added!");
      setShowForm(false);
      setAmount("");
      setDescription("");
      fetchTransactions();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Transaction deleted");
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } else {
      toast.error("Failed to delete transaction");
    }
  }

  function clearFilters() {
    setFilterCategory("");
    setFilterType("");
    setFilterStartDate("");
    setFilterEndDate("");
  }

  const hasFilters = filterCategory || filterType || filterStartDate || filterEndDate;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav isAdmin={isAdmin} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="text-slate-400 mt-1">Track all your income and expenses</p>
          </div>
          {!isGuest && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          )}
        </div>

        {/* Add Transaction Form */}
        {showForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-6">New Transaction</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-slate-300">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Type</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
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
                <Label className="text-slate-300">Date</Label>
                <Input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-300">Description (optional)</Label>
                <Textarea
                  placeholder="What was this for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {submitting ? "Adding..." : "Add Transaction"}
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

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Filters</span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-slate-500 hover:text-white flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <Input
                type="date"
                placeholder="Start date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm"
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="End date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={fetchTransactions}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-slate-500">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500 mb-3">No transactions found</p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" /> Add your first transaction
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        txn.type === "income"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {txn.type === "income" ? "+" : "-"}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {txn.description || txn.category}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-300">
                          {txn.category}
                        </Badge>
                        <span className="text-slate-500 text-xs">
                          {new Date(txn.transaction_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-bold text-lg ${txn.type === "income" ? "text-green-400" : "text-red-400"}`}
                    >
                      {txn.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(txn.amount))}
                    </span>
                    {!isGuest && (
                      <button
                        onClick={() => handleDelete(txn.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-slate-500 text-sm text-right">
          {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} found
        </div>
      </div>
    </div>
  );
}
