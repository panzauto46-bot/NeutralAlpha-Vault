import { motion } from "framer-motion";
import { Server, Database, Cpu, Globe, ArrowRight, Layers, Code, Zap } from "lucide-react";

export default function Architecture() {
  const onChainComponents = [
    {
      name: "Vault Contract",
      tech: "Ranger Earn SDK",
      role: "Holds USDC, mints shares, handles withdrawals",
      color: "green",
    },
    {
      name: "Perp Hedge",
      tech: "Drift Protocol (CPI)",
      role: "Opens and closes short perpetual positions",
      color: "blue",
    },
    {
      name: "Spot Position",
      tech: "Jupiter Aggregator",
      role: "Best-execution spot swaps for delta management",
      color: "cyan",
    },
    {
      name: "Oracle",
      tech: "Pyth Network",
      role: "Price feeds for delta calculation",
      color: "amber",
    },
  ];

  const offChainComponents = [
    {
      name: "AI Signal Engine",
      tech: "Python + XGBoost",
      role: "Predicts funding rates and signal actions",
      icon: Cpu,
    },
    {
      name: "Data Pipeline",
      tech: "Helius RPC + WebSocket",
      role: "Streams real-time market and account data",
      icon: Database,
    },
    {
      name: "Risk Monitor",
      tech: "Node.js daemon",
      role: "Monitors health ratio and emergency conditions",
      icon: Server,
    },
    {
      name: "Dashboard",
      tech: "React + Recharts",
      role: "Displays transparent telemetry for users",
      icon: Globe,
    },
  ];

  const protocols = [
    { name: "Solana", desc: "Base Layer", logo: "S" },
    { name: "Ranger Earn", desc: "Vault SDK", logo: "RE" },
    { name: "Drift", desc: "Perpetuals", logo: "D" },
    { name: "Jupiter", desc: "Aggregator", logo: "J" },
    { name: "Pyth", desc: "Oracles", logo: "P" },
    { name: "Helius", desc: "RPC", logo: "H" },
  ];

  const flowSteps = [
    { step: "1", label: "User deposits USDC" },
    { step: "2", label: "Vault allocates 50/50" },
    { step: "3", label: "AI monitors signals" },
    { step: "4", label: "Funding accrues" },
    { step: "5", label: "User withdraws" },
  ];

  return (
    <section id="docs" className="py-20 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-green-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-blue-500/30 mb-6">
            <Code className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300 font-medium">Technical Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Built on Proven Infrastructure</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            NeutralAlpha uses battle-tested Solana protocols with clear on-chain and off-chain responsibilities.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-4 mb-16"
        >
          {protocols.map((protocol) => (
            <div key={protocol.name} className="glass rounded-2xl px-6 py-4 flex items-center gap-3 card-hover">
              <span className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-semibold grid place-items-center">
                {protocol.logo}
              </span>
              <div>
                <div className="text-white font-semibold">{protocol.name}</div>
                <div className="text-xs text-slate-500">{protocol.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Layers className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">On-Chain Components</h3>
                <p className="text-xs text-slate-500">Solana programs and CPI integrations</p>
              </div>
            </div>
            <div className="space-y-3">
              {onChainComponents.map((comp) => (
                <div key={comp.name} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div
                    className={`w-1 h-12 rounded-full ${
                      comp.color === "green"
                        ? "bg-green-400"
                        : comp.color === "blue"
                          ? "bg-blue-400"
                          : comp.color === "cyan"
                            ? "bg-cyan-400"
                            : "bg-amber-400"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white font-medium">{comp.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{comp.tech}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{comp.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Server className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Off-Chain Components</h3>
                <p className="text-xs text-slate-500">Backend services and AI control loop</p>
              </div>
            </div>
            <div className="space-y-3">
              {offChainComponents.map((comp) => (
                <div key={comp.name} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <comp.icon className="w-5 h-5 text-blue-300" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white font-medium">{comp.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{comp.tech}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{comp.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-8"
        >
          <h3 className="text-lg font-semibold text-white mb-6 text-center">System Flow</h3>
          <div className="flex flex-wrap justify-center items-center gap-4">
            {flowSteps.map((item, i) => (
              <div key={item.step} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-xl text-white font-semibold mb-2">
                    {item.step}
                  </div>
                  <span className="text-xs text-slate-400 text-center max-w-24">{item.label}</span>
                </div>
                {i < flowSteps.length - 1 ? <ArrowRight className="w-5 h-5 text-slate-600 hidden sm:block" /> : null}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-green-500/30">
            <Zap className="w-5 h-5 text-green-400" />
            <span className="text-white font-medium">Ranger Build-A-Bear Hackathon 2026</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Solo Submission</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
