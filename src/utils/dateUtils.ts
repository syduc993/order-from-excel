// Convert hour from UTC to Vietnam timezone (+7 hours)
// Database returns hour in UTC (0-23), we need to convert to Vietnam time (0-23)
export const convertHourToVietnam = (hour: number): number => {
    // If hour is a number, add 7 hours (Vietnam is UTC+7)
    // Handle wrap-around (e.g., 23 + 7 = 30 -> 6)
    if (typeof hour === 'number') {
        return (hour + 7) % 24;
    }
    // If hour is a string like "1", parse it first
    const hourNum = parseInt(String(hour), 10);
    if (!isNaN(hourNum)) {
        return (hourNum + 7) % 24;
    }
    return hour;
};

// Helper function to normalize date format to YYYY-MM-DD
// Database should return dates in YYYY-MM-DD format, so we just need to ensure consistency
export const normalizeDate = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '';

    // If already in YYYY-MM-DD format, return as is (most common case from database)
    if (typeof dateStr === 'string') {
        // Check if it's already YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        // If it's a date string with time (ISO format), extract just the date part
        if (dateStr.includes('T')) {
            return dateStr.split('T')[0];
        }

        // If it's in DD/MM/YYYY or DD-MM-YYYY format, convert to YYYY-MM-DD
        const ddmmyyyyMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
        if (ddmmyyyyMatch) {
            return `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`;
        }

        // If it's in YYYY/MM/DD format, convert to YYYY-MM-DD
        const yyyymmddMatch = dateStr.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
        if (yyyymmddMatch) {
            return `${yyyymmddMatch[1]}-${yyyymmddMatch[2]}-${yyyymmddMatch[3]}`;
        }
    }

    // If it's a Date object, format it
    if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Final fallback: return as string
    return String(dateStr);
};

// Format date for display (YYYY-MM-DD -> DD/MM/YYYY)
export const formatDateForDisplay = (dateStr: string): string => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};
