import ProductCard from "@/components/shop/ProductCard";
import type { ProductWithVariants } from "@/lib/services/product";

interface ProductGridProps {
  products: ProductWithVariants[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="py-16 text-center text-muted">
        Jelenleg nincsenek elérhető termékek.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
