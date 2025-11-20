import { useState } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import {
  parseCustomerFile,
  parseProductFile,
  validateTemplate,
  distributeProducts,
  generateOutputFile,
} from '@/utils/excelProcessor';
import { Customer, Product, DistributionMethod } from '@/types/excel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Index = () => {
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('random');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const handleCustomerFileUpload = async (file: File) => {
    try {
      const parsedCustomers = await parseCustomerFile(file);
      setCustomers(parsedCustomers);
      setCustomerFile(file);
      toast.success(`Đã tải ${parsedCustomers.length} khách hàng`);
    } catch (error) {
      toast.error(`Lỗi: ${(error as Error).message}`);
    }
  };

  const handleProductFileUpload = async (file: File) => {
    try {
      const parsedProducts = await parseProductFile(file);
      setProducts(parsedProducts);
      setProductFile(file);
      toast.success(`Đã tải ${parsedProducts.length} sản phẩm`);
    } catch (error) {
      toast.error(`Lỗi: ${(error as Error).message}`);
    }
  };

  const handleTemplateFileUpload = async (file: File) => {
    try {
      await validateTemplate(file);
      setTemplateFile(file);
      toast.success('File template hợp lệ');
    } catch (error) {
      toast.error(`Lỗi: ${(error as Error).message}`);
    }
  };

  const handleProcess = async () => {
    if (!customerFile || !productFile || !templateFile) {
      toast.error('Vui lòng tải đầy đủ 3 file');
      return;
    }

    setIsProcessing(true);
    try {
      const templateWorkbook = await validateTemplate(templateFile);
      const orders = distributeProducts(customers, products, distributionMethod);
      const outputBlob = await generateOutputFile(templateWorkbook, orders);

      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Don_Hang_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Đã tạo ${orders.length} đơn hàng thành công`);
    } catch (error) {
      toast.error(`Lỗi xử lý: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-accent py-12 px-4 shadow-lg">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-4 mb-4">
            <FileSpreadsheet className="w-12 h-12 text-primary-foreground" />
            <h1 className="text-4xl font-bold text-primary-foreground">
              Ứng Dụng Trộn Dữ Liệu Excel
            </h1>
          </div>
          <p className="text-primary-foreground/90 text-lg">
            Tự động tạo đơn hàng từ danh sách khách hàng và sản phẩm
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-6xl py-8 px-4">
        {/* Statistics Cards */}
        {(customers.length > 0 || products.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card className="shadow-lg border-l-4 border-l-accent">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Khách Hàng</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-accent">{customers.length}</p>
                <p className="text-sm text-muted-foreground mt-1">khách hàng đã tải</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Sản Phẩm</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{products.length}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {products.reduce((sum, p) => sum + p.quantity, 0)} sản phẩm cần phân phối
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upload Section */}
        <Card className="shadow-xl mb-8">
          <CardHeader>
            <CardTitle>Tải File Dữ Liệu</CardTitle>
            <CardDescription>Tải 3 file Excel theo thứ tự bên dưới</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileUploadZone
              label="1. File Danh Sách Khách Hàng"
              description="Sheet 'DSKH' với 3 cột: ID, Tên khách hàng, Số điện thoại"
              onFileUpload={handleCustomerFileUpload}
              uploadedFile={customerFile}
            />
            <FileUploadZone
              label="2. File Danh Sách Sản Phẩm"
              description="Sheet 'DSSP' với 4 cột: Mã hàng, Tên hàng, Số lượng bán lẻ, Giá bán lẻ (Có VAT)"
              onFileUpload={handleProductFileUpload}
              uploadedFile={productFile}
            />
            <FileUploadZone
              label="3. File Template"
              description="Sheet 'template' với đầy đủ 31 cột theo đúng thứ tự"
              onFileUpload={handleTemplateFileUpload}
              uploadedFile={templateFile}
            />
          </CardContent>
        </Card>

        {/* Distribution Method */}
        <Card className="shadow-xl mb-8">
          <CardHeader>
            <CardTitle>Phương Pháp Phân Phối</CardTitle>
            <CardDescription>Chọn cách phân phối sản phẩm cho khách hàng</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={distributionMethod}
              onValueChange={(value) => setDistributionMethod(value as DistributionMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Ngẫu nhiên</SelectItem>
                <SelectItem value="sequential">Tuần tự</SelectItem>
                <SelectItem value="even">Đều đặn</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              {distributionMethod === 'random' && 'Phân phối sản phẩm ngẫu nhiên cho các khách hàng'}
              {distributionMethod === 'sequential' && 'Phân phối sản phẩm theo thứ tự khách hàng'}
              {distributionMethod === 'even' && 'Phân phối đều sản phẩm cho tất cả khách hàng'}
            </p>
          </CardContent>
        </Card>

        {/* Process Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleProcess}
            disabled={!customerFile || !productFile || !templateFile || isProcessing}
            className="shadow-lg hover:shadow-xl transition-all text-lg px-8 py-6"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Tạo File Đơn Hàng
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
