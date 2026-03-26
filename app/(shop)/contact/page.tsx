import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kapcsolat – Varázskép",
  description:
    "Látogasson el hozzánk személyesen, vagy keressen minket telefonon és e-mailben. Cím: 2400 Dunaújváros, Dózsa György út 4/c.",
};

export default function ContactPage() {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-content">
        <h1 className="text-3xl font-bold text-charcoal">Kapcsolat</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Kérdése van? Keressen minket az alábbi elérhetőségeken, vagy látogasson
          el hozzánk személyesen!
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Address */}
          <div className="rounded border border-border-light bg-white p-6">
            <h2 className="text-base font-semibold text-charcoal">Cím</h2>
            <address className="mt-3 space-y-1 not-italic">
              <p className="text-base text-charcoal">Varázs-kép Kft.</p>
              <p className="text-base text-muted">
                2400 Dunaújváros, Dózsa György út 4/c
              </p>
              <p className="text-base text-muted">Tojásház Alagsor</p>
            </address>
          </div>

          {/* Opening hours */}
          <div className="rounded border border-border-light bg-white p-6">
            <h2 className="text-base font-semibold text-charcoal">
              Nyitvatartás
            </h2>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-base">
                <span className="text-charcoal">Hétfő – Csütörtök</span>
                <span className="text-muted">8:00–12:00, 13:00–18:00</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-charcoal">Péntek – Vasárnap</span>
                <span className="text-muted">Zárva</span>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="rounded border border-border-light bg-white p-6">
            <h2 className="text-base font-semibold text-charcoal">Telefon</h2>
            <p className="mt-3 text-base text-muted">
              Személyesen vagy telefonon várjuk megkeresését a nyitvatartási
              időn belül.
            </p>
          </div>

          {/* Note */}
          <div className="rounded border border-border-light bg-white p-6">
            <h2 className="text-base font-semibold text-charcoal">
              Rendelés leadása
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              Rendeléseit a webshopunkon keresztül adhatja le. Ha kérdése van
              egy konkrét termékkel kapcsolatban, keressen minket személyesen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
