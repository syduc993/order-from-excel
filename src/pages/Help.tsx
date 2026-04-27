import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Calculator } from 'lucide-react';

const Help = () => {
    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Hướng Dẫn Sử Dụng</h1>
                <p className="text-muted-foreground">Tài liệu hướng dẫn chi tiết cho hệ thống Tạo Đơn Hàng Tự Động</p>
            </div>

            <Tabs defaultValue="start">
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="start">Bắt đầu</TabsTrigger>
                    <TabsTrigger value="create">Tạo đơn</TabsTrigger>
                    <TabsTrigger value="manage">Quản lý</TabsTrigger>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="faq">FAQ</TabsTrigger>
                    <TabsTrigger value="algorithm" className="flex items-center gap-1">
                        <Calculator className="h-4 w-4" />
                        Thuật toán
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bắt Đầu Nhanh</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed">
                            <h3 className="font-semibold text-base">Quy trình tổng quan</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">1. Upload Excel</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">2. Tạo đơn nháp</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">3. Review & Duyệt</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">4. Tự động xử lý</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">5. Hoàn thành</span>
                            </div>

                            <h3 className="font-semibold text-base mt-6">Chuẩn bị file Excel</h3>
                            <p>Bạn cần 2 file Excel (hoặc 1 file có 2 sheet):</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 border rounded-lg">
                                    <p className="font-medium">Sheet "DSKH" - Danh sách khách hàng</p>
                                    <p className="text-muted-foreground mt-1">Cột bắt buộc: ID, Tên, Điện thoại</p>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <p className="font-medium">Sheet "DSSP" - Danh sách sản phẩm</p>
                                    <p className="text-muted-foreground mt-1">Cột bắt buộc: ID, Tên hàng, Số lượng, Giá</p>
                                </div>
                            </div>

                            <h3 className="font-semibold text-base mt-6">Trạng thái đơn hàng</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium text-purple-600 bg-purple-50 w-24 text-center">Nháp</span>
                                    <span>Đơn vừa tạo, chưa được duyệt. Bạn có thể review, sửa, xóa.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium text-yellow-600 bg-yellow-50 w-24 text-center">Đang chờ</span>
                                    <span>Đã duyệt, đang chờ đến giờ để hệ thống tự động xử lý.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50 w-24 text-center">Đang xử lý</span>
                                    <span>Hệ thống đang gửi đơn lên NhanhVN.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-50 w-24 text-center">Thành công</span>
                                    <span>Đơn đã được tạo thành công trên NhanhVN.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium text-red-600 bg-red-50 w-24 text-center">Lỗi</span>
                                    <span>Gửi đơn thất bại. Có thể bấm "Thử lại" để gửi lại.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-50 w-24 text-center">Đã hủy</span>
                                    <span>Đơn đã bị hủy bởi người dùng.</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="create">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tạo Đơn Hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed">
                            <h3 className="font-semibold text-base">Cách 1: Upload Excel (hàng loạt)</h3>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                                <li>Upload file khách hàng (kéo thả hoặc click vào vùng upload)</li>
                                <li>Upload file sản phẩm - hệ thống sẽ tự kiểm tra tồn kho với NhanhVN</li>
                                <li>Chọn khoảng ngày bắt đầu - kết thúc để phân bổ đơn</li>
                                <li>Bấm <strong>"Tạo Đơn Nháp"</strong> - hệ thống tự tính số đơn dựa trên sản phẩm</li>
                                <li>Review danh sách đơn nháp bên dưới</li>
                                <li>Bấm <strong>"Duyệt tất cả"</strong> hoặc chọn từng đơn rồi bấm <strong>"Duyệt đã chọn"</strong></li>
                            </ol>

                            <h3 className="font-semibold text-base mt-6">Cách 2: Tạo đơn thủ công</h3>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                                <li>Bấm nút <strong>"Tạo đơn thủ công"</strong> (cần chọn batch trước)</li>
                                <li>Nhập thông tin khách hàng: tên, SĐT</li>
                                <li>Thêm sản phẩm: ID, số lượng, giá</li>
                                <li>Chọn ngày giờ giao hàng</li>
                                <li>Bấm <strong>"Tạo đơn nháp"</strong></li>
                            </ol>

                            <h3 className="font-semibold text-base mt-6">Kiểm tra tồn kho</h3>
                            <p>Khi upload sản phẩm, hệ thống tự kiểm tra tồn kho với NhanhVN. Bạn có 2 lựa chọn:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li><strong>Sử dụng số lượng Excel:</strong> Giữ nguyên số lượng trong file</li>
                                <li><strong>Sử dụng tồn kho thực tế:</strong> Điều chỉnh theo kho NhanhVN</li>
                            </ul>

                            <h3 className="font-semibold text-base mt-6">Điều chỉnh đơn hàng</h3>
                            <p>Mục "Điều chỉnh Đơn Hàng" cho phép:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Chọn batch cần điều chỉnh</li>
                                <li>Hủy các đơn pending/draft từ 1 ngày cụ thể</li>
                                <li>Tạo lại đơn mới với tồn kho cập nhật</li>
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="manage">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quản Lý Đơn Hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed">
                            <h3 className="font-semibold text-base">Xem chi tiết đơn</h3>
                            <p>Click vào bất kỳ đơn nào trong danh sách để xem chi tiết bao gồm: khách hàng, sản phẩm, giá, thời gian, trạng thái.</p>

                            <h3 className="font-semibold text-base mt-6">Hủy đơn</h3>
                            <p>Chỉ có thể hủy đơn ở trạng thái <strong>Nháp</strong> hoặc <strong>Đang chờ</strong>. Click menu "..." → "Hủy đơn".</p>

                            <h3 className="font-semibold text-base mt-6">Thử lại đơn lỗi</h3>
                            <p>Đơn ở trạng thái <strong>Lỗi</strong> có thể thử gửi lại. Click menu "..." → "Thử lại".</p>

                            <h3 className="font-semibold text-base mt-6">Tìm kiếm & Lọc</h3>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li><strong>Tìm kiếm:</strong> Nhập tên hoặc SĐT khách hàng</li>
                                <li><strong>Lọc trạng thái:</strong> Click vào badge trạng thái để bật/tắt</li>
                                <li><strong>Lọc theo ngày:</strong> Chọn khoảng ngày "Từ" - "Đến"</li>
                            </ul>

                            <h3 className="font-semibold text-base mt-6">Xuất Excel</h3>
                            <p>Bấm nút <strong>"Xuất Excel"</strong> phía trên danh sách đơn để download file Excel chứa toàn bộ đơn hàng của batch hiện tại.</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="dashboard">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dashboard & Thống Kê</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed">
                            <h3 className="font-semibold text-base">Cách sử dụng</h3>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                                <li>Nhập Batch ID (hoặc để trống để xem tất cả)</li>
                                <li>Chọn khoảng ngày cần xem</li>
                                <li>Tick chọn các trạng thái muốn xem</li>
                                <li>Bấm "Áp Dụng Bộ Lọc"</li>
                            </ol>

                            <h3 className="font-semibold text-base mt-6">Các biểu đồ</h3>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li><strong>Tổng quan trạng thái:</strong> Tỷ lệ đơn theo từng trạng thái</li>
                                <li><strong>Doanh số theo ngày:</strong> So sánh tổng vs hoàn thành theo ngày</li>
                                <li><strong>Phân bố theo giờ:</strong> Số đơn phân bổ ở mỗi khung giờ</li>
                                <li><strong>Sản phẩm theo ngày:</strong> Số lượng sản phẩm bán ra mỗi ngày</li>
                                <li><strong>Bảng chi tiết:</strong> Thống kê doanh số + sản phẩm theo từng ngày</li>
                            </ul>

                            <h3 className="font-semibold text-base mt-6">Xuất báo cáo</h3>
                            <p>Bấm <strong>"Xuất Báo Cáo"</strong> để download file Excel với dữ liệu dashboard.</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="faq">
                    <Card>
                        <CardHeader>
                            <CardTitle>Câu Hỏi Thường Gặp</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="q1">
                                    <AccordionTrigger>Tại sao đơn ở trạng thái "Nháp" mà không được xử lý?</AccordionTrigger>
                                    <AccordionContent>
                                        Đơn nháp cần được duyệt trước khi hệ thống xử lý. Vào danh sách đơn hàng, bấm "Duyệt tất cả" hoặc chọn từng đơn rồi bấm "Duyệt đã chọn".
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="q2">
                                    <AccordionTrigger>Đơn bị lỗi thì phải làm sao?</AccordionTrigger>
                                    <AccordionContent>
                                        Click vào đơn bị lỗi để xem chi tiết lỗi. Sau đó bấm menu "..." → "Thử lại" để gửi lại đơn. Nếu lỗi liên tục, kiểm tra kết nối API trong phần Cài đặt.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="q3">
                                    <AccordionTrigger>Làm sao để hủy nhiều đơn cùng lúc?</AccordionTrigger>
                                    <AccordionContent>
                                        Sử dụng tính năng "Điều chỉnh Đơn Hàng" để hủy tất cả đơn pending/draft từ 1 ngày cụ thể. Hoặc hủy từng đơn bằng menu "..." → "Hủy đơn".
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="q4">
                                    <AccordionTrigger>Hệ thống tự động xử lý đơn khi nào?</AccordionTrigger>
                                    <AccordionContent>
                                        Cloud Run chạy mỗi phút, tìm các đơn có status="pending" và scheduled_time đã đến. Đơn sẽ tự động được gửi lên NhanhVN theo lịch trình đã phân bổ.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="q5">
                                    <AccordionTrigger>File Excel cần format như thế nào?</AccordionTrigger>
                                    <AccordionContent>
                                        <p className="mb-2">File khách hàng (sheet "DSKH"):</p>
                                        <p className="text-muted-foreground mb-3">Cột: ID | Tên | Điện thoại</p>
                                        <p className="mb-2">File sản phẩm (sheet "DSSP"):</p>
                                        <p className="text-muted-foreground">Cột: ID | Tên hàng | Số lượng | Giá</p>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="q6">
                                    <AccordionTrigger>Ai có quyền duyệt đơn và thay đổi cài đặt?</AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li><strong>Quyền xem:</strong> Xem danh sách đơn, dashboard, xuất Excel</li>
                                            <li><strong>Quyền tạo:</strong> Upload Excel, tạo đơn, duyệt, hủy, thử lại</li>
                                            <li><strong>Quyền quản lý:</strong> Thay đổi cài đặt API, quy tắc tạo đơn, xem nhật ký</li>
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="algorithm">
                    <Card>
                        <CardHeader>
                            <CardTitle>Thuật Toán Tạo Đơn Hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed">
                            <h3 className="font-semibold text-base">Quy trình tổng quan</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">1. Upload</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">2. Tính tổng đơn</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">3. Tạo đơn chính</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">4. Đơn vét</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">5. Phân bổ ngày</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">6. Phân bổ giờ</span>
                            </div>

                            <Accordion type="single" collapsible className="w-full mt-4">
                                <AccordionItem value="algo1">
                                    <AccordionTrigger>1. Tính tổng số đơn</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Hệ thống tính số đơn cần tạo dựa trên tổng giá trị sản phẩm và giá trị trung bình mỗi đơn:</p>
                                        <div className="p-3 bg-muted rounded-lg font-mono text-xs">
                                            <p>avgOrderValue = min + ratio × (max − min)</p>
                                            <p>totalOrders = totalValue / avgOrderValue</p>
                                        </div>
                                        <p>Tham số <code>ratio</code> (mặc định 0.286) bù cho thuật toán sinh đơn theo phân phối lệch trái (skew=2.5, log-normal-like): đa số đơn giá trị nhỏ, đuôi dài lên cao, nên trung bình thực tế nằm gần min. Quan hệ lý tưởng: <code>ratio = 1/(skew+1)</code>.</p>
                                        <p>Ví dụ: Tổng giá trị 100 triệu, min 500K, max 1.5 triệu, ratio 0.286 → avgOrderValue ≈ 786K → ~127 đơn.</p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="algo2">
                                    <AccordionTrigger>2. Phân khúc giá sản phẩm</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Sản phẩm được chia thành 3 nhóm theo giá để tạo đơn hàng đa dạng:</p>
                                        <div className="space-y-1 ml-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium w-28 text-center">Giá thấp (60%)</span>
                                                <span>Sản phẩm có giá nằm trong 1/3 thấp nhất</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium w-28 text-center">Trung bình (30%)</span>
                                                <span>Sản phẩm có giá nằm trong 1/3 giữa</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium w-28 text-center">Giá cao (10%)</span>
                                                <span>Sản phẩm có giá nằm trong 1/3 cao nhất</span>
                                            </div>
                                        </div>
                                        <p>Xác suất chọn sản phẩm theo tỷ lệ này giúp đơn hàng có cấu trúc tự nhiên -- phần lớn là hàng giá thấp, ít hàng giá cao.</p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="algo3">
                                    <AccordionTrigger>3. Tạo đơn chính</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Quy trình tạo từng đơn hàng:</p>
                                        <ol className="list-decimal list-inside space-y-1 ml-2">
                                            <li>Chọn ngẫu nhiên một khách hàng từ danh sách</li>
                                            <li>Chọn sản phẩm theo phân khúc giá (60/30/10)</li>
                                            <li>Random số lượng trong khoảng min-max cho mỗi sản phẩm</li>
                                            <li>Tính tổng giá trị đơn hàng</li>
                                            <li>Nếu tổng nằm trong khoảng [minOrderValue, maxOrderValue] → tạo đơn thành công</li>
                                            <li>Nếu không hợp lệ → +1 fail counter, thử lại với tổ hợp SP khác</li>
                                        </ol>
                                        <p className="text-muted-foreground">Quá trình lặp cho đến khi tạo đủ số đơn hoặc hết tồn kho.</p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="algo4">
                                    <AccordionTrigger>4. Chế độ linh hoạt (Flexible Mode)</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Khi thuật toán gặp khó khăn trong việc ghép đơn (ví dụ: SP còn lại toàn giá cao hoặc giá thấp), chế độ linh hoạt sẽ được kích hoạt:</p>
                                        <div className="p-3 bg-muted rounded-lg space-y-1 text-xs">
                                            <p><strong>Điều kiện kích hoạt:</strong> Sau maxConsecutiveFails lần thất bại liên tiếp</p>
                                            <p><strong>Min giá trị đơn:</strong> chia 3 (giảm xuống 1/3)</p>
                                            <p><strong>Max giá trị đơn:</strong> nhân 1.5 (tăng 50%)</p>
                                            <p><strong>Max số SP/đơn:</strong> +3 sản phẩm</p>
                                            <p><strong>Max số lượng/SP:</strong> +2 đơn vị</p>
                                        </div>
                                        <p>Chế độ này giúp tiêu thụ hết tồn kho khi các sản phẩm còn lại khó ghép thành đơn hợp lệ với ràng buộc ban đầu.</p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="algo5">
                                    <AccordionTrigger>5. Đơn vét (Sweep Orders)</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Sau khi tạo xong đơn chính, sản phẩm tồn dư (còn lại trong kho) sẽ được gom thành đơn vét:</p>
                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li>Mỗi đơn vét có giá trị tối đa = <strong>sweepMaxValue</strong></li>
                                            <li>Gom tất cả SP còn tồn vào các đơn vét cho đến khi hết</li>
                                            <li>Đơn vét được <strong>rải đều vào tất cả các ngày</strong> trong khoảng, cuối tuần nhận nhiều hơn (nhân hệ số weekendBoost)</li>
                                            <li>Khung giờ: random theo weight của tất cả khung giờ (không chỉ giờ cao điểm)</li>
                                        </ul>
                                        <div className="p-3 bg-muted rounded-lg space-y-1 text-xs">
                                            <p><strong>Tại sao đơn vét thường có giá trị thấp?</strong></p>
                                            <p>Thuật toán đơn chính ưu tiên tiêu thụ sản phẩm giá cao trước (vì chúng dễ đạt ngưỡng min-max). Sản phẩm còn sót lại thường là hàng giá thấp, số lượng ít &mdash; không đủ ghép thành đơn hợp lệ.</p>
                                        </div>
                                        <p className="text-muted-foreground">Mục đích: đảm bảo toàn bộ sản phẩm được tiêu thụ hết, không bỏ sót tồn kho.</p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="algo6">
                                    <AccordionTrigger>6. Phân bổ theo ngày</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Tổng số đơn được chia đều cho các ngày trong khoảng thời gian, có tính hệ số cuối tuần:</p>
                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li>Ngày thường: hệ số = 1.0</li>
                                            <li>Thứ 7, Chủ nhật: hệ số = <strong>weekendBoost</strong> (mặc định 1.8)</li>
                                        </ul>
                                        <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                                            <p><strong>Ví dụ:</strong> 100 đơn / 7 ngày, weekendBoost = 1.8</p>
                                            <p>Tổng trọng số = 5 x 1.0 + 2 x 1.8 = 8.6</p>
                                            <p>Ngày thường: 100 / 8.6 x 1.0 &asymp; 12 đơn/ngày</p>
                                            <p>T7 / CN: 100 / 8.6 x 1.8 &asymp; 21 đơn/ngày</p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="algo7">
                                    <AccordionTrigger>7. Phân bổ theo giờ</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Mỗi khung giờ trong ngày có một trọng số (weight) riêng. Đơn hàng được phân bổ tỷ lệ với trọng số:</p>
                                        <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                                            <p><strong>Khung giờ mặc định (thay đổi được trong Cài đặt):</strong></p>
                                            <p>8h30-10h: weight = 1.0 (buổi sáng)</p>
                                            <p>10h-12h: weight = 3.0 <strong>(cao điểm)</strong></p>
                                            <p>12h-14h: weight = 0.3 (giờ nghỉ trưa - rất ít đơn)</p>
                                            <p>14h-16h: weight = 1.0</p>
                                            <p>16h-18h: weight = 3.0 <strong>(cao điểm)</strong></p>
                                            <p>18h-20h: weight = 1.0</p>
                                            <p>20h-21h30: weight = 3.0 <strong>(cao điểm)</strong></p>
                                            <p>21h30-22h45: weight = 0.8 (giảm dần)</p>
                                        </div>
                                        <p>Khung giờ có weight cao hơn sẽ nhận nhiều đơn hơn. Ví dụ: 10h-12h (weight 3.0) sẽ có gấp 10 lần đơn so với 12h-14h (weight 0.3). Đơn vét cũng chỉ được đặt vào các khung giờ cao điểm (weight &ge; 3.0).</p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="algo8">
                                    <AccordionTrigger>8. Đơn muộn (Late-night Orders)</AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-sm">
                                        <p>Để tạo pattern mua hàng tự nhiên, hệ thống sẽ tạo đơn muộn cho một số ngày:</p>
                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li><strong>25% số ngày</strong> (mặc định) sẽ có đơn muộn</li>
                                            <li>Mỗi ngày có đơn muộn sẽ có <strong>1-2 đơn</strong></li>
                                            <li>Khung giờ: <strong>22h46 - 23h30</strong></li>
                                        </ul>
                                        <p className="text-muted-foreground">Mục đích: mô phỏng hành vi mua hàng thực tế -- một số khách hàng đặt hàng vào đêm khuya, tạo ra dữ liệu tự nhiên hơn.</p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Help;
