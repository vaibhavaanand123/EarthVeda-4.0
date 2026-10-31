/** Pack shot. Protein jars are photographed on colour and fill their frame. */
export default function ProductImage({ product, eager = false, alt }) {
  return (
    <img
      className={`pack-img pack-img--${product.range === 'protein' ? 'cover' : 'contain'}`}
      src={product.image}
      alt={alt ?? product.fullName}
      width="800"
      height="1100"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      onError={(event) => {
        const image = event.currentTarget;
        if (image.src.endsWith('/images/product-fallback.svg')) return;
        image.src = '/images/product-fallback.svg';
      }}
    />
  );
}
