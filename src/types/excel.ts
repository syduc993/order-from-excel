export interface Customer {
  id: string;
  name: string;
  phone: string;
}

export interface Product {
  code: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderRow {
  'Kho hàng': string;
  'Họ Tên': string;
  'Điện thoại': string;
  'Địa Chỉ': string;
  'Tỉnh/Thành Phố': string;
  'Quận/Huyện': string;
  'Phường/Xã': string;
  'Nhãn khách hàng': string;
  Email: string;
  'Nhãn đơn hàng': string;
  'Sản Phẩm': string;
  'Số lượng': number;
  'Đơn giá': number;
  'Chiết khấu sản phẩm': string;
  'Tiền đặt cọc': string;
  'Mã tài khoản tiền mặt': string;
  'Tiền chuyển khoản': string;
  'Mã tài khoản chuyển khoản': string;
  'Tiền Chiết Khấu': string;
  'Phí vận chuyển': string;
  'Phí Thu Của Khách': string;
  'Mô tả': string;
  'Ghi chú CSKH': string;
  'Nguồn đơn hàng': string;
  'Cho khách xem hàng': string;
  'Ngày giao hàng': string;
  'Nhân viên bán hàng': string;
  'Ngày hẹn thanh toán': string;
  'Khai giá': string;
  'Giá trị khai giá': string;
  'Khối lượng đơn hàng': string;
}

export type DistributionMethod = 'random' | 'sequential' | 'even';
