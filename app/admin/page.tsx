import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { Users, CreditCard, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("finsage_users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();

  // Get platform stats
  const { data: allUsers } = await admin.from("finsage_users").select("id, role, created_at");
  const { data: allTransactions } = await admin
    .from("finsage_transactions")
    .select("id, type, amount, category, transaction_date");

  const totalUsers = allUsers?.length ?? 0;
  const totalRegularUsers = allUsers?.filter((u) => u.role === "user").length ?? 0;
  const totalAdmins = allUsers?.filter((u) => u.role === "admin").length ?? 0;
  const totalTransactions = allTransactions?.length ?? 0;

  const totalVolume =
    allTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const totalIncome =
    allTransactions
      ?.filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const totalExpenses =
    allTransactions
      ?.filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  // Category breakdown (anonymized)
  const categoryMap: Record<string, number> = {};
  allTransactions?.forEach((t) => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + 1;
  });
  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Recent signups (count only)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSignups =
    allUsers?.filter(
      (u) => new Date(u.created_at) > thirtyDaysAgo
    ).length ?? 0;

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav isAdmin={true} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-slate-400 mt-0.5">Platform-wide overview (anonymized)</p>
          </div>
        </div>

        {/* User Stats */}
        <h2 className="text-lg font-semibold text-slate-300 mb-4">User Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">Total Users</span>
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-white">{totalUsers}</div>
              <div className="mt-2 text-slate-500 text-xs">
                {totalRegularUsers} regular · {totalAdmins} admin
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">New Users (30d)</span>
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-green-400">{recentSignups}</div>
              <div className="mt-2 text-slate-500 text-xs">Last 30 days</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">Total Transactions</span>
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-purple-400">{totalTransactions}</div>
              <div className="mt-2 text-slate-500 text-xs">Platform-wide</div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Stats */}
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Platform Financial Totals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400 text-sm mb-1">Total Volume</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(totalVolume)}</p>
            <p className="text-slate-500 text-xs mt-1">All transactions combined</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400 text-sm mb-1">Total Income Recorded</p>
            <p className="text-3xl font-bold text-green-400">{formatCurrency(totalIncome)}</p>
            <p className="text-slate-500 text-xs mt-1">Across all users</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400 text-sm mb-1">Total Expenses Recorded</p>
            <p className="text-3xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
            <p className="text-slate-500 text-xs mt-1">Across all users</p>
          </div>
        </div>

        {/* Top Categories */}
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Most Used Categories</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {topCategories.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No transaction data yet</p>
          ) : (
            <div className="space-y-4">
              {topCategories.map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-300 text-sm">{cat}</span>
                    <span className="text-slate-400 text-sm">{count} transactions</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${(count / (topCategories[0][1] as number)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-xl text-center">
          <p className="text-slate-500 text-sm">
            All data shown is aggregated and anonymized. No individual user financial details are displayed.
          </p>
        </div>
      </div>
    </div>
  );
}
