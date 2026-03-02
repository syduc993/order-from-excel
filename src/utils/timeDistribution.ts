// Utility để phân bổ thời gian cho đơn hàng theo giờ trong ngày
import { DEFAULT_SETTINGS, type TimeDistributionConfig } from '@/types/settings';

interface TimeSlot {
  start: number; // Giờ bắt đầu (0-23)
  end: number; // Giờ kết thúc (0-23)
  weight: number; // Trọng số (cao điểm = nhiều đơn hơn)
}

// Default TIME_SLOTS (fallback khi không truyền config)
export const TIME_SLOTS: TimeSlot[] = DEFAULT_SETTINGS.timeDistribution.timeSlots;

// Kiểm tra xem có phải cuối tuần không (Thứ 7 = 6, Chủ Nhật = 0)
function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Chủ Nhật hoặc Thứ 7
}

// Tính weight theo ngày (cuối tuần nhiều bill hơn)
export function getDayWeight(date: Date, weekendBoost: number = DEFAULT_SETTINGS.timeDistribution.weekendBoost): number {
  return isWeekend(date) ? weekendBoost : 1.0;
}

// Tính số lượng đơn hàng cho mỗi ngày dựa trên weight
export function calculateOrdersPerDay(
  totalOrders: number,
  startDate: Date,
  endDate: Date
): Array<{ date: Date; orderCount: number }> {
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(23, 59, 59, 999);

  const days: Date[] = [];
  const dayWeights: number[] = [];

  // Tính weight cho mỗi ngày
  for (let d = new Date(normalizedStart); d <= normalizedEnd; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    days.push(day);
    dayWeights.push(getDayWeight(day));
  }

  // Tính tổng weight
  const totalWeight = dayWeights.reduce((sum, weight) => sum + weight, 0);

  // Phân bổ số lượng đơn hàng cho mỗi ngày theo tỷ lệ weight
  const ordersPerDay: Array<{ date: Date; orderCount: number }> = [];
  let remainingOrders = totalOrders;

  for (let i = 0; i < days.length; i++) {
    const weight = dayWeights[i];
    const proportion = weight / totalWeight;
    
    // Tính số lượng đơn cho ngày này (làm tròn)
    let orderCount = Math.floor(totalOrders * proportion);
    
    // Đảm bảo mỗi ngày có ít nhất 1 đơn (nếu còn đơn)
    if (orderCount === 0 && remainingOrders > 0 && i < days.length - 1) {
      orderCount = 1;
    }
    
    // Đảm bảo không vượt quá số đơn còn lại
    orderCount = Math.min(orderCount, remainingOrders);
    
    ordersPerDay.push({
      date: days[i],
      orderCount
    });
    
    remainingOrders -= orderCount;
  }

  // Phân bổ số đơn còn lại (do làm tròn) vào các ngày có weight cao nhất
  if (remainingOrders > 0) {
    // Sắp xếp theo weight giảm dần
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

// Phân bổ các đơn hàng đã tạo cho các ngày theo weight
export function distributeOrdersToDays(
  orders: Array<{ orderIndex: number; customerId: number; customerName: string; customerPhone: string; orderData: any; totalAmount: number; scheduledTime?: Date }>,
  ordersPerDay: Array<{ date: Date; orderCount: number }>,
  startDate: Date,
  endDate: Date,
  isSweepOrder: boolean = false
): Array<{ orderIndex: number; customerId: number; customerName: string; customerPhone: string; orderData: any; totalAmount: number; scheduledTime: Date }> {
  // Phân bổ đơn hàng cho từng ngày theo weight + burst clustering
  // (logic chung cho cả đơn chính và đơn vét)
  const plannedTotal = ordersPerDay.reduce((sum, d) => sum + d.orderCount, 0);
  const actualTotal = orders.length;

  const distributedOrders: Array<{ orderIndex: number; customerId: number; customerName: string; customerPhone: string; orderData: any; totalAmount: number; scheduledTime: Date }> = [];
  let orderIndex = 0;
  let distributedSoFar = 0;

  for (let dayIdx = 0; dayIdx < ordersPerDay.length; dayIdx++) {
    const dayPlan = ordersPerDay[dayIdx];

    // Số đơn cho ngày này theo tỷ lệ weight (cuối tuần sẽ nhiều hơn)
    let ordersForThisDay: number;
    if (dayIdx === ordersPerDay.length - 1) {
      // Ngày cuối nhận hết phần còn lại (tránh mất đơn do làm tròn)
      ordersForThisDay = actualTotal - distributedSoFar;
    } else {
      ordersForThisDay = plannedTotal > 0
        ? Math.round((dayPlan.orderCount / plannedTotal) * actualTotal)
        : 0;
      // Không vượt quá số đơn còn lại
      ordersForThisDay = Math.min(ordersForThisDay, actualTotal - distributedSoFar);
    }
    distributedSoFar += ordersForThisDay;
    
    // BƯỚC 1: Phân bổ SỐ ĐƠN cho từng khung giờ theo weight
    // (Đảm bảo mỗi khung giờ nhận đúng tỷ lệ đơn, không bị dồn vào giờ sớm)
    const totalSlotWeight = TIME_SLOTS.reduce((sum, s) => sum + s.weight * (s.end - s.start), 0);

    interface SlotAllocation {
      slotStartMin: number;
      slotEndMin: number;
      orderCount: number;
      anchors: number[];
    }
    const slotAllocations: SlotAllocation[] = [];
    let ordersAllocatedToSlots = 0;

    for (let s = 0; s < TIME_SLOTS.length; s++) {
      const slot = TIME_SLOTS[s];
      const slotStartMin = slot.start * 60;
      const slotEndMin = slot.end * 60;
      const slotDuration = slotEndMin - slotStartMin;
      const slotWeight = slot.weight * (slot.end - slot.start);

      // Số đơn cho khung giờ này (tỷ lệ theo weight)
      let orderCountForSlot: number;
      if (s === TIME_SLOTS.length - 1) {
        orderCountForSlot = ordersForThisDay - ordersAllocatedToSlots;
      } else {
        orderCountForSlot = Math.round(ordersForThisDay * slotWeight / totalSlotWeight);
      }
      orderCountForSlot = Math.max(0, Math.min(orderCountForSlot, ordersForThisDay - ordersAllocatedToSlots));
      ordersAllocatedToSlots += orderCountForSlot;

      // BƯỚC 2: Tạo burst anchors trong khung giờ này
      // Mỗi đợt 2-5 đơn sát nhau, burst clustering tạo cảm giác tự nhiên
      const burstSize = 2 + Math.floor(Math.random() * 4); // 2-5 đơn/đợt
      const numBurstsForSlot = Math.max(1, Math.ceil(orderCountForSlot / burstSize));

      const anchors: number[] = [];
      for (let b = 0; b < numBurstsForSlot; b++) {
        const basePos = slotStartMin + (slotDuration / (numBurstsForSlot + 1)) * (b + 1);
        const jitterRange = Math.min(5, Math.floor(slotDuration / (numBurstsForSlot + 1) / 2));
        const jitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
        anchors.push(Math.max(slotStartMin, Math.min(slotEndMin - 1, Math.round(basePos + jitter))));
      }

      slotAllocations.push({ slotStartMin, slotEndMin, orderCount: orderCountForSlot, anchors });
    }

    // BƯỚC 3: Phân bổ đơn vào burst anchors trong từng khung giờ
    for (const allocation of slotAllocations) {
      if (allocation.orderCount <= 0) continue;

      let anchorIdx = 0;
      let ordersInBurst = 0;
      let burstCapacity = 2 + Math.floor(Math.random() * 5); // 2-6 đơn/đợt

      for (let i = 0; i < allocation.orderCount && orderIndex < orders.length; i++) {
        const order = orders[orderIndex];
        const anchorMinute = allocation.anchors[anchorIdx];
        // Jitter 0-3 phút cho mỗi đơn trong burst
        const jitter = Math.floor(Math.random() * 4);
        const totalMinutes = Math.min(anchorMinute + jitter, allocation.slotEndMin - 1);

        const scheduledTime = new Date(dayPlan.date);
        scheduledTime.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);

        distributedOrders.push({
          ...order,
          scheduledTime
        });

        orderIndex++;
        ordersInBurst++;

        // Chuyển sang đợt tiếp theo khi đủ capacity
        if (ordersInBurst >= burstCapacity && anchorIdx < allocation.anchors.length - 1) {
          anchorIdx++;
          ordersInBurst = 0;
          burstCapacity = 2 + Math.floor(Math.random() * 5);
        }
      }
    }
  }

  return distributedOrders;
}
