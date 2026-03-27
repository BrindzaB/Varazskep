"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCartStore } from "@/lib/cart/cartStore";

const navItems = [
  { label: "Főoldal", href: "/" },
  { label: "Termékek", href: "/products" },
  { label: "Tervező", href: "/designer" },
  { label: "Kapcsolat", href: "/contact" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const cartCount = useCartStore((state) =>
    state.items.reduce((sum, i) => sum + i.quantity, 0),
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border-light bg-white">
      <div className="mx-auto flex max-w-layout items-center justify-between px-4 py-4">
        {/* Logo — replace src with /logo.svg once the asset is available */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-charcoal"
        >
          Varázskép
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors hover:text-charcoal-dark ${
                pathname === item.href
                  ? "font-semibold text-charcoal underline underline-offset-4"
                  : "font-medium text-charcoal"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side: cart icon (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-4">
          {/* Cart icon with live item count badge */}
          <Link
            href="/cart"
            aria-label="Kosár"
            className="relative hidden text-charcoal hover:text-charcoal-dark md:block"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-charcoal text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </Link>

          {/* Hamburger button (mobile only) */}
          <button
            className="flex items-center text-charcoal md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Menü bezárása" : "Menü megnyitása"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              // X icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              // Hamburger icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-border-light bg-white px-4 pb-4 md:hidden">
          <ul className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded px-3 py-2 text-sm transition-colors hover:bg-off-white ${
                    pathname === item.href
                      ? "font-semibold text-charcoal"
                      : "font-medium text-charcoal"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-border-light pt-2">
              <Link
                href="/cart"
                onClick={() => setMobileOpen(false)}
                className="block rounded px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-off-white"
              >
                Kosár
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
