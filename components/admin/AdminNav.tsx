"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NAV_LINKS = [
  { href: "/admin/orders", label: "Rendelések" },
  { href: "/admin/shipping", label: "Futárrendelés" },
  { href: "/admin/products", label: "Termékek" },
  { href: "/admin/clipart", label: "Minták" },
];

export default function AdminNav() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">Varázskép Admin</span>
          {/* Desktop links */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-gray-600 transition-colors hover:text-gray-900"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop logout */}
        <button
          onClick={handleLogout}
          className="hidden text-sm text-gray-500 transition-colors hover:text-gray-900 md:block"
        >
          Kijelentkezés
        </button>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menü"
          aria-expanded={menuOpen}
          className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-6 w-6"
            aria-hidden="true"
          >
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="flex flex-col border-t border-gray-100 px-4 py-1 md:hidden">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 text-sm text-gray-700 transition-colors hover:text-gray-900"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="border-t border-gray-100 py-2.5 text-left text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            Kijelentkezés
          </button>
        </div>
      )}
    </nav>
  );
}
