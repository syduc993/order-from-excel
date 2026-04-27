import { Customer, Product } from '@/types/excel';
import { ApiOrderRequest, ApiProduct } from '@/types/api';
import { validateCustomerId, validateProductId } from './validation';
import { DEFAULT_SETTINGS, type OrderRulesConfig } from '@/types/settings';

export function generateRandomOrder(
  customer: Customer,
  products: Product[],
  config: OrderRulesConfig = DEFAULT_SETTINGS.orderRules,
  depotId: number = DEFAULT_SETTINGS.apiConfig.depotId
): { order: ApiOrderRequest; totalAmount: number; usedProducts: Map<number, number> } | null {
  // 1. Validate Customer ID
  const customerValidation = validateCustomerId(customer);
  if (!customerValidation.valid || !customerValidation.customerId) {
    return null;
  }
  const customerId = customerValidation.customerId;

  // 2. Validate Products & Filter available ones
  if (!products || products.length === 0) {
    return null;
  }

  // Filter out invalid products or out of stock
  const validProducts = products.filter(p => {
    const productValidation = validateProductId(p);
    return productValidation.valid && p.price > 0 && p.quantity > 0;
  });

  if (validProducts.length === 0) {
    return null;
  }

  // 3. Sắp xếp sản phẩm theo giá (từ thấp đến cao)
  const sortedProducts = [...validProducts].sort((a, b) => a.price - b.price);

  // 4. Chia sản phẩm thành các nhóm giá
  const lowPriceProducts = sortedProducts.slice(0, Math.floor(sortedProducts.length * 0.6)); // 60% giá thấp
  const midPriceProducts = sortedProducts.slice(
    Math.floor(sortedProducts.length * 0.6),
    Math.floor(sortedProducts.length * 0.9)
  ); // 30% giá trung
  const highPriceProducts = sortedProducts.slice(Math.floor(sortedProducts.length * 0.9)); // 10% giá cao

  // 5. Random số lượng sản phẩm trong đơn — cộng productCountSlack để dễ đạt minTotalAmount với pool giá rẻ
  const slack = Math.max(0, config.productCountSlack);
  const productRange = config.maxProductsPerOrder + slack - config.minProductsPerOrder + 1;
  const numProducts = Math.floor(Math.random() * Math.max(1, productRange)) + config.minProductsPerOrder;

  // 6. Chọn sản phẩm
  const selectedProductsMap = new Map<number, { product: Product; quantity: number }>();
  let totalAmount = 0;

  // Skewed target: u^skew biased về min (đa số đơn giá trị nhỏ, đuôi dài lên cao).
  // skew=1 → uniform; skew=2.5 → log-normal-like; skew=3+ → rất lệch trái.
  const skew = Math.max(1, config.targetAmountSkew);
  const u = Math.random();
  const skewed = Math.pow(u, skew);
  const targetAmount = Math.floor(
    config.minTotalAmount + skewed * (config.maxTotalAmount - config.minTotalAmount)
  );

  // Track temporary usage in this order
  const tempUsedQuantities = new Map<number, number>();

  // Loop condition: Continue if we haven't reached minTotalAmount OR (we haven't reached targetAmount AND haven't reached numProducts)
  // This ensures we prioritize reaching minTotalAmount
  let loopCount = 0;
  const maxLoop = Math.max(5, config.maxGenerationLoops);

  while (
    (totalAmount < config.minTotalAmount || (totalAmount < targetAmount && selectedProductsMap.size < numProducts)) &&
    loopCount < maxLoop
  ) {
    loopCount++;

    // Xác suất chọn: 60% giá thấp, 30% giá trung, 10% giá cao
    const rand = Math.random();
    let productPool: Product[];

    if (rand < 0.6 && lowPriceProducts.length > 0) {
      productPool = lowPriceProducts;
    } else if (rand < 0.9 && midPriceProducts.length > 0) {
      productPool = midPriceProducts;
    } else {
      productPool = highPriceProducts.length > 0 ? highPriceProducts : sortedProducts;
    }

    // Filter pool
    const availablePool = productPool.filter(p => {
      const used = tempUsedQuantities.get(p.id) || 0;
      return p.quantity - used > 0;
    });

    if (availablePool.length === 0) {
      // If preferred pool is empty, try ANY product
      const anyPool = sortedProducts.filter(p => {
        const used = tempUsedQuantities.get(p.id) || 0;
        return p.quantity - used > 0;
      });
      if (anyPool.length === 0) break; // No products left at all
      productPool = anyPool;
    } else {
      productPool = availablePool;
    }

    // Chọn random sản phẩm từ pool
    const randomProduct = productPool[Math.floor(Math.random() * productPool.length)];

    // Determine max quantity we can take
    const currentUsed = tempUsedQuantities.get(randomProduct.id) || 0;
    const remainingStock = randomProduct.quantity - currentUsed;

    // Random số lượng (1-3), but capped by remaining stock
    const maxQ = Math.min(config.maxQuantityPerProduct, remainingStock);
    const minQ = Math.min(config.minQuantityPerProduct, maxQ);

    if (maxQ < 1) continue;

    const quantity = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ;
    const productAmount = randomProduct.price * quantity;

    // Soft cap chống outlier: khi đã vượt minTotalAmount, không cho overshoot maxTotalAmount.
    // Khi chưa đạt minTotalAmount, ưu tiên thử sản phẩm khác (cheaper) — chỉ chấp nhận overshoot
    // ở 2 vòng cuối để bảo đảm vẫn tạo được đơn.
    const wouldOvershoot = totalAmount + productAmount > config.maxTotalAmount;
    const belowMin = totalAmount < config.minTotalAmount;
    const desperate = loopCount >= maxLoop - 2;
    const accept = !wouldOvershoot || (belowMin && desperate);

    if (accept) {
      if (selectedProductsMap.has(randomProduct.id)) {
        const existing = selectedProductsMap.get(randomProduct.id)!;
        existing.quantity += quantity;
      } else {
        selectedProductsMap.set(randomProduct.id, { product: randomProduct, quantity });
      }

      tempUsedQuantities.set(randomProduct.id, (tempUsedQuantities.get(randomProduct.id) || 0) + quantity);
      totalAmount += productAmount;
    }
  }

  const selectedProducts = Array.from(selectedProductsMap.values());

  // 7. Đảm bảo tổng giá trị >= minTotalAmount
  // STRICT CHECK: If totalAmount < minTotalAmount, return null to retry
  if (totalAmount < config.minTotalAmount) {
    return null;
  }

  if (selectedProducts.length === 0) {
    return null;
  }

  // 8. Build API request
  const apiProducts: ApiProduct[] = selectedProducts.map(({ product, quantity }) => ({
    id: product.id,
    quantity,
    price: product.price, // Thêm price để API Nhanh.vn nhận payment
  }));

  const order: ApiOrderRequest = {
    depotId,
    customer: {
      id: customerId,
    },
    products: apiProducts,
    payment: {
      customerAmount: totalAmount,
    },
  };

  return {
    order,
    totalAmount: totalAmount,
    usedProducts: tempUsedQuantities
  };
}

