"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const PRODUCTS = [
  { src: "/images/Termekek_bogre.jpg", label: "Bögre" },
  { src: "/images/Termekek_polo.jpg", label: "Póló" },
  { src: "/images/Termekek_parna.jpg", label: "Párna" },
  { src: "/images/Termekek_puzzle.jpg", label: "Puzzle" },
  { src: "/images/Termekek_vaszontaska.jpg", label: "Vászontáska" },
  { src: "/images/Termekek_vaszonkep.jpg", label: "Vászonkép" },
  { src: "/images/Termekek_matrica.jpg", label: "Matrica" },
  { src: "/images/Termekek_naptar.jpg", label: "Naptár" },
  { src: "/images/Termekek_hutomagnes.jpg", label: "Hűtőmágnes" },
  { src: "/images/Termekek_egerpad.jpg", label: "Egérpad" },
  { src: "/images/Termekek_fotonyomtatas.jpg", label: "Fotónyomtatás" },
  { src: "/images/Termekek_nyakpant.jpg", label: "Nyakpánt" },
  { src: "/images/Termekek_sportmez.jpg", label: "Sportmez" },
  { src: "/images/Termekek_munkaruha.jpg", label: "Munkaruha" },
  { src: "/images/Termekek_Molino.jpg", label: "Molino" },
  { src: "/images/Termekek_Nevjegykartya.jpg", label: "Névjegykártya" },
  { src: "/images/Termekek_Plakat1.jpg", label: "Plakát" },
  { src: "/images/Termekek_tabla.jpg", label: "Tábla" },
];

const DOUBLED = [...PRODUCTS, ...PRODUCTS];
const TOTAL = PRODUCTS.length;

function useVisibleCount(): number {
  const [count, setCount] = useState(5);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setCount(5);
      else if (w >= 1024) setCount(4);
      else if (w >= 768) setCount(3);
      else if (w >= 640) setCount(2);
      else setCount(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
}

export default function ProductSlider() {
  const [startIndex, setStartIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const visibleCount = useVisibleCount();

  const next = () => setStartIndex((i) => (i + 1) % TOTAL);
  const prev = () => setStartIndex((i) => (i - 1 + TOTAL) % TOTAL);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(next, 3500);
    return () => clearInterval(id);
  }, [isPaused]);

  const itemWidthPct = 100 / visibleCount;
  const translatePct = startIndex * itemWidthPct;

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Track */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${translatePct}%)` }}
      >
        {DOUBLED.map((item, i) => (
          <Link
            key={i}
            href="/products"
            className="relative flex-shrink-0 px-1.5"
            style={{ width: `${itemWidthPct}%` }}
          >
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <Image
                src={item.src}
                alt={item.label}
                fill
                className="object-cover transition-transform duration-300 hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 py-3">
                <span className="text-sm font-semibold text-white">
                  {item.label}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Prev button */}
      <button
        onClick={prev}
        aria-label="Előző"
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-r-md bg-white/90 px-2 py-3 shadow-md transition-colors hover:bg-brand-blue hover:text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Next button */}
      <button
        onClick={next}
        aria-label="Következő"
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-l-md bg-white/90 px-2 py-3 shadow-md transition-colors hover:bg-brand-blue hover:text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
