/**
 * Validation utilities cho dữ liệu đơn hàng
 */

import { Customer, Product } from '@/types/excel';
import { ApiOrderRequest } from '@/types/api';

/**
 * Validate Customer ID
 */
export function validateCustomerId(customer: Customer): { valid: boolean; customerId?: number; error?: string } {
  const customerId = typeof customer.id === 'string' 
    ? parseInt(customer.id, 10) 
    : customer.id;
  
  if (!customerId || isNaN(customerId) || customerId <= 0) {
    return {
      valid: false,
      error: `Customer ID không hợp lệ: ${customer.id}. Phải là số nguyên dương.`,
    };
  }
  
  return { valid: true, customerId };
}

/**
 * Validate Product ID
 */
export function validateProductId(product: Product): { valid: boolean; productId?: number; error?: string } {
  if (!product.id || isNaN(product.id) || product.id <= 0) {
    return {
      valid: false,
      error: `Product ID không hợp lệ: ${product.id}. Phải là số nguyên dương.`,
    };
  }
  
  return { valid: true, productId: product.id };
}

/**
 * Validate ApiOrderRequest
 */
export function validateOrderRequest(order: ApiOrderRequest): { valid: boolean; error?: string } {
  // Validate depotId
  if (!order.depotId || order.depotId <= 0) {
    return {
      valid: false,
      error: 'Depot ID không hợp lệ. Phải là số nguyên dương.',
    };
  }
  
  // Validate customer
  if (!order.customer || !order.customer.id || order.customer.id <= 0) {
    return {
      valid: false,
      error: 'Customer ID không hợp lệ. Phải là số nguyên dương.',
    };
  }
  
  // Validate products
  if (!order.products || !Array.isArray(order.products) || order.products.length === 0) {
    return {
      valid: false,
      error: 'Đơn hàng phải có ít nhất 1 sản phẩm.',
    };
  }
  
  // Validate từng sản phẩm
  for (let i = 0; i < order.products.length; i++) {
    const product = order.products[i];
    if (!product.id || product.id <= 0) {
      return {
        valid: false,
        error: `Sản phẩm thứ ${i + 1} có ID không hợp lệ: ${product.id}`,
      };
    }
    if (product.quantity !== undefined && (product.quantity <= 0 || !Number.isInteger(product.quantity))) {
      return {
        valid: false,
        error: `Sản phẩm thứ ${i + 1} có số lượng không hợp lệ: ${product.quantity}`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Validate danh sách customers
 */
export function validateCustomers(customers: Customer[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!customers || customers.length === 0) {
    errors.push('Danh sách khách hàng không được rỗng.');
    return { valid: false, errors };
  }
  
  customers.forEach((customer, index) => {
    const validation = validateCustomerId(customer);
    if (!validation.valid) {
      errors.push(`Khách hàng thứ ${index + 1} (${customer.name}): ${validation.error}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate danh sách products
 */
export function validateProducts(products: Product[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!products || products.length === 0) {
    errors.push('Danh sách sản phẩm không được rỗng.');
    return { valid: false, errors };
  }
  
  products.forEach((product, index) => {
    const validation = validateProductId(product);
    if (!validation.valid) {
      errors.push(`Sản phẩm thứ ${index + 1} (${product.name}): ${validation.error}`);
    }
    
    // Validate giá
    if (!product.price || product.price <= 0) {
      errors.push(`Sản phẩm thứ ${index + 1} (${product.name}): Giá không hợp lệ: ${product.price}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate scheduled time
 */
export function validateScheduledTime(scheduledTime: Date): { valid: boolean; error?: string } {
  if (!(scheduledTime instanceof Date) || isNaN(scheduledTime.getTime())) {
    return {
      valid: false,
      error: 'Thời gian lên lịch không hợp lệ.',
    };
  }
  
  return { valid: true };
}

