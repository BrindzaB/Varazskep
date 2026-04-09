"use client";

import Link from "next/link";
import Image from "next/image";
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
        <Link href="/" aria-label="Varázskép főoldal">
          <Image
            src="/Fekvo-logo.svg"
            alt="Varázskép"
            width={140}
            height={40}
            priority
            unoptimized
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center md:flex">
          {navItems.map((item, index) => (
            <div key={item.href} className="flex items-center">
              {index > 0 && (
                <span className="mx-12 h-4 w-px bg-brand-violet" aria-hidden="true" />
              )}
              <Link
                href={item.href}
                className={`text-sm uppercase tracking-wide transition-colors hover:text-brand-violet focus:text-brand-violet ${
                  pathname === item.href
                    ? "font-bold text-brand-violet"
                    : "font-bold text-brand-blue"
                }`}
              >
                {item.label}
              </Link>
            </div>
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
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-blue text-[10px] font-semibold text-white">
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
                  className={`block rounded px-3 py-2 text-sm transition-colors hover:bg-off-white hover:text-brand-violet focus:text-brand-violet ${
                    pathname === item.href
                      ? "font-semibold text-brand-blue"
                      : "font-medium text-brand-blue"
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
