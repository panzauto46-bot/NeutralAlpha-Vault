import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap, TrendingUp, Bot } from 'lucide-react';
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-500/5 rounded-full blur-3xl" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-green-500/30 mb-8"
        >
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-green-400 font-medium">Live on Solana Mainnet</span>
          <span className="text-xs text-slate-500">• Ranger Build-A-Bear Hackathon 2026</span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
        >
          <span className="text-white">Neutral</span>
          <span className="gradient-text">Alpha</span>
          <span className="text-white"> Vault</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl sm:text-2xl text-slate-400 mb-4 max-w-3xl mx-auto"
        >
          AI-Driven Delta-Neutral Yield Strategy on Solana
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-base text-slate-500 mb-10 max-w-2xl mx-auto"
        >
          Capture funding rate spread without directional risk. Our AI rebalancing engine 
          optimizes positions every 15 minutes for maximum risk-adjusted returns.
        </motion.p>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-6 sm:gap-12 mb-10"
        >
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold gradient-text">18-35%</div>
            <div className="text-sm text-slate-500">Target APY</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-white">USDC</div>
            <div className="text-sm text-slate-500">Base Asset</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold gradient-text-purple">±2%</div>
            <div className="text-sm text-slate-500">Max Delta Drift</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-white">3-Mo</div>
            <div className="text-sm text-slate-500">Rolling Lock</div>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link
            to="/dashboard"
            className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 rounded-xl text-white font-semibold hover:from-green-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/25 glow-green"
          >
            Launch App
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#strategy"
            className="flex items-center gap-2 px-8 py-4 glass rounded-xl text-white font-semibold hover:bg-white/10 transition-all"
          >
            View Strategy
          </a>
        </motion.div>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {[
            { icon: Shield, label: 'Delta Neutral', color: 'green' },
            { icon: Bot, label: 'AI Rebalancing', color: 'purple' },
            { icon: TrendingUp, label: 'Funding Arbitrage', color: 'green' },
            { icon: Zap, label: 'Multi-Asset Rotation', color: 'purple' },
          ].map((feature, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-4 py-2 rounded-full glass border ${
                feature.color === 'green' ? 'border-green-500/20' : 'border-purple-500/20'
              }`}
            >
              <feature.icon className={`w-4 h-4 ${
                feature.color === 'green' ? 'text-green-400' : 'text-purple-400'
              }`} />
              <span className="text-sm text-slate-300">{feature.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 rounded-full border-2 border-slate-600 flex justify-center pt-2">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 bg-green-400 rounded-full"
          />
        </div>
      </motion.div>
    </section>
  );
}
