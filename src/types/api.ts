// Types cho API Nhanh.vn V3
export interface ApiCustomer {
  id: number;
}

export interface ApiProduct {
  id: number;
  quantity?: number; // Số lượng sản phẩm (1-3)
  price?: number; // Giá sản phẩm (cần thiết cho API Nhanh.vn)
}

export interface ApiPayment {
  customerAmount: number;
}

export interface ApiOrderRequest {
  depotId: number;
  customer: ApiCustomer;
  products: ApiProduct[];
  payment?: ApiPayment;
}

export interface ApiResponse {
  code: number;
  messages?: string[];
  data?: {
    id: number;
    totalAmount: number;
  };
}

