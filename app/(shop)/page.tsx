import Image from "next/image";
import ProductSlider from "@/components/shop/ProductSlider";

export const metadata = {
  title: "Varázskép – Egyedi ajándékok",
  description:
    "Tervezze meg saját egyedi pólóját vagy bögrét! Prémium minőség, gyors szállítás.",
};

export default function HomePage() {

  return (
    <>
      {/* Hero — full-screen image with dark overlay */}
      <section className="relative flex min-h-[45vh] sm:min-h-[65vh] lg:min-h-[85vh] items-center">
        {/* Background image — place hero-bg.jpg in public/images/ */}
        <Image
          src="/images/hero-bg2.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0" />

        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-layout py-10 sm:py-16 lg:py-24 px-6 xl:px-0">
          <h1 className="text-balance text-4xl font-bold leading-tight text-brand-violet sm:text-5xl lg:text-6xl">
            Egyedi ajándékok,
            <br />
            általad tervezve
          </h1>
          <p className="mt-5 max-w-lg text-lg text-charcoal">
            Tervezd meg saját pólódat a beépített tervezőfelületen.
            Prémium minőség, egyedi minta, gyors szállítás.
          </p>
          <a
            href="/designer"
            className="mt-8 inline-block rounded-sm bg-brand-blue px-8 py-3.5 text-sm font-semibold text-white transition-transform druation-100 ease-in-out hover:bg-brand-violet hover:scale-105"
          >
            Tervezés megkezdése
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-4 pt-10 pb-20">
        <div className="mx-auto max-w-layout">
          <h2 className="mb-12 text-center text-2xl font-semibold uppercase text-brand-blue">
            Hogyan működik?
          </h2>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-violet/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e5197f"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-violet">
                1. lépés
              </span>
              <h3 className="mb-2 text-base font-semibold text-brand-blue">
                Válassz terméket
              </h3>
              <p className="text-sm text-muted">
                Böngéssz pólók, pulcsik és más termékek között, majd válaszd ki
                a neked tetszőt.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-violet/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e5197f"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-violet">
                2. lépés
              </span>
              <h3 className="mb-2 text-base font-semibold text-brand-blue">Tervezd meg</h3>
              <p className="text-sm text-muted">
                Adj hozzá képet, szöveget vagy mintát a beépített
                tervezőfelületen - pontosan ahogy elképzelted.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-violet/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e5197f"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="1" y="3" width="15" height="13" rx="1" />
                  <path d="M16 8h4l3 5v3h-7V8z" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-violet">
                3. lépés
              </span>
              <h3 className="mb-2 text-base font-semibold text-brand-blue">Rendeld meg</h3>
              <p className="text-sm text-muted">
                Biztonságos online fizetés után gyorsan kiszállítjuk az egyedi
                terméked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product listing */}
      <section className="bg-white pt-8 pb-16">
        <div className="mx-auto max-w-layout px-4 flex justify-center">
          <h2 className="mb-6 text-2xl font-semibold uppercase text-brand-blue">Termékeink</h2>
        </div>
        <ProductSlider />
      </section>
    </>
  );
}
