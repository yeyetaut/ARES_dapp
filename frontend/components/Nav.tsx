"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Cpu, ShoppingCart, ShieldCheck, Wallet } from "@phosphor-icons/react";

const navItems = [
  { name: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { name: "Dashboard", href: "/dashboard", icon: Wallet },
  { name: "Verify", href: "/verify", icon: ShieldCheck },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-800/50 bg-black/60 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20 group-hover:border-accent/40 transition-colors">
            <Cpu size={20} className="text-accent" weight="fill" />
          </div>
          <span className="text-lg font-bold tracking-tighter text-white">ARES</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2",
                pathname === item.href
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              <item.icon size={16} />
              {item.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
