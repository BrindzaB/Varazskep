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
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-900">Varázskép Admin</span>
        <Link
          href="/admin/orders"
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Rendelések
        </Link>
        <Link
          href="/admin/products"
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Termékek
        </Link>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        Kijelentkezés
      </button>
    </nav>
  );
}
