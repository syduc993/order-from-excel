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

  const idIndex = headers.findIndex((h) => h?.toLowerCase() === 'id');
  const nameIndex = headers.findIndex((h) => h?.toLowerCase().includes('tên'));
  const phoneIndex = headers.findIndex((h) => h?.toLowerCase().includes('điện thoại') || h?.toLowerCase().includes('sđt'));

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

  const codeIndex = headers.findIndex((h) => {
    const lower = h?.toLowerCase();
    return lower === 'id' && !lower.includes('sản phẩm');
  });
  const nameIndex = headers.findIndex((h) => h?.toLowerCase().includes('tên'));
  const quantityIndex = headers.findIndex((h) => h?.toLowerCase().includes('số lượng'));
  const priceIndex = headers.findIndex((h) => h?.toLowerCase().includes('giá'));

  if (codeIndex === -1 || nameIndex === -1 || quantityIndex === -1 || priceIndex === -1) {
    throw new Error('File sản phẩm phải có các cột: ID, Tên hàng, Số lượng bán lẻ, Giá bán lẻ (Có VAT)');
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = row.getCell(codeIndex).value?.toString() || '';
    const name = row.getCell(nameIndex).value?.toString() || '';
    const quantity = Number(row.getCell(quantityIndex).value) || 0;
    const price = Number(row.getCell(priceIndex).value) || 0;
    const id = Number(row.getCell(codeIndex).value) || 0;

    if (code && name && quantity > 0 && price > 0 && id > 0) {
      products.push({ code, name, quantity, price, id });
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

// Helper function to read values from Named Range
const readNamedRange = (workbook: ExcelJS.Workbook, name: string): string[] => {
  const values: string[] = [];

  try {
    const definedNames = (workbook.model as any).names;
    const namedRange = definedNames?.find((n: any) => n.name === name);
    if (!namedRange) {
      console.warn(`Named Range "${name}" not found`);
      return [];
    }

    const formula = namedRange.formula || '';
    console.log(`Reading Named Range "${name}": formula = ${formula}`);

    let cleanFormula = formula.replace(/\$/g, '');
    const match = cleanFormula.match(/(?:'([^']+)'!)?([A-Z]+\d+):([A-Z]+\d+)/);
    if (match) {
      const sheetName = match[1] || '';
      const startCell = match[2];
      const endCell = match[3];

      const sheet = sheetName
        ? workbook.getWorksheet(sheetName)
        : workbook.worksheets[0];

      if (!sheet) {
        console.warn(`Sheet "${sheetName || 'default'}" not found for Named Range "${name}"`);
        return [];
      }

      const startMatch = startCell.match(/([A-Z]+)(\d+)/);
      const endMatch = endCell.match(/([A-Z]+)(\d+)/);

      if (startMatch && endMatch) {
        const col = startMatch[1];
        const startRow = parseInt(startMatch[2]);
        const endRow = parseInt(endMatch[2]);

        console.log(`Reading range ${col}${startRow}:${col}${endRow} from sheet "${sheetName || 'default'}"`);

        for (let row = startRow; row <= endRow; row++) {
          const cell = sheet.getCell(`${col}${row}`);
          const cellValue = cell.value;
          if (cellValue !== null && cellValue !== undefined) {
            const value = String(cellValue).trim();
            if (value) {
              values.push(value);
            }
          }
        }

        console.log(`Found ${values.length} values in Named Range "${name}"`);
      }
    } else {
      console.warn(`Could not parse formula for Named Range "${name}": ${formula}`);
    }
  } catch (error) {
    console.warn(`Error reading Named Range "${name}":`, error);
  }

  return values;
};

// Helper function to read values from a range formula
const readRangeFromFormula = (workbook: ExcelJS.Workbook, formula: string): string[] => {
  const values: string[] = [];

  try {
    let cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;
    cleanFormula = cleanFormula.replace(/\$/g, '');

    const match = cleanFormula.match(/(?:'([^']+)'!|([^!]+)!)?([A-Z]+\d+):([A-Z]+\d+)/);
    if (match) {
      const sheetName = match[1] || match[2] || 'template';
      const startCell = match[3];
      const endCell = match[4];

      const sheet = workbook.getWorksheet(sheetName);
      if (!sheet) {
        console.warn(`[readRangeFromFormula] Sheet "${sheetName}" not found`);
        return [];
      }

      const startMatch = startCell.match(/([A-Z]+)(\d+)/);
      const endMatch = endCell.match(/([A-Z]+)(\d+)/);

      if (startMatch && endMatch) {
        const col = startMatch[1];
        const startRow = parseInt(startMatch[2]);
        const endRow = parseInt(endMatch[2]);

        for (let row = startRow; row <= endRow; row++) {
          const cell = sheet.getCell(`${col}${row}`);
          const cellValue = cell.value;
          if (cellValue !== null && cellValue !== undefined) {
            const value = String(cellValue).trim();
            if (value) {
              values.push(value);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`[readRangeFromFormula] Error parsing formula "${formula}":`, error);
  }

  return values;
};

// Helper function to extract dropdown values from Named Range or Data Validation
const extractDropdownValues = (workbook: ExcelJS.Workbook, columnName: string): string[] => {
  console.log(`[extractDropdownValues] Extracting values for column: "${columnName}"`);

  // For "Tỉnh/Thành Phố", try Named Range "TenTinh" first
  if (columnName === 'Tỉnh/Thành Phố' || columnName === 'Tỉnh/Thành phố') {
    const namedRangeValues = readNamedRange(workbook, 'TenTinh');
    if (namedRangeValues.length > 0) {
      console.log(`[extractDropdownValues] Found ${namedRangeValues.length} provinces from Named Range "TenTinh"`);
      return namedRangeValues;
    }
    console.log(`[extractDropdownValues] Named Range "TenTinh" not found, trying data validation...`);
  }

  // Fallback: Try to find from data validation
  const worksheet = workbook.getWorksheet('template');
  if (!worksheet) {
    console.warn(`[extractDropdownValues] Worksheet "template" not found`);
    return [];
  }

  const headerRow = worksheet.getRow(1);
  let columnIndex = -1;

  headerRow.eachCell((cell, colNumber) => {
    if (cell.value?.toString() === columnName) {
      columnIndex = colNumber;
    }
  });

  if (columnIndex === -1) {
    console.warn(`[extractDropdownValues] Column "${columnName}" not found in header row`);
    return [];
  }

  // Check data validation on row 2 (first data row)
  const cell = worksheet.getRow(2).getCell(columnIndex);
  const dataValidation = cell.dataValidation;

  if (dataValidation && dataValidation.type === 'list') {
    const formulae: any = dataValidation.formulae;
    console.log(`[extractDropdownValues] Data validation found for "${columnName}": ${JSON.stringify(formulae)}`);

    if (Array.isArray(formulae) && formulae.length > 0) {
      const formula = formulae[0];

      // Handle INDIRECT formulas: skip for now (handled in extractCityDistrictMapping)
      if (typeof formula === 'string' && formula.includes('INDIRECT')) {
        console.log(`[extractDropdownValues] Skipping INDIRECT formula: ${formula}`);
        return [];
      }

      // IMPORTANT FIX: Check if formula is just a Named Range name (e.g., "TenTinh")
      // If it doesn't contain special characters like =, !, :, comma, it's likely a Named Range reference
      if (typeof formula === 'string' && !formula.includes('=') && !formula.includes('!') && !formula.includes(':') && !formula.includes(',') && !formula.includes('VLOOKUP')) {
        const namedRangeValues = readNamedRange(workbook, formula);
        if (namedRangeValues.length > 0) {
          console.log(`[extractDropdownValues] Formula "${formula}" is a Named Range, extracted ${namedRangeValues.length} values`);
          return namedRangeValues;
        }
        console.log(`[extractDropdownValues] Formula "${formula}" looks like a Named Range but not found, treating as literal value`);
      }

      // Handle comma-separated list: "value1,value2,value3"
      if (typeof formula === 'string' && formula.includes(',') && !formula.includes('!') && !formula.includes('VLOOKUP')) {
        const values = formula.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
        console.log(`[extractDropdownValues] Extracted ${values.length} values from comma-separated list`);
        return values;
      }

      // Handle range reference: "SheetName!$A$1:$A$10" or "$A$1:$A$10"
      if (typeof formula === 'string' && (formula.includes('!') || formula.match(/\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+/))) {
        const values = readRangeFromFormula(workbook, formula);
        if (values.length > 0) {
          console.log(`[extractDropdownValues] Extracted ${values.length} values from range reference`);
          return values;
        }
      }
    }
  } else {
    console.log(`[extractDropdownValues] No data validation found for "${columnName}"`);
  }

  return [];
};

// Default Vietnamese city-district mapping as final fallback
const getDefaultCityDistrictMapping = (): Map<string, string[]> => {
  const mapping = new Map<string, string[]>();

  mapping.set('Hà Nội', [
    'Ba Đình', 'Hoàn Kiếm', 'Tây Hồ', 'Long Biên', 'Cầu Giấy',
    'Đống Đa', 'Hai Bà Trưng', 'Hoàng Mai', 'Thanh Xuân', 'Nam Từ Liêm',
    'Bắc Từ Liêm', 'Hà Đông'
  ]);

  mapping.set('Hồ Chí Minh', [
    'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5',
    'Quận 6', 'Quận 7', 'Quận 8', 'Quận 9', 'Quận 10',
    'Quận 11', 'Quận 12', 'Bình Thạnh', 'Gò Vấp', 'Phú Nhuận',
    'Tân Bình', 'Tân Phú', 'Thủ Đức'
  ]);

  mapping.set('Đà Nẵng', [
    'Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn',
    'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang'
  ]);

  mapping.set('Cần Thơ', [
    'Ninh Kiều', 'Bình Thuỷ', 'Cái Răng', 'Ô Môn', 'Thốt Nốt'
  ]);

  mapping.set('Hải Phòng', [
    'Hồng Bàng', 'Ngô Quyền', 'Lê Chân', 'Hải An', 'Kiến An',
    'Đồ Sơn', 'Dương Kinh'
  ]);

  console.log('[getDefaultCityDistrictMapping] Using default mapping with 5 major cities');

  return mapping;
};

// Helper function to extract city-district mapping
const extractCityDistrictMapping = (workbook: ExcelJS.Workbook): Map<string, string[]> => {
  const mapping = new Map<string, string[]>();

  console.log('[extractCityDistrictMapping] Starting city-district mapping extraction...');

  try {
    // STRATEGY 1: Try to read from Named Ranges
    const tinhList = readNamedRange(workbook, 'TenTinh');
    if (tinhList.length > 0) {
      console.log(`[extractCityDistrictMapping] Found ${tinhList.length} provinces from Named Range "TenTinh"`);

      const tinhToCode = new Map<string, string>();
      const definedNames = (workbook.model as any).names;
      const tinhNamedRange = definedNames?.find((n: any) => n.name === 'Tinh');

      if (tinhNamedRange) {
        const formula = tinhNamedRange.formula || '';
        let cleanFormula = formula.replace(/\$/g, '');
        const match = cleanFormula.match(/(?:'([^']+)'!)?([A-Z]+\d+):([A-Z]+\d+)/);

        if (match) {
          const sheetName = match[1] || '';
          const startCell = match[2];
          const endCell = match[3];

          const sheet = sheetName
            ? workbook.getWorksheet(sheetName)
            : workbook.worksheets[0];

          if (sheet) {
            const startMatch = startCell.match(/([A-Z]+)(\d+)/);
            const endMatch = endCell.match(/([A-Z]+)(\d+)/);

            if (startMatch && endMatch) {
              const startCol = startMatch[1];
              const startRow = parseInt(startMatch[2]);
              const endRow = parseInt(endMatch[2]);

              for (let row = startRow; row <= endRow; row++) {
                const tinhNameCell = sheet.getCell(`${startCol}${row}`).value;
                const tinhName = tinhNameCell ? String(tinhNameCell).trim() : '';
                const nextCol = String.fromCharCode(startCol.charCodeAt(0) + 1);
                const tinhCodeCell = sheet.getCell(`${nextCol}${row}`).value;
                const tinhCode = tinhCodeCell ? String(tinhCodeCell).trim() : '';

                if (tinhName && tinhCode) {
                  tinhToCode.set(tinhName, tinhCode);
                }
              }
            }
          }
        }
      }

      for (const tinh of tinhList) {
        let tinhCode = tinhToCode.get(tinh);
        if (!tinhCode) {
          tinhCode = tinh.replace(/[^\w]/g, '');
        }

        const districts = readNamedRange(workbook, tinhCode);
        if (districts.length > 0) {
          mapping.set(tinh, districts);
          console.log(`[extractCityDistrictMapping] Found ${districts.length} districts for province "${tinh}"`);
        } else {
          mapping.set(tinh, []);
        }
      }

      if (mapping.size > 0) {
        console.log(`[extractCityDistrictMapping] Successfully extracted ${mapping.size} provinces with Named Ranges`);
        return mapping;
      }
    }

    console.log('[extractCityDistrictMapping] Named Range approach failed, trying data validation...');

    // STRATEGY 2: Try to extract from data validation
    const worksheet = workbook.getWorksheet('template');
    if (worksheet) {
      const headerRow = worksheet.getRow(1);
      let cityColumnIndex = -1;
      let districtColumnIndex = -1;

      headerRow.eachCell((cell, colNumber) => {
        const headerValue = cell.value?.toString() || '';
        if (headerValue === 'Tỉnh/Thành Phố' || headerValue === 'Tỉnh/Thành phố') {
          cityColumnIndex = colNumber;
        }
        if (headerValue === 'Quận/Huyện') {
          districtColumnIndex = colNumber;
        }
      });

      if (cityColumnIndex > 0 && districtColumnIndex > 0) {
        const cityCell = worksheet.getRow(2).getCell(cityColumnIndex);
        const cityValidation = cityCell.dataValidation;
        let cities: string[] = [];

        if (cityValidation && cityValidation.type === 'list') {
          const cityFormulae = cityValidation.formulae;
          if (Array.isArray(cityFormulae) && cityFormulae.length > 0) {
            const cityFormula = cityFormulae[0];
            if (typeof cityFormula === 'string') {
              cities = readRangeFromFormula(workbook, cityFormula);
              console.log(`[extractCityDistrictMapping] Found ${cities.length} cities from data validation`);
            }
          }
        }

        const districtCell = worksheet.getRow(2).getCell(districtColumnIndex);
        const districtValidation = districtCell.dataValidation;

        if (districtValidation && districtValidation.type === 'list') {
          const districtFormulae = districtValidation.formulae;
          if (Array.isArray(districtFormulae) && districtFormulae.length > 0) {
            const districtFormula = districtFormulae[0] as string;

            if (typeof districtFormula === 'string' && districtFormula.includes('INDIRECT')) {
              console.log(`[extractCityDistrictMapping] District uses INDIRECT formula: ${districtFormula}`);

              for (const city of cities) {
                const cityCode = city.replace(/[^\w]/g, '');
                const districts = readNamedRange(workbook, cityCode);
                if (districts.length > 0) {
                  mapping.set(city, districts);
                  console.log(`[extractCityDistrictMapping] Found ${districts.length} districts for "${city}" via INDIRECT`);
                } else {
                  const altCode = city.split(' ').slice(0, 3).join('');
                  const altDistricts = readNamedRange(workbook, altCode);
                  if (altDistricts.length > 0) {
                    mapping.set(city, altDistricts);
                  } else {
                    mapping.set(city, []);
                  }
                }
              }
            } else {
              const districts = readRangeFromFormula(workbook, districtFormula);
              if (districts.length > 0) {
                console.log(`[extractCityDistrictMapping] Found ${districts.length} static districts`);
                for (const city of cities) {
                  mapping.set(city, districts);
                }
              }
            }
          }
        }

        if (mapping.size > 0) {
          console.log(`[extractCityDistrictMapping] Successfully extracted ${mapping.size} provinces from data validation`);
          return mapping;
        }
      }
    }

    console.warn('[extractCityDistrictMapping] All extraction strategies failed, using default data...');

  } catch (error) {
    console.warn('[extractCityDistrictMapping] Error during extraction:', error);
  }

  return getDefaultCityDistrictMapping();
};

export const distributeProducts = (
  customers: Customer[],
  products: Product[],
  method: DistributionMethod,
  templateWorkbook?: ExcelJS.Workbook
): OrderRow[] => {
  const orders: OrderRow[] = [];
  let customerIndex = 0;

  let cities: string[] = [];
  let cityDistrictMapping = new Map<string, string[]>();

  if (templateWorkbook) {
    cities = extractDropdownValues(templateWorkbook, 'Tỉnh/Thành Phố');
    cityDistrictMapping = extractCityDistrictMapping(templateWorkbook);
  }

  // If no cities found, use defaults
  if (cities.length === 0) {
    cities = Array.from(getDefaultCityDistrictMapping().keys());
    cityDistrictMapping = getDefaultCityDistrictMapping();
    console.log('[distributeProducts] Using default city/district data');
  }

  for (const product of products) {
    let remainingQuantity = product.quantity;

    while (remainingQuantity > 0) {
      const customer = customers[customerIndex % customers.length];
      const quantityToAssign = Math.min(remainingQuantity, Math.floor(Math.random() * 2) + 1);

      const city = cities.length > 0 ? cities[Math.floor(Math.random() * cities.length)] : '';

      let district = '';
      if (city && cityDistrictMapping.has(city)) {
        const districts = cityDistrictMapping.get(city)!;
        if (districts.length > 0) {
          district = districts[Math.floor(Math.random() * districts.length)];
        }
      }

      const order: OrderRow = {
        'Kho hàng': '',
        'Họ Tên': customer.name,
        'Điện thoại': customer.phone,
        'Địa Chỉ': '',
        'Tỉnh/Thành Phố': city,
        'Quận/Huyện': district,
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

  const rowCount = worksheet.rowCount;
  for (let i = rowCount; i > 1; i--) {
    worksheet.spliceRows(i, 1);
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.value?.toString() || '';
  });

  orders.forEach((order) => {
    const row = worksheet.addRow([]);
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      const value = order[header as keyof OrderRow];

      if (value === undefined || value === null) {
        cell.value = '';
      } else if (typeof value === 'string') {
        cell.value = value;
      } else if (typeof value === 'number') {
        cell.value = value;
      } else {
        cell.value = String(value);
      }
    });
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  const buffer = await templateWorkbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};
