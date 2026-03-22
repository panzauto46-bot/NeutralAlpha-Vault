import { Github, Twitter, MessageCircle, FileText, ExternalLink } from 'lucide-react';

export default function Footer() {
  const links = {
    product: [
      { label: 'Dashboard', href: '#dashboard' },
      { label: 'Strategy', href: '#strategy' },
      { label: 'Risks', href: '#risks' },
      { label: 'Performance', href: '#performance' },
    ],
    resources: [
      { label: 'Documentation', href: '#docs' },
      { label: 'GitHub', href: 'https://github.com', external: true },
      { label: 'Solscan', href: 'https://solscan.io', external: true },
      { label: 'Drift Protocol', href: 'https://drift.trade', external: true },
    ],
    community: [
      { label: 'Twitter', href: 'https://twitter.com', external: true },
      { label: 'Discord', href: 'https://discord.com', external: true },
      { label: 'Telegram', href: 'https://telegram.org', external: true },
    ],
  };

  return (
    <footer className="relative border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">N</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">NeutralAlpha</h3>
                <p className="text-xs text-slate-500">VAULT</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-6 max-w-sm">
              AI-driven delta-neutral yield strategy on Solana. Earn sustainable returns 
              through funding rate arbitrage without directional exposure.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://github.com" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <Github className="w-5 h-5 text-slate-400" />
              </a>
              <a href="https://twitter.com" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <Twitter className="w-5 h-5 text-slate-400" />
              </a>
              <a href="https://discord.com" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <MessageCircle className="w-5 h-5 text-slate-400" />
              </a>
              <a href="#docs" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <FileText className="w-5 h-5 text-slate-400" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {links.product.map((link, i) => (
                <li key={i}>
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
              {links.resources.map((link, i) => (
                <li key={i}>
                  <a 
                    href={link.href} 
                    className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                  >
                    {link.label}
                    {link.external && <ExternalLink className="w-3 h-3" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Community</h4>
            <ul className="space-y-3">
              {links.community.map((link, i) => (
                <li key={i}>
                  <a 
                    href={link.href} 
                    className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © 2026 NeutralAlpha Vault. Built for Ranger Build-A-Bear Hackathon.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#risks" className="hover:text-white transition-colors">Risk Disclosure</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
