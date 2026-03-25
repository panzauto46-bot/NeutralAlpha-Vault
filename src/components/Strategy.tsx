import { motion } from 'framer-motion';
import { 
  ArrowRight, ArrowLeftRight, Bot, TrendingUp, Coins, 
  RefreshCcw, Target, Layers, ChevronRight
} from 'lucide-react';

export default function Strategy() {
  const steps = [
    {
      step: '01',
      title: 'Deposit USDC',
      description: 'User deposits USDC into the vault. Vault mints proportional shares representing your ownership.',
      icon: Coins,
      color: 'green',
    },
    {
      step: '02',
      title: 'Position Setup',
      description: '50% used as collateral for Drift short position. 50% swapped to spot SOL via Jupiter aggregator.',
      icon: ArrowLeftRight,
      color: 'purple',
    },
    {
      step: '03',
      title: 'Delta Neutralization',
      description: 'Short perpetual position exactly offsets spot position. Net directional exposure = 0.',
      icon: Target,
      color: 'blue',
    },
    {
      step: '04',
      title: 'Earn Funding',
      description: 'Shorts earn funding payments when rate is positive - the majority of time in bull markets.',
      icon: TrendingUp,
      color: 'green',
    },
    {
      step: '05',
      title: 'AI Monitoring',
      description: 'Every 15 minutes, AI evaluates signals and executes optimal rebalancing decisions.',
      icon: Bot,
      color: 'purple',
    },
    {
      step: '06',
      title: 'Withdraw',
      description: 'At maturity, positions are unwound. USDC + earned yield returned to depositors.',
      icon: RefreshCcw,
      color: 'green',
    },
  ];

  const features = [
    {
      title: 'Funding Rate Arbitrage',
      description: 'Capture the structural spread between perpetual and spot markets without taking directional bets.',
      details: [
        'Earn when funding rate is positive (longs pay shorts)',
        'Historically positive 70%+ of the time',
        'No exposure to crypto price movements',
      ],
      icon: TrendingUp,
    },
    {
      title: 'AI Rebalancing Engine',
      description: 'Hybrid signal engine combines Qwen LLM with deterministic fallback rules for safe execution.',
      details: [
        'Evaluates telemetry on a 15-minute cadence',
        'Falls back to hard risk rules when AI endpoint is unavailable',
        'Outputs HOLD, REBALANCE, or ROTATE_ASSET with risk labels',
      ],
      icon: Bot,
    },
    {
      title: 'Multi-Asset Rotation',
      description: 'Dynamically rotates to the highest-yielding perpetual pair across supported assets.',
      details: [
        'Supports SOL, BTC, and ETH perps',
        'Auto-rotates when funding < 0.005%',
        'Maximizes yield across market conditions',
      ],
      icon: Layers,
    },
  ];

  return (
    <section id="strategy" className="py-20 relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-blue-500/30 mb-6">
            <Layers className="w-4 h-4 text-blue-300" />
            <span className="text-sm text-blue-300 font-medium">Strategy Deep Dive</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            How NeutralAlpha Works
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            A delta-neutral funding rate arbitrage strategy enhanced with AI-driven rebalancing
          </p>
        </motion.div>

        {/* Core Mechanism Visual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-8 mb-16"
        >
          <h3 className="text-xl font-bold text-white mb-8 text-center">Core Delta-Neutral Mechanism</h3>
          <div className="grid md:grid-cols-3 gap-8 items-center">
            {/* Spot Position */}
            <div className="text-center">
              <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 flex items-center justify-center mb-4">
                <div className="text-center">
                  <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-1" />
                  <span className="text-xs text-green-400 font-medium">LONG</span>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Spot SOL</h4>
              <p className="text-sm text-slate-400">
                Hold spot position via Jupiter. Benefits from price appreciation.
              </p>
            </div>

            {/* Plus/Equals */}
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="text-4xl font-bold text-slate-500">+</div>
                <ArrowRight className="w-8 h-8 text-slate-500 hidden md:block" />
                <div className="text-4xl font-bold text-slate-500">=</div>
              </div>
            </div>

            {/* Short Position */}
            <div className="text-center">
              <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 flex items-center justify-center mb-4">
                <div className="text-center">
                  <TrendingUp className="w-8 h-8 text-purple-400 mx-auto mb-1 rotate-180" />
                  <span className="text-xs text-purple-400 font-medium">SHORT</span>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Perp Short</h4>
              <p className="text-sm text-slate-400">
                Short on Drift Protocol. Earns funding + offsets spot.
              </p>
            </div>
          </div>

          {/* Result */}
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <div className="inline-flex items-center gap-4 px-8 py-4 rounded-2xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-white/10">
              <Target className="w-6 h-6 text-green-400" />
              <div>
                <div className="text-lg font-semibold text-white">Net Delta = 0</div>
                <div className="text-sm text-slate-400">Price-neutral, funding-positive</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Process Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h3 className="text-xl font-bold text-white mb-8 text-center">Vault Lifecycle</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative glass rounded-2xl p-6 card-hover group"
              >
                <div className={`absolute top-4 right-4 text-4xl font-bold opacity-10 ${
                  step.color === 'green' ? 'text-green-400' :
                  step.color === 'purple' ? 'text-purple-400' :
                  'text-blue-400'
                }`}>
                  {step.step}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  step.color === 'green' ? 'bg-green-500/10' :
                  step.color === 'purple' ? 'bg-purple-500/10' :
                  'bg-blue-500/10'
                }`}>
                  <step.icon className={`w-6 h-6 ${
                    step.color === 'green' ? 'text-green-400' :
                    step.color === 'purple' ? 'text-purple-400' :
                    'text-blue-400'
                  }`} />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">{step.title}</h4>
                <p className="text-sm text-slate-400">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 card-hover"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-green-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">{feature.title}</h4>
              <p className="text-sm text-slate-400 mb-4">{feature.description}</p>
              <ul className="space-y-2">
                {feature.details.map((detail, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    <span className="text-slate-300">{detail}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

