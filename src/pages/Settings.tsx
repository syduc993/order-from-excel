import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Save, Eye, EyeOff, Plus, Trash2, Loader2, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { NhanhApiClient } from '@/services/nhanhApi';
import type { SettingKey, TimeSlotConfig } from '@/types/settings';

const Settings = () => {
  const { settings, updateSettings, isLoading } = useSettings();
  const { user } = useAuth();
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Local form states (initialized from settings)
  const [apiConfig, setApiConfig] = useState(settings.apiConfig);
  const [orderRules, setOrderRules] = useState(settings.orderRules);
  const [timeDistribution, setTimeDistribution] = useState(settings.timeDistribution);
  const [excelConfig, setExcelConfig] = useState(settings.excelConfig);

  const handleSave = async (key: SettingKey, value: any, label: string) => {
    setIsSaving(key);
    try {
      await updateSettings(key, value, user?.email);
      toast.success(`Đã lưu ${label}`);
    } catch (error) {
      toast.error(`Lỗi lưu ${label}: ${(error as Error).message}`);
    } finally {
      setIsSaving(null);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      if (!apiConfig.nhanhAppId || !apiConfig.nhanhBusinessId || !apiConfig.nhanhAccessToken) {
        toast.error('Vui lòng nhập đầy đủ thông tin API');
        return;
      }
      const client = new NhanhApiClient({
        appId: apiConfig.nhanhAppId,
        businessId: apiConfig.nhanhBusinessId,
        accessToken: apiConfig.nhanhAccessToken,
      });
      await client.checkProductInventory([1], apiConfig.depotId);
      toast.success('Kết nối Nhanh.vn thành công!');
    } catch (error) {
      toast.error(`Kết nối thất bại: ${(error as Error).message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const addTimeSlot = () => {
    const slots = [...timeDistribution.timeSlots];
    const lastSlot = slots[slots.length - 1];
    slots.push({ start: lastSlot?.end || 8, end: (lastSlot?.end || 8) + 2, weight: 1 });
    setTimeDistribution({ ...timeDistribution, timeSlots: slots });
  };

  const removeTimeSlot = (index: number) => {
    const slots = timeDistribution.timeSlots.filter((_, i) => i !== index);
    setTimeDistribution({ ...timeDistribution, timeSlots: slots });
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlotConfig, value: number) => {
    const slots = [...timeDistribution.timeSlots];
    slots[index] = { ...slots[index], [field]: value };
    setTimeDistribution({ ...timeDistribution, timeSlots: slots });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          Cài Đặt
        </h1>
        <p className="text-muted-foreground">
          Cấu hình hệ thống tạo đơn hàng tự động
        </p>
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api">API & Kết nối</TabsTrigger>
          <TabsTrigger value="order">Quy tắc tạo đơn</TabsTrigger>
          <TabsTrigger value="time">Phân bổ thời gian</TabsTrigger>
          <TabsTrigger value="excel">Cấu hình Excel</TabsTrigger>
        </TabsList>

        {/* Tab 1: API & Connection */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API & Kết nối</CardTitle>
              <CardDescription>Cấu hình kết nối Nhanh.vn và kho hàng</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Depot ID (Mã kho hàng)</Label>
                <Input
                  type="number"
                  value={apiConfig.depotId}
                  onChange={(e) => setApiConfig({ ...apiConfig, depotId: Number(e.target.value) })}
                  placeholder="215639"
                />
              </div>

              <div className="space-y-2">
                <Label>Nhanh.vn App ID</Label>
                <Input
                  value={apiConfig.nhanhAppId}
                  onChange={(e) => setApiConfig({ ...apiConfig, nhanhAppId: e.target.value })}
                  placeholder="76531"
                />
              </div>

              <div className="space-y-2">
                <Label>Nhanh.vn Business ID</Label>
                <Input
                  value={apiConfig.nhanhBusinessId}
                  onChange={(e) => setApiConfig({ ...apiConfig, nhanhBusinessId: e.target.value })}
                  placeholder="209189"
                />
              </div>

              <div className="space-y-2">
                <Label>Nhanh.vn Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={apiConfig.nhanhAccessToken}
                    onChange={(e) => setApiConfig({ ...apiConfig, nhanhAccessToken: e.target.value })}
                    placeholder="Access token..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                >
                  {isTestingConnection ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="mr-2 h-4 w-4" />
                  )}
                  Kiểm tra kết nối
                </Button>
                <Button
                  onClick={() => handleSave('api_config', apiConfig, 'cấu hình API')}
                  disabled={isSaving === 'api_config'}
                >
                  {isSaving === 'api_config' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Lưu
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Order Rules */}
        <TabsContent value="order">
          <Card>
            <CardHeader>
              <CardTitle>Quy tắc tạo đơn</CardTitle>
              <CardDescription>Cấu hình giá trị, số lượng sản phẩm cho mỗi đơn hàng</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giá trị đơn tối thiểu (VNĐ)</Label>
                  <Input
                    type="number"
                    value={orderRules.minTotalAmount}
                    onChange={(e) => setOrderRules({ ...orderRules, minTotalAmount: Number(e.target.value) })}
                    placeholder="300000"
                  />
                  <p className="text-xs text-muted-foreground">Mặc định: 300,000</p>
                </div>
                <div className="space-y-2">
                  <Label>Giá trị đơn tối đa (VNĐ)</Label>
                  <Input
                    type="number"
                    value={orderRules.maxTotalAmount}
                    onChange={(e) => setOrderRules({ ...orderRules, maxTotalAmount: Number(e.target.value) })}
                    placeholder="2000000"
                  />
                  <p className="text-xs text-muted-foreground">Mặc định: 2,000,000</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số sản phẩm/đơn tối thiểu</Label>
                  <Input
                    type="number"
                    value={orderRules.minProductsPerOrder}
                    onChange={(e) => setOrderRules({ ...orderRules, minProductsPerOrder: Number(e.target.value) })}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số sản phẩm/đơn tối đa</Label>
                  <Input
                    type="number"
                    value={orderRules.maxProductsPerOrder}
                    onChange={(e) => setOrderRules({ ...orderRules, maxProductsPerOrder: Number(e.target.value) })}
                    min={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số lượng/sản phẩm tối thiểu</Label>
                  <Input
                    type="number"
                    value={orderRules.minQuantityPerProduct}
                    onChange={(e) => setOrderRules({ ...orderRules, minQuantityPerProduct: Number(e.target.value) })}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số lượng/sản phẩm tối đa</Label>
                  <Input
                    type="number"
                    value={orderRules.maxQuantityPerProduct}
                    onChange={(e) => setOrderRules({ ...orderRules, maxQuantityPerProduct: Number(e.target.value) })}
                    min={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giá trị đơn vét tối đa (VNĐ)</Label>
                  <Input
                    type="number"
                    value={orderRules.sweepMaxValue}
                    onChange={(e) => setOrderRules({ ...orderRules, sweepMaxValue: Number(e.target.value) })}
                    placeholder="200000"
                  />
                  <p className="text-xs text-muted-foreground">Ngưỡng gom sản phẩm còn lại thành đơn vét</p>
                </div>
                <div className="space-y-2">
                  <Label>Max lần thử liên tiếp</Label>
                  <Input
                    type="number"
                    value={orderRules.maxConsecutiveFails}
                    onChange={(e) => setOrderRules({ ...orderRules, maxConsecutiveFails: Number(e.target.value) })}
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">Chuyển flexible mode sau N lần thất bại</p>
                </div>
              </div>

              <Button
                onClick={() => handleSave('order_rules', orderRules, 'quy tắc tạo đơn')}
                disabled={isSaving === 'order_rules'}
                className="mt-2"
              >
                {isSaving === 'order_rules' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Lưu
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Time Distribution */}
        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle>Phân bổ thời gian</CardTitle>
              <CardDescription>Cấu hình khung giờ và trọng số phân bổ đơn hàng</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Time Slots Table */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Khung giờ hoạt động</Label>
                <div className="rounded-md border">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3 bg-muted/50 text-sm font-medium">
                    <div>Giờ bắt đầu</div>
                    <div>Giờ kết thúc</div>
                    <div>Trọng số</div>
                    <div className="w-9"></div>
                  </div>
                  {timeDistribution.timeSlots.map((slot, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3 border-t items-center">
                      <Input
                        type="number"
                        step="0.25"
                        value={slot.start}
                        onChange={(e) => updateTimeSlot(index, 'start', Number(e.target.value))}
                      />
                      <Input
                        type="number"
                        step="0.25"
                        value={slot.end}
                        onChange={(e) => updateTimeSlot(index, 'end', Number(e.target.value))}
                      />
                      <Input
                        type="number"
                        step="0.1"
                        value={slot.weight}
                        onChange={(e) => updateTimeSlot(index, 'weight', Number(e.target.value))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTimeSlot(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addTimeSlot}>
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm khung giờ
                </Button>
                <p className="text-xs text-muted-foreground">
                  Trọng số cao = nhiều đơn hơn. Ví dụ: 3 = cao điểm, 0.3 = rất thấp, 1 = bình thường.
                  Giờ dạng decimal: 8.5 = 8h30, 21.5 = 21h30, 22.75 = 22h45
                </p>
              </div>

              {/* Weekend & Late Orders */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hệ số cuối tuần</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={timeDistribution.weekendBoost}
                    onChange={(e) => setTimeDistribution({ ...timeDistribution, weekendBoost: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">1.8 = cuối tuần tăng 80% đơn</p>
                </div>
                <div className="space-y-2">
                  <Label>% ngày có đơn muộn</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={timeDistribution.lateOrderPercent}
                    onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderPercent: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">0.25 = 25% số ngày</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số đơn muộn min / max</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={timeDistribution.lateOrderMinCount}
                      onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderMinCount: Number(e.target.value) })}
                      min={0}
                    />
                    <Input
                      type="number"
                      value={timeDistribution.lateOrderMaxCount}
                      onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderMaxCount: Number(e.target.value) })}
                      min={1}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Khung giờ đơn muộn</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.25"
                      value={timeDistribution.lateOrderTimeStart}
                      onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderTimeStart: Number(e.target.value) })}
                      placeholder="22.77"
                    />
                    <Input
                      type="number"
                      step="0.25"
                      value={timeDistribution.lateOrderTimeEnd}
                      onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderTimeEnd: Number(e.target.value) })}
                      placeholder="23.5"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">22.77 = 22h46, 23.5 = 23h30</p>
                </div>
              </div>

              <Button
                onClick={() => handleSave('time_distribution', timeDistribution, 'phân bổ thời gian')}
                disabled={isSaving === 'time_distribution'}
              >
                {isSaving === 'time_distribution' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Lưu
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Excel Config */}
        <TabsContent value="excel">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình Excel</CardTitle>
              <CardDescription>Tên các sheet trong file Excel upload</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tên sheet Khách hàng</Label>
                <Input
                  value={excelConfig.customerSheetName}
                  onChange={(e) => setExcelConfig({ ...excelConfig, customerSheetName: e.target.value })}
                  placeholder="DSKH"
                />
              </div>

              <div className="space-y-2">
                <Label>Tên sheet Sản phẩm</Label>
                <Input
                  value={excelConfig.productSheetName}
                  onChange={(e) => setExcelConfig({ ...excelConfig, productSheetName: e.target.value })}
                  placeholder="DSSP"
                />
              </div>

              <div className="space-y-2">
                <Label>Tên sheet Template</Label>
                <Input
                  value={excelConfig.templateSheetName}
                  onChange={(e) => setExcelConfig({ ...excelConfig, templateSheetName: e.target.value })}
                  placeholder="template"
                />
              </div>

              <Button
                onClick={() => handleSave('excel_config', excelConfig, 'cấu hình Excel')}
                disabled={isSaving === 'excel_config'}
                className="mt-2"
              >
                {isSaving === 'excel_config' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Lưu
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
