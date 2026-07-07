"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, TrendingUp, Lightbulb, RefreshCw, PiggyBank, Zap, BarChart2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Recommendation {
  title: string;
  detail: string;
}

interface Insights {
  assessment: string;
  recommendations: Recommendation[];
  savingsOpportunity: string;
}

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change1d: number;
  low52: number;
  high52: number;
  peRatio: number | null;
  dividendYield: number | null;
  rangeScore: number;
  momentumScore: number;
  compositeScore: number;
  type: "ETF" | "Stock";
}

interface InvestAllocation {
  symbol: string;
  name: string;
  amount: number;
  price: number;
  rationale: string;
  signal: "BUY" | "HOLD" | "WATCH";
}

interface InvestAdvice {
  headline: string;
  allocations: InvestAllocation[];
  riskCaveat: string;
  outlook: string;
}

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  categoryBreakdown: Record<string, number>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

const DEMO_INSIGHTS: Insights = {
  assessment: "Your finances look healthy this month! You're earning $3,950 and spending $1,935 — a 51% savings rate. Your biggest expense category is Rent at $1,200 (62% of expenses). Food spending across groceries and dining is $460, which is reasonable. You have solid runway to build an emergency fund or invest.",
  recommendations: [
    { title: "Automate savings transfers", detail: "Set up an automatic transfer of $500/month to a high-yield savings account right after payday. You won't miss it, and it compounds fast." },
    { title: "Reduce dining out", detail: "Restaurants cost $180 this month vs $280 on groceries. Shifting one restaurant meal/week to home cooking could save ~$80/month." },
    { title: "Invest your surplus", detail: "With $2,015 monthly surplus, consider putting $300–500 into index funds (e.g., VTI or VXUS). Even small consistent contributions build wealth over time." },
  ],
  savingsOpportunity: "You could realistically save an additional $300–500/month by meal-prepping and reviewing your streaming subscriptions. Over a year, that's $3,600–$6,000 extra saved.",
};

const DEMO_SUMMARY: Summary = {
  totalIncome: 3950,
  totalExpenses: 1935,
  netBalance: 2015,
  transactionCount: 8,
  categoryBreakdown: { Rent: 1200, Food: 460, Transport: 120, Utilities: 95, Entertainment: 60 },
};

export default function InsightsPage() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [investLoading, setInvestLoading] = useState(false);
  const [investAdvice, setInvestAdvice] = useState<InvestAdvice | null>(null);
  const [investQuotes, setInvestQuotes] = useState<StockQuote[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setIsGuest(true);
        setInsights(DEMO_INSIGHTS);
        setSummary(DEMO_SUMMARY);
        return;
      }
      if (data.user) {
        supabase
          .from("finsage_users")
          .select("role")
          .eq("id", data.user.id)
          .single()
          .then(({ data: profile }) => {
            setIsAdmin(profile?.role === "admin");
          });
      }
    });
  }, []);

  async function generateInsights() {
    setLoading(true);
    try {
      const res = await fetch("/api/insights", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate insights");
      } else {
        setInsights(data.insights);
        setSummary(data.summary);
        toast.success("AI insights generated!");
      }
    } catch {
      toast.error("Failed to connect to AI service");
    }
    setLoading(false);
  }

  async function getInvestmentAdvice() {
    if (!summary || summary.netBalance <= 0) return;
    setInvestLoading(true);
    setInvestAdvice(null);
    try {
      const res = await fetch("/api/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surplus: summary.netBalance }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to fetch investment advice");
      } else {
        setInvestAdvice(data.advice);
        setInvestQuotes(data.quotes);
        toast.success("Live investment advice ready!");
      }
    } catch {
      toast.error("Failed to connect to investment service");
    }
    setInvestLoading(false);
  }

  const recommendationIcons = [Lightbulb, TrendingUp, Sparkles];
  const recommendationColors = ["text-yellow-400", "text-blue-400", "text-purple-400"];
  const recommendationBgs = ["bg-yellow-400/10", "bg-blue-400/10", "bg-purple-400/10"];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav isAdmin={isAdmin} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">AI Financial Coach</h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            FinSage analyzes your last 30 days of transactions using Claude AI to provide
            personalized insights and actionable recommendations.
          </p>
        </div>

        {!insights ? (
          <div className="text-center">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 mb-8">
              <Sparkles className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-3">Ready to analyze your finances</h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                Click the button below to get AI-powered insights based on your transaction
                history from the past 30 days.
              </p>
              <Button
                onClick={generateInsights}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing your finances...
                  </>
                ) : (
                  <>
                    <Brain className="h-5 w-5 mr-2" />
                    Generate AI Insights
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Financial Summary */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Income (30d)</p>
                  <p className="text-green-400 font-bold text-lg">
                    {formatCurrency(summary.totalIncome)}
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Expenses (30d)</p>
                  <p className="text-red-400 font-bold text-lg">
                    {formatCurrency(summary.totalExpenses)}
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Net Balance</p>
                  <p
                    className={`font-bold text-lg ${summary.netBalance >= 0 ? "text-blue-400" : "text-orange-400"}`}
                  >
                    {formatCurrency(summary.netBalance)}
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Transactions</p>
                  <p className="text-white font-bold text-lg">{summary.transactionCount}</p>
                </div>
              </div>
            )}

            {/* Assessment */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="h-6 w-6 text-purple-400" />
                <h2 className="text-lg font-semibold">Financial Health Assessment</h2>
              </div>
              <p className="text-slate-200 leading-relaxed">{insights.assessment}</p>
            </div>

            {/* Recommendations */}
            <div>
              <h2 className="text-lg font-semibold mb-4">
                3 Personalized Recommendations
              </h2>
              <div className="space-y-4">
                {insights.recommendations.map((rec, i) => {
                  const Icon = recommendationIcons[i];
                  return (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl ${recommendationBgs[i]} flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon className={`h-5 w-5 ${recommendationColors[i]}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white mb-1">{rec.title}</h3>
                          <p className="text-slate-300 text-sm leading-relaxed">
                            {rec.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Savings Opportunity */}
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <PiggyBank className="h-6 w-6 text-green-400" />
                <h2 className="text-lg font-semibold">Savings Opportunity</h2>
              </div>
              <p className="text-slate-200 leading-relaxed">{insights.savingsOpportunity}</p>
            </div>

            {/* Put Your Surplus to Work */}
            {summary && summary.netBalance > 0 && (
              <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="h-6 w-6 text-blue-400" />
                  <h2 className="text-lg font-semibold">Put Your Surplus to Work Immediately</h2>
                </div>
                <p className="text-slate-400 text-sm mb-5">
                  You have a{" "}
                  <span className="text-blue-300 font-semibold">{formatCurrency(summary.netBalance)}</span>{" "}
                  surplus. We score live market prices using value + momentum formulas to find the best place for it right now.
                </p>

                {!investAdvice ? (
                  <Button
                    onClick={getInvestmentAdvice}
                    disabled={investLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                  >
                    {investLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Fetching live prices & scoring...
                      </>
                    ) : (
                      <>
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Get Live Investment Advice
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-5">
                    {/* Headline */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                      <p className="text-blue-200 font-medium text-sm">{investAdvice.headline}</p>
                    </div>

                    {/* Live quotes strip */}
                    {investQuotes.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {investQuotes.map((q) => (
                          <div
                            key={q.symbol}
                            className="bg-slate-800/60 border border-slate-700 rounded-lg p-2 text-center"
                          >
                            <p className="text-white font-bold text-xs">{q.symbol}</p>
                            <p className="text-slate-200 text-sm font-semibold">${q.price.toFixed(2)}</p>
                            <p className={`text-xs ${q.change1d >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {q.change1d >= 0 ? "+" : ""}{q.change1d.toFixed(2)}%
                            </p>
                            <div className="mt-1 w-full bg-slate-700 rounded-full h-1">
                              <div
                                className="bg-blue-400 h-1 rounded-full"
                                style={{ width: `${q.rangeScore}%` }}
                              />
                            </div>
                            <p className="text-slate-500 text-[10px] mt-0.5">{q.rangeScore}% of 52wk</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Allocations */}
                    <div className="space-y-3">
                      {investAdvice.allocations.map((alloc) => (
                        <div
                          key={alloc.symbol}
                          className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-start gap-4"
                        >
                          <div className="flex-shrink-0 text-center">
                            <div className={`rounded-lg px-2 py-1 text-xs font-bold mb-1 ${
                              alloc.signal === "BUY"
                                ? "bg-green-500/20 text-green-400"
                                : alloc.signal === "HOLD"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-slate-600/40 text-slate-400"
                            }`}>
                              {alloc.signal}
                            </div>
                            <p className="text-white font-bold text-sm">{alloc.symbol}</p>
                            <p className="text-slate-400 text-[11px]">${alloc.price.toFixed(2)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-white font-semibold text-sm">{alloc.name}</p>
                              <span className="text-green-400 font-bold text-sm ml-2 flex-shrink-0">
                                {formatCurrency(alloc.amount)}
                              </span>
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed">{alloc.rationale}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Outlook & Risk */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-slate-400 text-xs mb-1 font-medium">6–12 Month Outlook</p>
                          <p className="text-slate-200 text-xs leading-relaxed">{investAdvice.outlook}</p>
                        </div>
                      </div>
                      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-slate-400 text-xs mb-1 font-medium">Risk Notice</p>
                          <p className="text-slate-200 text-xs leading-relaxed">{investAdvice.riskCaveat}</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={getInvestmentAdvice}
                      disabled={investLoading}
                      variant="outline"
                      className="border-blue-700 text-blue-300 hover:bg-blue-900/30 text-sm"
                    >
                      {investLoading ? (
                        <><RefreshCw className="h-3 w-3 mr-2 animate-spin" />Refreshing prices...</>
                      ) : (
                        <><RefreshCw className="h-3 w-3 mr-2" />Refresh with Latest Prices</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Regenerate */}
            <div className="text-center pt-4">
              <Button
                onClick={generateInsights}
                disabled={loading}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Insights
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
