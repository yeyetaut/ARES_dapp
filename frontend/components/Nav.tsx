"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/verify",      label: "Verify"      },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-950/90 backdrop-blur z-10">
      <Link href="/" className="text-xl font-bold tracking-tight text-indigo-400">
        ARES
      </Link>
      <div className="flex items-center gap-6">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium transition-colors ${
              pathname.startsWith(l.href)
                ? "text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
        <ConnectButton />
      </div>
    </nav>
  );
}
