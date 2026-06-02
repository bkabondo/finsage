import Link from "next/link";
import { TrendingUp, Shield, Brain, BarChart3, ArrowRight, DollarSign, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-50 bg-slate-900/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              FinSage
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:text-blue-300 hover:bg-white/10">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm mb-8">
          <Zap className="h-4 w-4" />
          AI-Powered Financial Intelligence
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          Take Control of Your{" "}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Finances
          </span>
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
          FinSage combines smart expense tracking with AI-powered insights to help you build better money habits and reach your financial goals faster.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-6 text-lg">
              Start for Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Everything you need to succeed</h2>
        <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
          From basic expense tracking to advanced AI analysis, FinSage has all the tools to transform your financial life.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: DollarSign,
              title: "Transaction Tracking",
              desc: "Log income and expenses by category. Filter by date, type, and category with ease.",
              color: "text-green-400",
              bg: "bg-green-400/10",
            },
            {
              icon: Target,
              title: "Budget Management",
              desc: "Set monthly budget limits per category and track your progress with visual indicators.",
              color: "text-blue-400",
              bg: "bg-blue-400/10",
            },
            {
              icon: Brain,
              title: "AI Financial Coach",
              desc: "Get personalized insights and 3 specific recommendations powered by Claude AI.",
              color: "text-purple-400",
              bg: "bg-purple-400/10",
            },
            {
              icon: BarChart3,
              title: "Spending Analytics",
              desc: "Visualize your spending patterns by category with clear, beautiful charts.",
              color: "text-orange-400",
              bg: "bg-orange-400/10",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-white/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "AI-Powered", label: "Financial Insights" },
              { value: "6+", label: "Spending Categories" },
              { value: "Real-time", label: "Budget Tracking" },
              { value: "Secure", label: "Data Protection" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-blue-400 mb-2">{stat.value}</div>
                <div className="text-slate-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border border-blue-500/30">
            <Shield className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Start your financial journey today</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              Join thousands of users who use FinSage to understand their spending, stick to budgets, and make smarter financial decisions.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-6 text-lg">
                Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-blue-400" />
          <span className="text-white font-semibold">FinSage</span>
        </div>
        <p>AI-Powered Personal Finance Tracker &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
