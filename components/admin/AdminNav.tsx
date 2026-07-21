"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminNav() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-900">Varázskép Admin</span>
        <Link
          href="/admin/orders"
          className="text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          Rendelések
        </Link>
        <Link
          href="/admin/shipping"
          className="text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          Futárrendelés
        </Link>
        <Link
          href="/admin/products"
          className="text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          Termékek
        </Link>
        <Link
          href="/admin/clipart"
          className="text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          Minták
        </Link>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        Kijelentkezés
      </button>
    </nav>
  );
}
