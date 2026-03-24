import { Github, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { VAULT_PROGRAM_ID, buildSolscanAccountUrl } from "@/config/network";

export default function Footer() {
  const productLinks = [
    { label: "Landing", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Strategy", href: "/#strategy" },
    { label: "Risk Controls", href: "/#risks" },
  ];

  const resourceLinks = [
    {
      label: "GitHub Repository",
      href: "https://github.com/panzauto46-bot/NeutralAlpha-Vault",
      external: true,
    },
    {
      label: "Solscan Program",
      href: VAULT_PROGRAM_ID ? buildSolscanAccountUrl(VAULT_PROGRAM_ID) : "https://solscan.io",
      external: true,
    },
    { label: "Architecture", href: "/#docs", external: false },
  ];

  return (
    <footer className="relative border-t border-white/10 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">N</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">NeutralAlpha Vault</h3>
                <p className="text-xs text-slate-500">AI-Driven Delta-Neutral Strategy</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed mb-5">
              Built for transparent, risk-aware yield generation on Solana using a delta-neutral
              structure with monitoring and guardrails.
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-green-500/25 bg-green-500/10 text-green-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                Guardrails Enabled
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/10">
                <FileText className="w-3.5 h-3.5" />
                Hackathon Build
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                  >
                    {link.label}
                    {link.external ? <ExternalLink className="w-3.5 h-3.5" /> : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">(c) 2026 NeutralAlpha Vault. All rights reserved.</p>
          <a
            href="https://github.com/panzauto46-bot/NeutralAlpha-Vault"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            Source Code
          </a>
        </div>
      </div>
    </footer>
  );
}
