import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

function formatCurrency(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

const DEMO_TRANSACTIONS = [
  { id: "d1", type: "income", amount: 3500, category: "Salary", description: "Monthly salary", transaction_date: "2026-06-01" },
  { id: "d2", type: "income", amount: 450, category: "Freelance", description: "Design project", transaction_date: "2026-06-05" },
  { id: "d3", type: "expense", amount: 1200, category: "Rent", description: "Monthly rent", transaction_date: "2026-06-01" },
  { id: "d4", type: "expense", amount: 280, category: "Food", description: "Groceries", transaction_date: "2026-06-08" },
  { id: "d5", type: "expense", amount: 95, category: "Utilities", description: "Internet + electric", transaction_date: "2026-06-10" },
  { id: "d6", type: "expense", amount: 60, category: "Entertainment", description: "Streaming services", transaction_date: "2026-06-12" },
  { id: "d7", type: "expense", amount: 180, category: "Food", description: "Restaurants", transaction_date: "2026-06-14" },
  { id: "d8", type: "expense", amount: 120, category: "Transport", description: "Gas + Uber", transaction_date: "2026-06-15" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let transactions: any[] = DEMO_TRANSACTIONS;
  let currency = "USD";
  let isGuest = !user;
  let profile: any = null;
  const now = new Date();

  if (user) {
    const { data: fetchedProfile } = await supabase
      .from("finsage_users")
      .select("*")
      .eq("id", user.id)
      .single();

    profile = fetchedProfile;

    if (!profile) {
      // Auto-create profile if missing
      await supabase.from("finsage_users").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || "",
        role: "user",
      });
    }

    currency = profile?.currency || "USD";

    // Get current month transactions
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data: userTransactions } = await supabase
      .from("finsage_transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("transaction_date", monthStart)
      .order("transaction_date", { ascending: false });

    if (userTransactions) transactions = userTransactions;
  }

  const totalIncome =
    transactions
      ?.filter((t) => t.type === "income")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0) ?? 0;

  const totalExpenses =
    transactions
      ?.filter((t) => t.type === "expense")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0) ?? 0;

  const balance = totalIncome - totalExpenses;

  // Category breakdown for expenses
  const categoryMap: Record<string, number> = {};
  transactions
    ?.filter((t) => t.type === "expense")
    .forEach((t: any) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + Number(t.amount);
    });

  const categories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const maxCategory = categories[0]?.[1] ?? 1;

  const categoryColors: Record<string, string> = {
    Food: "bg-orange-400",
    Transport: "bg-blue-400",
    Entertainment: "bg-purple-400",
    Shopping: "bg-pink-400",
    Utilities: "bg-yellow-400",
    Health: "bg-green-400",
    Education: "bg-cyan-400",
    Salary: "bg-emerald-400",
    Rent: "bg-rose-400",
    Other: "bg-slate-400",
  };

  // Recent transactions (top 5)
  const recentTxns = transactions?.slice(0, 5) ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav isAdmin={profile?.role === "admin"} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            {isGuest ? "Dashboard" : `Welcome back, ${profile?.full_name?.split(" ")[0] || "there"}!`}
          </h1>
          <p className="text-slate-400 mt-1">
            {`Financial overview for ${now.toLocaleString("default", { month: "long", year: "numeric" })}`}
          </p>
        </div>

        {isGuest && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
            style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}>
            <span>👀</span>
            <span><strong className="text-blue-300">Demo Mode</strong> — You&apos;re viewing sample data. <Link href="/signup" className="underline hover:text-white transition-colors">Sign up</Link> to track your real finances.</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">Total Income</span>
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-400">
                {formatCurrency(totalIncome, currency)}
              </div>
              <p className="text-slate-500 text-sm mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">Total Expenses</span>
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-red-400">
                {formatCurrency(totalExpenses, currency)}
              </div>
              <p className="text-slate-500 text-sm mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">Net Balance</span>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${balance >= 0 ? "bg-blue-500/20" : "bg-orange-500/20"}`}
                >
                  <Wallet
                    className={`h-5 w-5 ${balance >= 0 ? "text-blue-400" : "text-orange-400"}`}
                  />
                </div>
              </div>
              <div
                className={`text-3xl font-bold ${balance >= 0 ? "text-blue-400" : "text-orange-400"}`}
              >
                {formatCurrency(balance, currency)}
              </div>
              <p className="text-slate-500 text-sm mt-1">
                {balance >= 0 ? "You are saving!" : "Overspending"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Spending by Category */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-lg">Spending by Category</CardTitle>
              {!isGuest && (
                <Link
                  href="/transactions"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {categories.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">
                  No expense data yet.{" "}
                  <Link href="/transactions" className="text-blue-400">
                    Add a transaction
                  </Link>
                </p>
              ) : (
                categories.map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-sm">{cat}</span>
                      <span className="text-white text-sm font-medium">
                        {formatCurrency(amount, currency)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${categoryColors[cat] || "bg-slate-400"}`}
                        style={{ width: `${(amount / maxCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-lg">Recent Transactions</CardTitle>
              {!isGuest && (
                <Link
                  href="/transactions"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTxns.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">
                  No transactions yet.{" "}
                  <Link href="/transactions" className="text-blue-400">
                    Add one
                  </Link>
                </p>
              ) : (
                recentTxns.map((txn: any) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          txn.type === "income"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {txn.type === "income" ? "+" : "-"}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {txn.description || txn.category}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {txn.category} •{" "}
                          {new Date(txn.transaction_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`font-semibold text-sm ${txn.type === "income" ? "text-green-400" : "text-red-400"}`}
                    >
                      {txn.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(txn.amount), currency)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Budget Progress — only for authenticated users with a budget set */}
        {!isGuest && profile?.monthly_budget && (
          <Card className="bg-slate-900 border-slate-800 mt-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-slate-400 text-sm">Monthly Budget Usage</p>
                  <p className="text-white font-semibold">
                    {formatCurrency(totalExpenses, currency)} of{" "}
                    {formatCurrency(Number(profile.monthly_budget), currency)}
                  </p>
                </div>
                <Badge
                  variant={
                    totalExpenses > Number(profile.monthly_budget) ? "destructive" : "secondary"
                  }
                >
                  {Math.round(
                    (totalExpenses / Number(profile.monthly_budget)) * 100
                  )}
                  % used
                </Badge>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalExpenses > Number(profile.monthly_budget)
                      ? "bg-red-500"
                      : totalExpenses > Number(profile.monthly_budget) * 0.8
                        ? "bg-orange-400"
                        : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.min((totalExpenses / Number(profile.monthly_budget)) * 100, 100)}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
