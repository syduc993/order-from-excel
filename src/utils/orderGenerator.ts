import { Customer, Product } from '@/types/excel';
import { ApiOrderRequest, ApiProduct } from '@/types/api';
import { DEFAULT_DEPOT_ID } from './constants';
import { validateCustomerId, validateProductId } from './validation';

interface OrderGenerationConfig {
  minTotalAmount: number; // 300,000
  maxTotalAmount: number; // 1,000,000
  minProductsPerOrder: number; // 1
  maxProductsPerOrder: number; // 5
  minQuantityPerProduct: number; // 1
  maxQuantityPerProduct: number; // 3
}

export function generateRandomOrder(
  customer: Customer,
  products: Product[],
  config: OrderGenerationConfig = {
    minTotalAmount: 300000,
    maxTotalAmount: 2000000, // Increased from 1M to 2M
    minProductsPerOrder: 1,
    maxProductsPerOrder: 5,
    minQuantityPerProduct: 1,
    maxQuantityPerProduct: 3,
  }
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

  // 5. Random số lượng sản phẩm trong đơn (1-5)
  // Tăng giới hạn lên một chút để dễ đạt 300k nếu sản phẩm giá rẻ
  const numProducts = Math.floor(
    Math.random() * (config.maxProductsPerOrder + 3 - config.minProductsPerOrder + 1)
  ) + config.minProductsPerOrder;

  // 6. Chọn sản phẩm
  const selectedProductsMap = new Map<number, { product: Product; quantity: number }>();
  let totalAmount = 0;
  const targetAmount = Math.floor(
    Math.random() * (config.maxTotalAmount - config.minTotalAmount + 1)
  ) + config.minTotalAmount;

  // Track temporary usage in this order
  const tempUsedQuantities = new Map<number, number>();

  // Loop condition: Continue if we haven't reached minTotalAmount OR (we haven't reached targetAmount AND haven't reached numProducts)
  // This ensures we prioritize reaching minTotalAmount
  let loopCount = 0;
  const maxLoop = 20; // Prevent infinite loop

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

    // Kiểm tra: Chỉ thêm nếu không vượt quá maxTotalAmount (trừ khi chưa đạt minTotalAmount thì cứ thêm)
    if (totalAmount + productAmount <= config.maxTotalAmount || totalAmount < config.minTotalAmount) {
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
    depotId: DEFAULT_DEPOT_ID,
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

