type VariantQuantity = { id: string; quantity: number };

export function updateVariantQuantity<T extends VariantQuantity>(variants: T[], variantId: string, quantity: number): T[] {
  return variants.map((variant) => variant.id === variantId ? { ...variant, quantity } : variant);
}
