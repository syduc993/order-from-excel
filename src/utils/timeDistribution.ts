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
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(23, 59, 59, 999);

  // Nếu là đơn vét, phân bổ vào khung giờ cao điểm cuối tuần hoặc gần cuối tuần
  if (isSweepOrder) {
    // Lấy các ngày cuối tuần
    const weekendDays = ordersPerDay.filter(d => isWeekend(d.date));
    
    // Nếu có cuối tuần, phân bổ vào cuối tuần
    // Nếu không, lấy các ngày gần cuối tuần (Thứ 6, Thứ 7, Chủ Nhật)
    let targetDays = weekendDays.length > 0 
      ? weekendDays 
      : ordersPerDay.filter(d => {
          const dayOfWeek = d.date.getDay();
          return dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0; // Thứ 6, Thứ 7, Chủ Nhật
        });
    
    // Nếu vẫn không có, lấy tất cả các ngày
    if (targetDays.length === 0) {
      targetDays = ordersPerDay;
    }

    // Phân bổ đơn vét cho các ngày target (ưu tiên cuối tuần)
    const distributedOrders = orders.map((order, index) => {
      const targetDayPlan = targetDays[index % targetDays.length];
      const targetDate = targetDayPlan.date; // FIX: Lấy đúng thuộc tính date
      
      // Lấy khung giờ cao điểm cho ngày này
      const peakTimeSlots = getPeakTimeSlots(targetDate); // FIX: Truyền Date, không phải object
      if (peakTimeSlots.length === 0) {
        // Nếu không có khung giờ cao điểm, dùng khung giờ đầu tiên
        const scheduledTime = new Date(targetDate); // FIX: Dùng targetDate
        scheduledTime.setHours(10, 0, 0, 0);
        return {
          ...order,
          scheduledTime
        };
      }
      
      const randomSlot = peakTimeSlots[Math.floor(Math.random() * peakTimeSlots.length)];
      
      // Random trong khung giờ cao điểm
      const slotStartMinutes = randomSlot.start * 60;
      const slotEndMinutes = randomSlot.end * 60;
      const randomMinutes = Math.floor(Math.random() * (slotEndMinutes - slotStartMinutes));
      
      const scheduledTime = new Date(targetDate); // FIX: Dùng targetDate
      const totalMinutes = slotStartMinutes + randomMinutes;
      scheduledTime.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
      
      // Đảm bảo không vượt quá 22h45
      if (scheduledTime.getHours() > 22 || (scheduledTime.getHours() === 22 && scheduledTime.getMinutes() > 45)) {
        scheduledTime.setHours(22, 45, 0, 0);
      }
      
      return {
        ...order,
        scheduledTime
      };
    });

    return distributedOrders;
  }

  // Phân bổ đơn hàng thường theo weight
  // Tạo danh sách các time slot có weight cho tất cả các ngày
  interface TimeSlotWithDate {
    date: Date;
    slot: TimeSlot;
    weight: number;
  }

  const allTimeSlots: TimeSlotWithDate[] = [];
  
  // Tính tổng weight để phân bổ
  let totalWeight = 0;
  const dayWeightsMap = new Map<string, number>();
  
  for (const dayPlan of ordersPerDay) {
    const dayWeight = getDayWeight(dayPlan.date);
    const dateKey = dayPlan.date.toLocaleDateString('vi-VN');
    dayWeightsMap.set(dateKey, dayWeight);
    
    for (const slot of TIME_SLOTS) {
      const hoursInSlot = slot.end - slot.start;
      totalWeight += hoursInSlot * slot.weight * dayWeight;
    }
  }

  console.log(`🔍 DEBUG distributeOrdersToDays:`);
  console.log(`  - Tổng số đơn hàng cần phân bổ: ${orders.length}`);
  console.log(`  - Tổng weight: ${totalWeight.toFixed(2)}`);
  console.log(`  - Weight theo ngày:`, Array.from(dayWeightsMap.entries()).map(([date, weight]) => ({ date, weight: weight.toFixed(2) })));

  const slotsPerDay = new Map<string, number>();
  
  // Đảm bảo mỗi ngày có số lượng slots tối thiểu để phân bổ đều
  const minSlotsPerDay = Math.ceil(orders.length / ordersPerDay.length) * 2; // Tối thiểu 2x số đơn/ngày
  
  for (const dayPlan of ordersPerDay) {
    const dayWeight = getDayWeight(dayPlan.date);
    const dateKey = dayPlan.date.toLocaleDateString('vi-VN');
    let daySlotCount = 0;
    
    for (const slot of TIME_SLOTS) {
      const slotWeight = slot.weight * dayWeight;
      const hoursInSlot = slot.end - slot.start;
      
      // Tạo số slot theo tỷ lệ weight (đảm bảo đủ slot cho tất cả đơn hàng)
      const slotProportion = (hoursInSlot * slotWeight) / totalWeight;
      let numSlots = Math.max(1, Math.ceil(orders.length * slotProportion * 2)); // Nhân 2 để có buffer
      
      // Đảm bảo mỗi ngày có ít nhất một số slots tối thiểu
      // Nếu là ngày đầu và chưa đủ slots, tăng thêm
      if (daySlotCount === 0 && numSlots < minSlotsPerDay / TIME_SLOTS.length) {
        numSlots = Math.max(numSlots, Math.ceil(minSlotsPerDay / TIME_SLOTS.length));
      }
      
      daySlotCount += numSlots;
      
      for (let i = 0; i < numSlots; i++) {
        allTimeSlots.push({
          date: new Date(dayPlan.date),
          slot,
          weight: slotWeight
        });
      }
    }
    
    slotsPerDay.set(dateKey, daySlotCount);
  }

  console.log(`  - Tổng số time slots được tạo: ${allTimeSlots.length}`);
  console.log(`  - Số slots theo ngày:`, Array.from(slotsPerDay.entries()).map(([date, count]) => ({ date, count })));

  // Phân bổ đều: Chia đơn hàng cho từng ngày trước, sau đó random trong ngày
  // Tạo danh sách slots theo ngày
  const slotsByDay = new Map<string, TimeSlotWithDate[]>();
  for (const slot of allTimeSlots) {
    const dateKey = slot.date.toLocaleDateString('vi-VN');
    if (!slotsByDay.has(dateKey)) {
      slotsByDay.set(dateKey, []);
    }
    slotsByDay.get(dateKey)!.push(slot);
  }

  // Phân bổ đơn hàng cho từng ngày (round-robin)
  const ordersPerDayCount = Math.floor(orders.length / ordersPerDay.length);
  const remainingOrders = orders.length % ordersPerDay.length;
  
  const distributedOrders: Array<{ orderIndex: number; customerId: number; customerName: string; customerPhone: string; orderData: any; totalAmount: number; scheduledTime: Date }> = [];
  let orderIndex = 0;
  
  for (let dayIdx = 0; dayIdx < ordersPerDay.length; dayIdx++) {
    const dayPlan = ordersPerDay[dayIdx];
    const dateKey = dayPlan.date.toLocaleDateString('vi-VN');
    const daySlots = slotsByDay.get(dateKey) || [];
    
    // Số đơn cho ngày này (đảm bảo phân bổ đều)
    const ordersForThisDay = ordersPerDayCount + (dayIdx < remainingOrders ? 1 : 0);
    
    // Random slots trong ngày này
    const shuffledSlots = [...daySlots].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < ordersForThisDay && orderIndex < orders.length; i++) {
      const order = orders[orderIndex];
      const timeSlot = shuffledSlots[i % shuffledSlots.length];
      
      const slotStartMinutes = timeSlot.slot.start * 60;
      const slotEndMinutes = timeSlot.slot.end * 60;
      const randomMinutes = Math.floor(Math.random() * (slotEndMinutes - slotStartMinutes));
      
      const scheduledTime = new Date(timeSlot.date);
      const totalMinutes = slotStartMinutes + randomMinutes;
      scheduledTime.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
      
      // Đảm bảo không vượt quá 22h45
      if (scheduledTime.getHours() > 22 || (scheduledTime.getHours() === 22 && scheduledTime.getMinutes() > 45)) {
        scheduledTime.setHours(22, 45, 0, 0);
      }
      
      distributedOrders.push({
        ...order,
        scheduledTime
      });
      
      orderIndex++;
    }
  }

  // Log phân bổ thực tế
  const actualDistribution = new Map<string, number>();
  distributedOrders.forEach(order => {
    const dateKey = order.scheduledTime.toLocaleDateString('vi-VN');
    actualDistribution.set(dateKey, (actualDistribution.get(dateKey) || 0) + 1);
  });
  
  console.log(`  - Phân bổ thực tế theo ngày:`, Array.from(actualDistribution.entries())
    .sort((a, b) => new Date(a[0].split('/').reverse().join('-')).getTime() - new Date(b[0].split('/').reverse().join('-')).getTime())
    .map(([date, count]) => ({ date, count, percentage: ((count / orders.length) * 100).toFixed(1) + '%' })));

  return distributedOrders;
}

// Lấy các khung giờ cao điểm (weight >= 3)
function getPeakTimeSlots(date: Date): TimeSlot[] {
  return TIME_SLOTS.filter(slot => slot.weight >= 3);
}

export function distributeOrdersByTime(
  totalOrders: number,
  startDate: Date,
  endDate: Date
): Date[] {
  const scheduledTimes: Date[] = [];

  // Normalize dates to midnight to fix comparison bug
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(23, 59, 59, 999);

  // Debug: Log date range để kiểm tra
  console.log('Phân bổ đơn hàng từ:', normalizedStart.toLocaleDateString('vi-VN'), 'đến:', normalizedEnd.toLocaleDateString('vi-VN'));

  // Tính tổng weight để phân bổ (có tính cả weight cuối tuần)
  let totalWeight = 0;
  const days: Date[] = [];

  // Fixed: Use proper date iteration - đảm bảo bao gồm cả endDate
  for (let d = new Date(normalizedStart); d <= normalizedEnd; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0); // Normalize to midnight
    days.push(day);
    const dayWeight = getDayWeight(day);

    for (const slot of TIME_SLOTS) {
      const hoursPerDay = slot.end - slot.start;
      totalWeight += hoursPerDay * slot.weight * dayWeight;
    }
  }

  // Debug: Log số ngày được tạo
  console.log(`Đã tạo ${days.length} ngày để phân bổ (từ ${days[0]?.toLocaleDateString('vi-VN')} đến ${days[days.length - 1]?.toLocaleDateString('vi-VN')})`);

  // Tạo danh sách time slots với weight (có tính cuối tuần)
  // CHANGED: Generate unlimited pool instead of limiting to totalOrders
  const weightedSlots: Array<{ date: Date; slot: TimeSlot; weight: number }> = [];

  for (const day of days) {
    const dayWeight = getDayWeight(day);

    for (const slot of TIME_SLOTS) {
      const date = new Date(day);
      date.setHours(Math.floor(slot.start), (slot.start % 1) * 60, 0, 0);

      const hoursInSlot = slot.end - slot.start;
      const slotWeight = slot.weight * dayWeight;
      // Generate enough slots for this time period (proportional to weight)
      const ordersInSlot = Math.max(1, Math.floor((totalOrders * hoursInSlot * slotWeight) / totalWeight));

      for (let i = 0; i < ordersInSlot; i++) {
        weightedSlots.push({ date, slot, weight: slotWeight });
      }
    }
  }

  // Random và sắp xếp lại
  weightedSlots.sort(() => Math.random() - 0.5);

  // Tạo scheduled times với random trong mỗi slot
  // CHANGED: Don't slice, return entire pool
  for (const { date, slot } of weightedSlots) {
    const slotStartMinutes = slot.start * 60;
    const slotEndMinutes = slot.end * 60;
    const randomMinutes = Math.floor(Math.random() * (slotEndMinutes - slotStartMinutes));

    const scheduledTime = new Date(date);
    scheduledTime.setHours(0, slotStartMinutes + randomMinutes, 0, 0);

    // Đảm bảo không vượt quá 22h45 trong khung giờ chính
    if (scheduledTime.getHours() > 22 || (scheduledTime.getHours() === 22 && scheduledTime.getMinutes() > 45)) {
      scheduledTime.setHours(22, 45, 0, 0);
    }

    scheduledTimes.push(scheduledTime);
  }

  // Xử lý đơn muộn sau giờ đóng cửa (22h45-23h30)
  // Một số ngày có 1-2 đơn muộn (xác suất ~25% số ngày)
  const lateOrderDays = new Set<number>();
  const totalDays = days.length;
  const daysWithLateOrders = Math.floor(totalDays * 0.25); // 25% số ngày có đơn muộn

  // Random chọn các ngày có đơn muộn
  while (lateOrderDays.size < daysWithLateOrders && lateOrderDays.size < totalDays) {
    const randomDayIndex = Math.floor(Math.random() * totalDays);
    lateOrderDays.add(randomDayIndex);
  }

  // Tạo 1-2 đơn muộn cho mỗi ngày được chọn
  for (const dayIndex of lateOrderDays) {
    const day = days[dayIndex];
    const numLateOrders = Math.floor(Math.random() * 2) + 1; // 1 hoặc 2 đơn

    for (let i = 0; i < numLateOrders; i++) {
      // Random giờ từ 22h46 đến 23h30
      const lateHour = 22;
      const lateMinute = 46 + Math.floor(Math.random() * 44); // 22h46-23h30

      const lateTime = new Date(day);
      if (lateMinute >= 60) {
        lateTime.setHours(23, lateMinute - 60, 0, 0);
      } else {
        lateTime.setHours(lateHour, lateMinute, 0, 0);
      }

      scheduledTimes.push(lateTime);
    }
  }

  // Sắp xếp theo thời gian
  scheduledTimes.sort((a, b) => a.getTime() - b.getTime());

  // CHANGED: Return entire pool (no slicing)
  return scheduledTimes;
}


