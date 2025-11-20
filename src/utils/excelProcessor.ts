import ExcelJS from 'exceljs';
import { Customer, Product, OrderRow, DistributionMethod } from '@/types/excel';

const REQUIRED_COLUMNS = [
  'Kho hàng',
  'Họ Tên',
  'Điện thoại',
  'Địa Chỉ',
  'Tỉnh/Thành Phố',
  'Quận/Huyện',
  'Phường/Xã',
  'Nhãn khách hàng',
  'Email',
  'Nhãn đơn hàng',
  'Sản Phẩm',
  'Số lượng',
  'Đơn giá',
  'Chiết khấu sản phẩm',
  'Tiền đặt cọc',
  'Mã tài khoản tiền mặt',
  'Tiền chuyển khoản',
  'Mã tài khoản chuyển khoản',
  'Tiền Chiết Khấu',
  'Phí vận chuyển',
  'Phí Thu Của Khách',
  'Mô tả',
  'Ghi chú CSKH',
  'Nguồn đơn hàng',
  'Cho khách xem hàng',
  'Ngày giao hàng',
  'Nhân viên bán hàng',
  'Ngày hẹn thanh toán',
  'Khai giá',
  'Giá trị khai giá',
  'Khối lượng đơn hàng',
];

export const parseCustomerFile = async (file: File): Promise<Customer[]> => {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet('DSKH');
  if (!worksheet) {
    throw new Error('Không tìm thấy sheet "DSKH" trong file khách hàng');
  }

  const customers: Customer[] = [];
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value?.toString() || '';
  });

  const idIndex = headers.findIndex((h) => h.toLowerCase() === 'id');
  const nameIndex = headers.findIndex((h) => h.toLowerCase().includes('tên'));
  const phoneIndex = headers.findIndex((h) => h.toLowerCase().includes('điện thoại') || h.toLowerCase().includes('sđt'));

  if (idIndex === -1 || nameIndex === -1 || phoneIndex === -1) {
    throw new Error('File khách hàng phải có các cột: ID, Tên khách hàng, Số điện thoại');
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const id = row.getCell(idIndex).value?.toString() || '';
    const name = row.getCell(nameIndex).value?.toString() || '';
    const phone = row.getCell(phoneIndex).value?.toString() || '';

    if (id && name && phone) {
      customers.push({ id, name, phone });
    }
  });

  return customers;
};

export const parseProductFile = async (file: File): Promise<Product[]> => {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet('DSSP');
  if (!worksheet) {
    throw new Error('Không tìm thấy sheet "DSSP" trong file sản phẩm');
  }

  const products: Product[] = [];
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value?.toString() || '';
  });

  const codeIndex = headers.findIndex((h) => h.toLowerCase().includes('mã'));
  const nameIndex = headers.findIndex((h) => h.toLowerCase().includes('tên'));
  const quantityIndex = headers.findIndex((h) => h.toLowerCase().includes('số lượng'));
  const priceIndex = headers.findIndex((h) => h.toLowerCase().includes('giá'));

  if (codeIndex === -1 || nameIndex === -1 || quantityIndex === -1 || priceIndex === -1) {
    throw new Error('File sản phẩm phải có các cột: Mã hàng, Tên hàng, Số lượng bán lẻ, Giá bán lẻ (Có VAT)');
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = row.getCell(codeIndex).value?.toString() || '';
    const name = row.getCell(nameIndex).value?.toString() || '';
    const quantity = Number(row.getCell(quantityIndex).value) || 0;
    const price = Number(row.getCell(priceIndex).value) || 0;

    if (code && name && quantity > 0 && price > 0) {
      products.push({ code, name, quantity, price });
    }
  });

  return products;
};

export const validateTemplate = async (file: File): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet('template');
  if (!worksheet) {
    throw new Error('Không tìm thấy sheet "template" trong file template');
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.value?.toString() || '';
  });

  if (headers.length !== REQUIRED_COLUMNS.length) {
    throw new Error(`File template phải có đúng ${REQUIRED_COLUMNS.length} cột`);
  }

  for (let i = 0; i < REQUIRED_COLUMNS.length; i++) {
    if (headers[i] !== REQUIRED_COLUMNS[i]) {
      throw new Error(`Cột thứ ${i + 1} phải là "${REQUIRED_COLUMNS[i]}", nhưng lại là "${headers[i]}"`);
    }
  }

  return workbook;
};

export const distributeProducts = (
  customers: Customer[],
  products: Product[],
  method: DistributionMethod
): OrderRow[] => {
  const orders: OrderRow[] = [];
  let customerIndex = 0;

  for (const product of products) {
    let remainingQuantity = product.quantity;

    while (remainingQuantity > 0) {
      const customer = customers[customerIndex % customers.length];
      const quantityToAssign = Math.min(remainingQuantity, Math.floor(Math.random() * 2) + 1);

      const order: OrderRow = {
        'Kho hàng': '',
        'Họ Tên': customer.name,
        'Điện thoại': customer.phone,
        'Địa Chỉ': '',
        'Tỉnh/Thành Phố': '',
        'Quận/Huyện': '',
        'Phường/Xã': '',
        'Nhãn khách hàng': '',
        Email: '',
        'Nhãn đơn hàng': '',
        'Sản Phẩm': product.name,
        'Số lượng': quantityToAssign,
        'Đơn giá': product.price,
        'Chiết khấu sản phẩm': '',
        'Tiền đặt cọc': '',
        'Mã tài khoản tiền mặt': '',
        'Tiền chuyển khoản': '',
        'Mã tài khoản chuyển khoản': '',
        'Tiền Chiết Khấu': '',
        'Phí vận chuyển': '',
        'Phí Thu Của Khách': '',
        'Mô tả': '',
        'Ghi chú CSKH': '',
        'Nguồn đơn hàng': '',
        'Cho khách xem hàng': '',
        'Ngày giao hàng': '',
        'Nhân viên bán hàng': '',
        'Ngày hẹn thanh toán': '',
        'Khai giá': '',
        'Giá trị khai giá': '',
        'Khối lượng đơn hàng': '',
      };

      orders.push(order);
      remainingQuantity -= quantityToAssign;

      if (method === 'random') {
        customerIndex = Math.floor(Math.random() * customers.length);
      } else {
        customerIndex++;
      }
    }
  }

  return orders;
};

export const generateOutputFile = async (
  templateWorkbook: ExcelJS.Workbook,
  orders: OrderRow[]
): Promise<Blob> => {
  const worksheet = templateWorkbook.getWorksheet('template')!;

  // Xóa dữ liệu cũ nhưng giữ header
  const rowCount = worksheet.rowCount;
  for (let i = rowCount; i > 1; i--) {
    worksheet.spliceRows(i, 1);
  }

  // Thêm dữ liệu mới
  orders.forEach((order) => {
    const row = worksheet.addRow(Object.values(order));
    // Giữ nguyên style của template
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  // Xuất file
  const buffer = await templateWorkbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};
