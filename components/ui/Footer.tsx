import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border-light bg-white">
      <div className="mx-auto max-w-layout px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <p className="text-base font-bold text-charcoal">Varázskép</p>
            <p className="mt-2 text-sm text-muted">
              Egyedi ajándékok nyomtatással.
            </p>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm font-semibold text-charcoal">Elérhetőség</p>
            <address className="mt-2 space-y-1 not-italic">
              <p className="text-sm text-muted">
                2400 Dunaújváros, Dózsa György út 4/c
              </p>
              <p className="text-sm text-muted">Tojásház Alagsor</p>
            </address>
          </div>

          {/* Opening hours */}
          <div>
            <p className="text-sm font-semibold text-charcoal">Nyitvatartás</p>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted">
                H–Cs: 8:00–12:00, 13:00–18:00
              </p>
              <p className="text-sm text-muted">P–V: Zárva</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border-light pt-6 sm:flex-row">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Varázskép. Minden jog fenntartva.
          </p>
          <Link
            href="/adatvedelem"
            className="text-xs text-muted underline-offset-2 hover:underline"
          >
            Adatvédelmi tájékoztató
          </Link>
        </div>
      </div>
    </footer>
  );
}
