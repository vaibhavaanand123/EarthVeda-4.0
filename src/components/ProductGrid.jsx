import ProductCard from './ProductCard';

export default function ProductGrid({ products, eagerCount = 0, variant = 'grid', label }) {
  return (
    <ul className={`product-grid product-grid--${variant}`} aria-label={label}>
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard product={product} eager={i < eagerCount} />
        </li>
      ))}
    </ul>
  );
}
