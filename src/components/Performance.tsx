import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { TrendingUp, Calendar, Target, Percent } from 'lucide-react';

const yieldProjections = [
  { scenario: 'Bear', rate: '0.005%', gross: 16, net: 12 },
  { scenario: 'Base', rate: '0.010%', gross: 27, net: 22 },
  { scenario: 'Bull', rate: '0.020%', gross: 54, net: 42 },
];

const comparisonData = [
  { name: 'NeutralAlpha', value: 24, color: '#22c55e' },
  { name: 'DEX LP', value: 15, color: '#64748b' },
  { name: 'Lending', value: 5, color: '#64748b' },
  { name: 'Staking', value: 8, color: '#64748b' },
];

const radarData = [
  { metric: 'Yield', neutralAlpha: 85, dexLP: 70, lending: 30 },
  { metric: 'Safety', neutralAlpha: 90, dexLP: 40, lending: 85 },
  { metric: 'Liquidity', neutralAlpha: 60, dexLP: 80, lending: 95 },
  { metric: 'Automation', neutralAlpha: 95, dexLP: 50, lending: 70 },
  { metric: 'Transparency', neutralAlpha: 90, dexLP: 75, lending: 80 },
];

export default function Performance() {
  return (
    <section id="performance" className="py-20 relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-green-500/30 mb-6">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Performance</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Yield Projections
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Based on 12-month backtesting using historical Drift Protocol funding rate data (Mar 2024 – Mar 2025)
          </p>
        </motion.div>

        {/* Yield Scenarios */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          {yieldProjections.map((proj, i) => (
            <div 
              key={i}
              className={`glass rounded-2xl p-6 card-hover ${
                proj.scenario === 'Base' ? 'ring-2 ring-green-500/50' : ''
              }`}
            >
              {proj.scenario === 'Base' && (
                <div className="text-xs font-medium text-green-400 mb-2">EXPECTED CASE</div>
              )}
              <h3 className="text-xl font-bold text-white mb-1">{proj.scenario} Market</h3>
              <p className="text-sm text-slate-500 mb-6">Avg funding: {proj.rate} / 8hr</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Gross APY</span>
                  <span className="text-2xl font-bold text-white">~{proj.gross}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Net APY</span>
                  <span className={`text-2xl font-bold ${
                    proj.scenario === 'Base' ? 'gradient-text' : 'text-green-400'
                  }`}>
                    ~{proj.net}%
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
                    style={{ width: `${(proj.net / 50) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Comparison Charts */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-2">APY Comparison</h3>
            <p className="text-sm text-slate-500 mb-6">vs other Solana yield strategies</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#32324a" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a24',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                    }}
                    formatter={(value) => [`${value}%`, 'APY']}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {comparisonData.map((entry, index) => (
                      <motion.rect
                        key={index}
                        fill={entry.color}
                        initial={{ width: 0 }}
                        animate={{ width: 'auto' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Radar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Strategy Comparison</h3>
            <p className="text-sm text-slate-500 mb-6">Multi-factor analysis</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#32324a" />
                  <PolarAngleAxis dataKey="metric" stroke="#64748b" fontSize={12} />
                  <PolarRadiusAxis stroke="#32324a" />
                  <Radar name="NeutralAlpha" dataKey="neutralAlpha" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                  <Radar name="DEX LP" dataKey="dexLP" stroke="#64748b" fill="#64748b" fillOpacity={0.1} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-400">NeutralAlpha</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-slate-500" />
                <span className="text-slate-400">DEX LP</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { icon: Target, label: 'Target APY', value: '18-35%', desc: 'Net of fees' },
            { icon: Percent, label: 'Performance Fee', value: '10%', desc: 'Of yield only' },
            { icon: Calendar, label: 'Lock Period', value: '3 months', desc: 'Rolling basis' },
            { icon: TrendingUp, label: 'Min Eligibility', value: '>10%', desc: 'Hackathon threshold' },
          ].map((metric, i) => (
            <div key={i} className="glass rounded-2xl p-6 card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <metric.icon className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-sm text-slate-400">{metric.label}</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
              <div className="text-xs text-slate-500">{metric.desc}</div>
            </div>
          ))}
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 p-4 rounded-xl bg-white/5 text-center"
        >
          <p className="text-xs text-slate-500">
            All projections are based on historical backtesting and do not guarantee future returns. 
            The vault targets a conservative 18%+ APY in base conditions — comfortably above the 10% minimum eligibility threshold.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
