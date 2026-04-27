import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Save, Eye, EyeOff, Plus, Trash2, Loader2, Wifi, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { NhanhApiClient } from '@/services/nhanhApi';
import type { SettingKey, TimeSlotConfig, DepotProfile } from '@/types/settings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Settings = () => {
  const { settings, updateSettings, isLoading } = useSettings();
  const { user } = useAuth();
  const [showTokenFor, setShowTokenFor] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState<string | null>(null);

  const [apiConfig, setApiConfig] = useState(settings.apiConfig);
  const [orderRules, setOrderRules] = useState(settings.orderRules);
  const [timeDistribution, setTimeDistribution] = useState(settings.timeDistribution);
  const [excelConfig, setExcelConfig] = useState(settings.excelConfig);

  // Sync local state when settings reload from Supabase
  useEffect(() => {
    setApiConfig(settings.apiConfig);
    setOrderRules(settings.orderRules);
    setTimeDistribution(settings.timeDistribution);
    setExcelConfig(settings.excelConfig);
  }, [settings]);

  const handleSave = async (key: SettingKey, value: any, label: string) => {
    // Validate depot profiles before saving
    if (key === 'api_config') {
      const cfg = value as typeof apiConfig;
      for (const p of cfg.depotProfiles) {
        if (!p.name.trim()) {
          toast.error('Tên kho không được để trống. Vui lòng đặt tên cho tất cả kho.');
          return;
        }
        if (!p.depotId || p.depotId <= 0) {
          toast.error(`Depot ID của "${p.name}" phải là số nguyên dương.`);
          return;
        }
      }
    }
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

  const handleTestConnection = async (profile: DepotProfile) => {
    setIsTestingConnection(profile.id);
    try {
      if (!profile.depotId || profile.depotId <= 0) {
        toast.error(`Depot ID của "${profile.name || '(chưa đặt tên)'}" phải là số nguyên dương.`);
        return;
      }
      if (!profile.nhanhAppId || !profile.nhanhBusinessId || !profile.nhanhAccessToken) {
        toast.error(`Vui lòng nhập đầy đủ thông tin API cho "${profile.name || '(chưa đặt tên)'}"`);
        return;
      }
      const client = new NhanhApiClient({
        appId: profile.nhanhAppId,
        businessId: profile.nhanhBusinessId,
        accessToken: profile.nhanhAccessToken,
      });
      await client.checkProductInventory([1], profile.depotId);
      toast.success(`Kết nối "${profile.name}" thành công!`);
    } catch (error) {
      toast.error(`Kết nối "${profile.name}" thất bại: ${(error as Error).message}`);
    } finally {
      setIsTestingConnection(null);
    }
  };

  const updateProfile = (index: number, field: keyof DepotProfile, value: string | number) => {
    const profiles = [...apiConfig.depotProfiles];
    profiles[index] = { ...profiles[index], [field]: value };
    const updated = { ...apiConfig, depotProfiles: profiles };
    // Sync top-level fields if editing the active profile
    if (profiles[index].id === apiConfig.activeDepotId) {
      updated.depotId = profiles[index].depotId;
      updated.nhanhAppId = profiles[index].nhanhAppId;
      updated.nhanhBusinessId = profiles[index].nhanhBusinessId;
      updated.nhanhAccessToken = profiles[index].nhanhAccessToken;
    }
    setApiConfig(updated);
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
        <p className="text-muted-foreground">Cấu hình hệ thống tạo đơn hàng tự động</p>
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api">API & Kết nối</TabsTrigger>
          <TabsTrigger value="order">Quy tắc tạo đơn</TabsTrigger>
          <TabsTrigger value="time">Phân bổ thời gian</TabsTrigger>
          <TabsTrigger value="excel">Cấu hình Excel</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API & Kết nối</CardTitle>
              <CardDescription>Cấu hình kết nối Nhanh.vn và kho hàng</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Mỗi kho cần bộ thông tin riêng: Depot ID, App ID, Business ID, Access Token từ trang quản trị NhanhVN. Chọn kho đang dùng ở dropdown bên dưới.
                </AlertDescription>
              </Alert>

              {/* Chọn kho đang hoạt động */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Chọn kho để tạo đơn</Label>
                <Select
                  value={apiConfig.activeDepotId}
                  onValueChange={(val) => {
                    const profile = apiConfig.depotProfiles.find(p => p.id === val);
                    if (profile) {
                      setApiConfig({
                        ...apiConfig,
                        activeDepotId: val,
                        depotId: profile.depotId,
                        nhanhAppId: profile.nhanhAppId,
                        nhanhBusinessId: profile.nhanhBusinessId,
                        nhanhAccessToken: profile.nhanhAccessToken,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn kho..." />
                  </SelectTrigger>
                  <SelectContent>
                    {apiConfig.depotProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name || '(chưa đặt tên)'} — Depot ID: {profile.depotId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Depot profile cards */}
              {apiConfig.depotProfiles.map((profile, index) => (
                <div key={profile.id} className={`rounded-lg border p-4 space-y-3 ${profile.id === apiConfig.activeDepotId ? 'border-primary bg-primary/5' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {profile.id === apiConfig.activeDepotId && (
                        <Badge variant="default" className="text-xs">Đang dùng</Badge>
                      )}
                      <span className="font-medium">{profile.name || '(chưa đặt tên)'}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (apiConfig.depotProfiles.length <= 1) {
                          toast.error('Phải có ít nhất 1 kho');
                          return;
                        }
                        if (!confirm(`Xóa kho "${profile.name || '(chưa đặt tên)'}"? Thao tác này không thể hoàn tác sau khi Lưu.`)) {
                          return;
                        }
                        const profiles = apiConfig.depotProfiles.filter((_, i) => i !== index);
                        const updated = { ...apiConfig, depotProfiles: profiles };
                        if (profile.id === apiConfig.activeDepotId) {
                          updated.activeDepotId = profiles[0].id;
                          updated.depotId = profiles[0].depotId;
                          updated.nhanhAppId = profiles[0].nhanhAppId;
                          updated.nhanhBusinessId = profiles[0].nhanhBusinessId;
                          updated.nhanhAccessToken = profiles[0].nhanhAccessToken;
                        }
                        setApiConfig(updated);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tên kho</Label>
                      <Input value={profile.name} onChange={(e) => updateProfile(index, 'name', e.target.value)} placeholder="VD: Kho chính" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Depot ID</Label>
                      <Input type="number" value={profile.depotId} onChange={(e) => updateProfile(index, 'depotId', Number(e.target.value))} placeholder="215639" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">App ID</Label>
                      <Input value={profile.nhanhAppId} onChange={(e) => updateProfile(index, 'nhanhAppId', e.target.value)} placeholder="76531" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Business ID</Label>
                      <Input value={profile.nhanhBusinessId} onChange={(e) => updateProfile(index, 'nhanhBusinessId', e.target.value)} placeholder="209189" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Access Token</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showTokenFor === profile.id ? 'text' : 'password'}
                        value={profile.nhanhAccessToken}
                        onChange={(e) => updateProfile(index, 'nhanhAccessToken', e.target.value)}
                        placeholder="Access token..."
                      />
                      <Button variant="outline" size="icon" onClick={() => setShowTokenFor(showTokenFor === profile.id ? null : profile.id)}>
                        {showTokenFor === profile.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleTestConnection(profile)} disabled={isTestingConnection === profile.id}>
                    {isTestingConnection === profile.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                    Kiểm tra kết nối
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => {
                  const newId = `kho-${crypto.randomUUID().slice(0, 8)}`;
                  const profiles = [...apiConfig.depotProfiles, { id: newId, name: '', depotId: 0, nhanhAppId: '', nhanhBusinessId: '', nhanhAccessToken: '' }];
                  setApiConfig({ ...apiConfig, depotProfiles: profiles });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />Thêm kho mới
              </Button>

              <div className="pt-2">
                <Button onClick={() => handleSave('api_config', apiConfig, 'cấu hình API')} disabled={isSaving === 'api_config'}>
                  {isSaving === 'api_config' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Lưu tất cả
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="order">
          <Card>
            <CardHeader>
              <CardTitle>Quy tắc tạo đơn</CardTitle>
              <CardDescription>Cấu hình giá trị, số lượng sản phẩm cho mỗi đơn hàng</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Các thiết lập này quyết định giá trị và cấu trúc mỗi đơn hàng. Thuật toán sẽ random giá trị đơn, số SP, số lượng trong khoảng min-max. Sản phẩm được phân khúc giá: 60% giá thấp, 30% trung bình, 10% cao để đa dạng đơn.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giá trị đơn tối thiểu (VNĐ)</Label>
                  <Input type="number" value={orderRules.minTotalAmount} onChange={(e) => setOrderRules({ ...orderRules, minTotalAmount: Number(e.target.value) })} placeholder="300000" />
                  <p className="text-xs text-muted-foreground">Đơn phải đạt tối thiểu giá trị này. Mặc định: 300,000 ₫</p>
                </div>
                <div className="space-y-2">
                  <Label>Giá trị đơn tối đa (VNĐ)</Label>
                  <Input type="number" value={orderRules.maxTotalAmount} onChange={(e) => setOrderRules({ ...orderRules, maxTotalAmount: Number(e.target.value) })} placeholder="2000000" />
                  <p className="text-xs text-muted-foreground">Đơn không vượt quá mức này. Trung bình: ~{((orderRules.minTotalAmount + orderRules.maxTotalAmount) / 2).toLocaleString()} ₫</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số SP/đơn tối thiểu</Label>
                  <Input type="number" value={orderRules.minProductsPerOrder} onChange={(e) => setOrderRules({ ...orderRules, minProductsPerOrder: Number(e.target.value) })} min={1} />
                  <p className="text-xs text-muted-foreground">Mỗi đơn phải có ít nhất bao nhiêu loại SP khác nhau.</p>
                </div>
                <div className="space-y-2">
                  <Label>Số SP/đơn tối đa</Label>
                  <Input type="number" value={orderRules.maxProductsPerOrder} onChange={(e) => setOrderRules({ ...orderRules, maxProductsPerOrder: Number(e.target.value) })} min={1} />
                  <p className="text-xs text-muted-foreground">Giới hạn số loại SP trong 1 đơn để trông tự nhiên.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SL/sản phẩm tối thiểu</Label>
                  <Input type="number" value={orderRules.minQuantityPerProduct} onChange={(e) => setOrderRules({ ...orderRules, minQuantityPerProduct: Number(e.target.value) })} min={1} />
                  <p className="text-xs text-muted-foreground">Mỗi SP trong đơn mua ít nhất bao nhiêu cái.</p>
                </div>
                <div className="space-y-2">
                  <Label>SL/sản phẩm tối đa</Label>
                  <Input type="number" value={orderRules.maxQuantityPerProduct} onChange={(e) => setOrderRules({ ...orderRules, maxQuantityPerProduct: Number(e.target.value) })} min={1} />
                  <p className="text-xs text-muted-foreground">Giới hạn SL mỗi SP để trông tự nhiên.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giá trị đơn vét tối đa (VNĐ)</Label>
                  <Input type="number" value={orderRules.sweepMaxValue} onChange={(e) => setOrderRules({ ...orderRules, sweepMaxValue: Number(e.target.value) })} placeholder="200000" />
                  <p className="text-xs text-muted-foreground">SP tồn dư sau đơn chính sẽ gom thành "đơn vét". Mỗi đơn vét tối đa giá trị này. Đơn vét được rải đều vào tất cả các ngày (cuối tuần nhiều hơn theo hệ số weekendBoost), random mọi khung giờ theo weight.</p>
                </div>
                <div className="space-y-2">
                  <Label>Max lần thử liên tiếp</Label>
                  <Input type="number" value={orderRules.maxConsecutiveFails} onChange={(e) => setOrderRules({ ...orderRules, maxConsecutiveFails: Number(e.target.value) })} placeholder="100" />
                  <p className="text-xs text-muted-foreground">Sau N lần liên tiếp thất bại, chuyển "chế độ linh hoạt": nới min/3, max x1.5, +3 SP, +2 SL.</p>
                </div>
              </div>

              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Tham số nâng cao</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Độ lệch giá trị đơn (skew)</Label>
                    <Input type="number" step="0.1" min="1" value={orderRules.targetAmountSkew} onChange={(e) => setOrderRules({ ...orderRules, targetAmountSkew: Number(e.target.value) })} placeholder="2.5" />
                    <p className="text-xs text-muted-foreground">1 = uniform (đơn rải đều min↔max). 2.5 = log-normal-like (đa số đơn nhỏ, đuôi dài lên cao — gần thực tế nhất). 3+ = lệch trái mạnh.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Tỷ lệ ước trung bình đơn</Label>
                    <Input type="number" step="0.01" min="0" max="1" value={orderRules.avgOrderValueRatio} onChange={(e) => setOrderRules({ ...orderRules, avgOrderValueRatio: Number(e.target.value) })} placeholder="0.286" />
                    <p className="text-xs text-muted-foreground">Dùng để ƯỚC số đơn cần tạo. avg ≈ min + ratio·(max−min). Lý tưởng = 1/(skew+1) → skew 2.5 ⇒ ratio ≈ 0.286.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Số SP "thừa" khi rút random (slack)</Label>
                    <Input type="number" min="0" value={orderRules.productCountSlack} onChange={(e) => setOrderRules({ ...orderRules, productCountSlack: Number(e.target.value) })} placeholder="3" />
                    <p className="text-xs text-muted-foreground">Cộng vào maxProductsPerOrder khi random — giúp đạt minTotalAmount với pool sản phẩm giá rẻ. 0 = bám đúng max.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Số vòng lặp tối đa / đơn</Label>
                    <Input type="number" min="5" value={orderRules.maxGenerationLoops} onChange={(e) => setOrderRules({ ...orderRules, maxGenerationLoops: Number(e.target.value) })} placeholder="20" />
                    <p className="text-xs text-muted-foreground">Số lần thử thêm sản phẩm vào 1 đơn. Tăng nếu sản phẩm quá rẻ so với min — giảm nếu muốn fail nhanh.</p>
                  </div>
                </div>
              </div>

              <Button onClick={() => handleSave('order_rules', orderRules, 'quy tắc tạo đơn')} disabled={isSaving === 'order_rules'} className="mt-2">
                {isSaving === 'order_rules' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Lưu
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle>Phân bổ thời gian</CardTitle>
              <CardDescription>Cấu hình khung giờ và trọng số phân bổ đơn hàng</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Quyết định đơn hàng phân bổ vào giờ nào, ngày nào. Weight cao = nhiều đơn hơn. VD: weight 3.0 ở 10-12h, 16-18h, 20-21h30 = cao điểm. Cuối tuần nhân hệ số riêng.
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                <Label className="text-base font-medium">Khung giờ hoạt động</Label>
                <div className="rounded-md border">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3 bg-muted/50 text-sm font-medium">
                    <div>Giờ bắt đầu</div><div>Giờ kết thúc</div><div>Trọng số</div><div className="w-9"></div>
                  </div>
                  {timeDistribution.timeSlots.map((slot, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3 border-t items-center">
                      <Input type="number" step="0.25" value={slot.start} onChange={(e) => updateTimeSlot(index, 'start', Number(e.target.value))} />
                      <Input type="number" step="0.25" value={slot.end} onChange={(e) => updateTimeSlot(index, 'end', Number(e.target.value))} />
                      <Input type="number" step="0.1" value={slot.weight} onChange={(e) => updateTimeSlot(index, 'weight', Number(e.target.value))} />
                      <Button variant="ghost" size="icon" onClick={() => removeTimeSlot(index)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addTimeSlot}><Plus className="mr-2 h-4 w-4" />Thêm khung giờ</Button>
                <p className="text-xs text-muted-foreground">Weight: 3 = cao điểm, 0.3 = rất thấp, 1 = bình thường. Giờ decimal: 8.5 = 8h30, 22.75 = 22h45</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hệ số cuối tuần</Label>
                  <Input type="number" step="0.1" value={timeDistribution.weekendBoost} onChange={(e) => setTimeDistribution({ ...timeDistribution, weekendBoost: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">T7/CN có số đơn = ngày thường x hệ số. 1.8 = gấp 1.8 lần. 1.0 = không tăng.</p>
                </div>
                <div className="space-y-2">
                  <Label>% ngày có đơn muộn</Label>
                  <Input type="number" step="0.05" value={timeDistribution.lateOrderPercent} onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderPercent: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">Tỷ lệ ngày có đơn sau 22h45. 0.25 = 25% số ngày.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số đơn muộn min / max</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={timeDistribution.lateOrderMinCount} onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderMinCount: Number(e.target.value) })} min={0} />
                    <Input type="number" value={timeDistribution.lateOrderMaxCount} onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderMaxCount: Number(e.target.value) })} min={1} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Khung giờ đơn muộn</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.25" value={timeDistribution.lateOrderTimeStart} onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderTimeStart: Number(e.target.value) })} placeholder="22.77" />
                    <Input type="number" step="0.25" value={timeDistribution.lateOrderTimeEnd} onChange={(e) => setTimeDistribution({ ...timeDistribution, lateOrderTimeEnd: Number(e.target.value) })} placeholder="23.5" />
                  </div>
                  <p className="text-xs text-muted-foreground">22.77 = 22h46, 23.5 = 23h30</p>
                </div>
              </div>
              <Button onClick={() => handleSave('time_distribution', timeDistribution, 'phân bổ thời gian')} disabled={isSaving === 'time_distribution'}>
                {isSaving === 'time_distribution' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Lưu
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excel">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình Excel</CardTitle>
              <CardDescription>Tên các sheet trong file Excel upload</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Tên sheet phải khớp chính xác (phân biệt hoa thường) với file Excel bạn upload. Nếu file dùng tên khác, thay đổi ở đây.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Tên sheet Khách hàng</Label>
                <Input value={excelConfig.customerSheetName} onChange={(e) => setExcelConfig({ ...excelConfig, customerSheetName: e.target.value })} placeholder="DSKH" />
                <p className="text-xs text-muted-foreground">Sheet chứa khách hàng. Cần cột: ID, Tên, Điện thoại.</p>
              </div>
              <div className="space-y-2">
                <Label>Tên sheet Sản phẩm</Label>
                <Input value={excelConfig.productSheetName} onChange={(e) => setExcelConfig({ ...excelConfig, productSheetName: e.target.value })} placeholder="DSSP" />
                <p className="text-xs text-muted-foreground">Sheet chứa sản phẩm. Cần cột: ID, Tên hàng, Số lượng, Giá.</p>
              </div>
              <div className="space-y-2">
                <Label>Tên sheet Template</Label>
                <Input value={excelConfig.templateSheetName} onChange={(e) => setExcelConfig({ ...excelConfig, templateSheetName: e.target.value })} placeholder="template" />
                <p className="text-xs text-muted-foreground">Sheet template (tùy chọn).</p>
              </div>
              <Button onClick={() => handleSave('excel_config', excelConfig, 'cấu hình Excel')} disabled={isSaving === 'excel_config'} className="mt-2">
                {isSaving === 'excel_config' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
