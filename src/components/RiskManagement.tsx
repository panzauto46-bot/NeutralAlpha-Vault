import { motion } from 'framer-motion';
import { 
  Shield, AlertTriangle, Activity, RefreshCw, 
  TrendingDown, Gauge, Lock, Check
} from 'lucide-react';

export default function RiskManagement() {
  const risks = [
    {
      risk: 'Delta Drift',
      mitigation: 'Auto-rebalance via AI engine',
      trigger: 'Delta > +/-2% NAV',
      status: 'active',
      icon: Activity,
    },
    {
      risk: 'Negative Funding',
      mitigation: 'Asset rotation to best-rate perp',
      trigger: 'Rate < 0.003% for 2 periods',
      status: 'active',
      icon: TrendingDown,
    },
    {
      risk: 'Liquidation Risk',
      mitigation: 'Health ratio > 1.5 maintained',
      trigger: 'Emergency exit if HR < 1.15',
      status: 'active',
      icon: AlertTriangle,
    },
    {
      risk: 'Execution Slippage',
      mitigation: 'Jupiter best-route + 0.3% cap',
      trigger: 'TX rejected if > 0.3%',
      status: 'active',
      icon: RefreshCw,
    },
    {
      risk: 'Smart Contract',
      mitigation: 'Audited protocols only (Drift, Ranger)',
      trigger: 'Continuous monitoring',
      status: 'disclosed',
      icon: Lock,
    },
    {
      risk: 'USDC Depeg',
      mitigation: 'Full unwind trigger',
      trigger: 'USDC < $0.98',
      status: 'active',
      icon: Shield,
    },
  ];

  const positionLimits = [
    { label: 'Max Single Asset Exposure', value: '60%', description: 'of NAV' },
    { label: 'Max Leverage (Drift)', value: '2x', description: 'conservative margin' },
    { label: 'Min Health Ratio', value: '1.5', description: 'target maintained' },
    { label: 'Max Delta Drift', value: '+/-2%', description: 'before rebalance' },
  ];

  const drawdownLimits = [
    {
      type: 'Soft Limit',
      trigger: '5% NAV drop in 7 days',
      action: 'Pause new deposits, alert team',
      color: 'yellow',
    },
    {
      type: 'Hard Limit',
      trigger: '10% NAV drop from peak',
      action: 'Full unwind, return USDC',
      color: 'red',
    },
  ];

  return (
    <section id="risks" className="py-20 relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-1/3 left-0 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-red-500/30 mb-6">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">Risk Management</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Built for Safety First
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Multiple layers of risk controls to protect your capital
          </p>
        </motion.div>

        {/* Risk Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-8 mb-8"
        >
          <h3 className="text-xl font-bold text-white mb-6">Risk Control Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Risk Type</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Mitigation</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Trigger</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((risk, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/5">
                          <risk.icon className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-white font-medium">{risk.risk}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-300">{risk.mitigation}</td>
                    <td className="py-4 px-4">
                      <span className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-1 rounded">
                        {risk.trigger}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        risk.status === 'active' 
                          ? 'bg-green-500/10 text-green-400' 
                          : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {risk.status === 'active' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {risk.status === 'active' ? 'Active' : 'Disclosed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Position Sizing & Drawdown */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Position Sizing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Gauge className="w-5 h-5 text-blue-300" />
              </div>
              <h3 className="text-lg font-semibold text-white">Position Sizing</h3>
            </div>
            <div className="space-y-4">
              {positionLimits.map((limit, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                  <div>
                    <div className="text-white font-medium">{limit.label}</div>
                    <div className="text-xs text-slate-500">{limit.description}</div>
                  </div>
                  <div className="text-2xl font-bold text-blue-300">{limit.value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Drawdown Limits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Drawdown Limits</h3>
            </div>
            <div className="space-y-4">
              {drawdownLimits.map((limit, i) => (
                <div 
                  key={i} 
                  className={`p-4 rounded-xl border ${
                    limit.color === 'yellow' 
                      ? 'bg-yellow-500/5 border-yellow-500/20' 
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${
                      limit.color === 'yellow' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {limit.type}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{limit.trigger}</span>
                  </div>
                  <p className="text-sm text-slate-300">{limit.action}</p>
                </div>
              ))}
            </div>

            {/* Health Ratio Visualization */}
            <div className="mt-6 p-4 rounded-xl bg-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Health Ratio Range</span>
                <span className="text-sm font-medium text-green-400">Target: &gt;= 1.50</span>
              </div>
              <div className="relative h-4 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full">
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-6 bg-white rounded shadow-lg border-2 border-green-400"
                  style={{ left: 'calc(75% - 8px)' }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-mono text-white bg-dark-700 px-2 py-1 rounded whitespace-nowrap">
                    target zone
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>1.0 (Liquidation)</span>
                <span>1.15 (Emergency)</span>
                <span>1.5 (Target)</span>
                <span>2.0+</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 p-6 rounded-2xl bg-yellow-500/5 border border-yellow-500/20"
        >
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2">Risk Disclosure</h4>
              <p className="text-sm text-slate-400">
                While NeutralAlpha employs multiple risk controls, DeFi investments carry inherent risks including 
                smart contract vulnerabilities, oracle failures, and extreme market conditions. The vault targets 
                delta-neutrality but cannot guarantee zero directional exposure at all times. Past performance 
                and backtested results do not guarantee future returns. Only deposit funds you can afford to lose.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

