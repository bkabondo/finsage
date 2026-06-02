"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, TrendingUp, Lightbulb, RefreshCw, PiggyBank } from "lucide-react";
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

export default function InsightsPage() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
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
