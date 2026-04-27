// Utility để phân bổ thời gian cho đơn hàng theo giờ trong ngày
import { DEFAULT_SETTINGS, type TimeDistributionConfig, type TimeSlotConfig } from '@/types/settings';

// Re-export default time slots cho code cũ vẫn import được
export const TIME_SLOTS: TimeSlotConfig[] = DEFAULT_SETTINGS.timeDistribution.timeSlots;

// Kiểm tra xem có phải cuối tuần không (Thứ 7 = 6, Chủ Nhật = 0)
function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// Tính weight theo ngày (cuối tuần nhiều bill hơn)
export function getDayWeight(date: Date, weekendBoost: number): number {
  return isWeekend(date) ? weekendBoost : 1.0;
}

// Tính số lượng đơn hàng cho mỗi ngày dựa trên weight
export function calculateOrdersPerDay(
  totalOrders: number,
  startDate: Date,
  endDate: Date,
  config: TimeDistributionConfig = DEFAULT_SETTINGS.timeDistribution
): Array<{ date: Date; orderCount: number }> {
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(23, 59, 59, 999);

  const days: Date[] = [];
  const dayWeights: number[] = [];

  for (let d = new Date(normalizedStart); d <= normalizedEnd; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    days.push(day);
    dayWeights.push(getDayWeight(day, config.weekendBoost));
  }

  const totalWeight = dayWeights.reduce((sum, weight) => sum + weight, 0);

  const ordersPerDay: Array<{ date: Date; orderCount: number }> = [];
  let remainingOrders = totalOrders;

  for (let i = 0; i < days.length; i++) {
    const weight = dayWeights[i];
    const proportion = weight / totalWeight;

    let orderCount = Math.floor(totalOrders * proportion);

    if (orderCount === 0 && remainingOrders > 0 && i < days.length - 1) {
      orderCount = 1;
    }

    orderCount = Math.min(orderCount, remainingOrders);

    ordersPerDay.push({
      date: days[i],
      orderCount
    });

    remainingOrders -= orderCount;
  }

  // Phân bổ số đơn còn lại (do làm tròn) vào các ngày có weight cao nhất
  if (remainingOrders > 0) {
    const sortedIndices = dayWeights
      .map((weight, index) => ({ weight, index }))
      .sort((a, b) => b.weight - a.weight);

    for (let i = 0; i < remainingOrders && i < sortedIndices.length; i++) {
      const dayIndex = sortedIndices[i].index;
      ordersPerDay[dayIndex].orderCount++;
    }
  }

  return ordersPerDay;
}

// Phân bổ các đơn hàng đã tạo cho các ngày theo weight + late order window
export function distributeOrdersToDays(
  orders: Array<{ orderIndex: number; customerId: number; customerName: string; customerPhone: string; orderData: any; totalAmount: number; scheduledTime?: Date }>,
  ordersPerDay: Array<{ date: Date; orderCount: number }>,
  startDate: Date,
  endDate: Date,
  config: TimeDistributionConfig = DEFAULT_SETTINGS.timeDistribution
): Array<{ orderIndex: number; customerId: number; customerName: string; customerPhone: string; orderData: any; totalAmount: number; scheduledTime: Date }> {
  void startDate; void endDate; // giữ chữ ký cũ để callers không phải đổi nhiều

  const timeSlots = config.timeSlots;
  const plannedTotal = ordersPerDay.reduce((sum, d) => sum + d.orderCount, 0);
  const actualTotal = orders.length;

  const distributedOrders: Array<{ orderIndex: number; customerId: number; customerName: string; customerPhone: string; orderData: any; totalAmount: number; scheduledTime: Date }> = [];
  let orderIndex = 0;
  let distributedSoFar = 0;

  const lateStartMin = Math.round(config.lateOrderTimeStart * 60);
  const lateEndMin = Math.round(config.lateOrderTimeEnd * 60);
  const lateWindowValid = lateEndMin > lateStartMin && config.lateOrderPercent > 0;

  for (let dayIdx = 0; dayIdx < ordersPerDay.length; dayIdx++) {
    const dayPlan = ordersPerDay[dayIdx];

    // Số đơn cho ngày này theo tỷ lệ weight
    let ordersForThisDay: number;
    if (dayIdx === ordersPerDay.length - 1) {
      ordersForThisDay = actualTotal - distributedSoFar;
    } else {
      ordersForThisDay = plannedTotal > 0
        ? Math.round((dayPlan.orderCount / plannedTotal) * actualTotal)
        : 0;
      ordersForThisDay = Math.min(ordersForThisDay, actualTotal - distributedSoFar);
    }
    distributedSoFar += ordersForThisDay;

    if (ordersForThisDay <= 0) continue;

    // Tách late orders ra khỏi quota chính
    let lateCount = 0;
    if (lateWindowValid && ordersForThisDay > 1) {
      const wanted = Math.round(ordersForThisDay * config.lateOrderPercent);
      lateCount = Math.min(
        Math.max(wanted, config.lateOrderMinCount),
        config.lateOrderMaxCount,
        ordersForThisDay - 1 // luôn để lại ít nhất 1 đơn cho khung giờ thường
      );
      lateCount = Math.max(0, lateCount);
    }
    const regularCount = ordersForThisDay - lateCount;

    // BƯỚC 1: Phân bổ SỐ ĐƠN cho từng khung giờ thường theo weight
    const totalSlotWeight = timeSlots.reduce((sum, s) => sum + s.weight * (s.end - s.start), 0);

    interface SlotAllocation {
      slotStartMin: number;
      slotEndMin: number;
      orderCount: number;
      anchors: number[];
    }
    const slotAllocations: SlotAllocation[] = [];
    let ordersAllocatedToSlots = 0;

    for (let s = 0; s < timeSlots.length; s++) {
      const slot = timeSlots[s];
      const slotStartMin = Math.round(slot.start * 60);
      const slotEndMin = Math.round(slot.end * 60);
      const slotDuration = slotEndMin - slotStartMin;
      const slotWeight = slot.weight * (slot.end - slot.start);

      let orderCountForSlot: number;
      if (s === timeSlots.length - 1) {
        orderCountForSlot = regularCount - ordersAllocatedToSlots;
      } else {
        orderCountForSlot = totalSlotWeight > 0
          ? Math.round(regularCount * slotWeight / totalSlotWeight)
          : 0;
      }
      orderCountForSlot = Math.max(0, Math.min(orderCountForSlot, regularCount - ordersAllocatedToSlots));
      ordersAllocatedToSlots += orderCountForSlot;

      // BƯỚC 2: Tạo burst anchors theo Poisson process
      // Order statistics của N mẫu uniform i.i.d. trên [start, end] tương đương arrival times
      // của Poisson process điều kiện có đúng N events — cho cảm giác cluster/gap tự nhiên,
      // không bị lưới đều như anchor cách đều.
      const burstSize = 2 + Math.floor(Math.random() * 4);
      const numBurstsForSlot = Math.max(1, Math.ceil(orderCountForSlot / burstSize));

      const anchors: number[] = [];
      for (let b = 0; b < numBurstsForSlot; b++) {
        anchors.push(slotStartMin + Math.random() * slotDuration);
      }
      anchors.sort((a, b) => a - b);
      for (let b = 0; b < anchors.length; b++) {
        anchors[b] = Math.max(slotStartMin, Math.min(slotEndMin - 1, Math.round(anchors[b])));
      }

      slotAllocations.push({ slotStartMin, slotEndMin, orderCount: orderCountForSlot, anchors });
    }

    // BƯỚC 3: Phân bổ đơn vào burst anchors trong từng khung giờ
    for (const allocation of slotAllocations) {
      if (allocation.orderCount <= 0) continue;

      let anchorIdx = 0;
      let ordersInBurst = 0;
      let burstCapacity = 2 + Math.floor(Math.random() * 5);

      for (let i = 0; i < allocation.orderCount && orderIndex < orders.length; i++) {
        const order = orders[orderIndex];
        const anchorMinute = allocation.anchors[anchorIdx];
        const jitter = Math.floor(Math.random() * 4);
        const totalMinutes = Math.min(anchorMinute + jitter, allocation.slotEndMin - 1);

        const scheduledTime = new Date(dayPlan.date);
        scheduledTime.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);

        distributedOrders.push({ ...order, scheduledTime });

        orderIndex++;
        ordersInBurst++;

        if (ordersInBurst >= burstCapacity && anchorIdx < allocation.anchors.length - 1) {
          anchorIdx++;
          ordersInBurst = 0;
          burstCapacity = 2 + Math.floor(Math.random() * 5);
        }
      }
    }

    // BƯỚC 4: Phân bổ late orders vào late window (uniform random)
    for (let i = 0; i < lateCount && orderIndex < orders.length; i++) {
      const order = orders[orderIndex];
      const totalMinutes = lateStartMin + Math.floor(Math.random() * (lateEndMin - lateStartMin));
      const scheduledTime = new Date(dayPlan.date);
      scheduledTime.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
      distributedOrders.push({ ...order, scheduledTime });
      orderIndex++;
    }
  }

  return distributedOrders;
}
