const fs = require("fs");

function toSeconds(timeStr) {
    let [time, period] = timeStr.split(" ");
    let [h, m, s] = time.split(":").map(Number);

    if (period != undefined) {
        if (period.toLowerCase() === "pm" && h !== 12) h += 12;
        if (period.toLowerCase() === "am" && h === 12) h = 0;
    }

    return h * 3600 + m * 60 + s;
}

function toHours(timeStr) {
    return toSeconds(timeStr) / 3600;
}

function toHMS(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function readShiftRecords(file) {
    const data = fs.readFileSync(file, "utf-8").trim();
    if (!data) return [];

    const lines = data.split("\n");
    
    return lines.slice(0).map(line => {
        const parts = line.split(",").map(s => s.trim());
        
        return {
            driverID: parts[0],
            driverName: parts[1],
            date: parts[2],
            startTime: parts[3],
            endTime: parts[4],
            shiftDuration: parts[5],
            idleTime: parts[6],
            activeTime: parts[7],
            metQuota: parts[8]?.toLowerCase() === "true",
            hasBonus: parts[9]?.toLowerCase() === "true" 
        };
    });
}

function readDriverRates(file) {
    const data = fs.readFileSync(file, "utf-8").trim();
    if (!data) return {};

    const lines = data.split("\n");

    return lines.slice(0).map(line => {
        const [driverID, dayOff, basePay, tier] = line.split(",").map(s => s.trim());
        return { driverID, dayOff, basePay: parseInt(basePay), tier: parseInt(tier) };
    })
}

function getAllowedMissingHours(tier) {
    if (tier === 1) return 50;
    if (tier === 2) return 20;
    if (tier === 3) return 10;
    if (tier === 4) return 3;
    return 0;
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let start = toSeconds(startTime);
    let end = toSeconds(endTime);

    if (end < start) {
        end += 24 * 3600;
    }

    let diff = end - start;

    let hours = Math.floor(diff / 3600);
    let minutes = Math.floor((diff % 3600) / 60);
    let seconds = diff % 60;

    return toHMS(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    const DELIVERY_START_TIME = toSeconds("08:00:00 am");
    const DELIVERY_END_TIME = toSeconds("10:00:00 pm");
    // TODO: Implement this function
    const start = toSeconds(startTime);
    const end = toSeconds(endTime);

    if (end < start) end += 24 * 3600;

    let idleTime = 0;

    if (start < DELIVERY_START_TIME) {
        idleTime += Math.min(DELIVERY_START_TIME, end) - start;
    }

    if (end > DELIVERY_END_TIME) {
        idleTime += end - Math.max(DELIVERY_END_TIME, start);
    }
    
    return toHMS(idleTime);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    // TODO: Implement this function
    let shift = toSeconds(shiftDuration);
    let idle = toSeconds(idleTime);

    let active = Math.max(0, shift - idle);
    
    return toHMS(active);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    // TODO: Implement this function
    const eidStart = new Date("2025-04-10");
    const eidEnd = new Date("2025-04-20");
    const dateObj = new Date(date);
    let quota = 8 * 3600 + 24 * 60; // 8 hours 24 minutes in seconds

    if (dateObj > eidStart && dateObj < eidEnd) {
        quota = 6 * 3600; // 6 hours in seconds
    }

    let active = toSeconds(activeTime);
    return active >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    const { driverID, driverName, date, startTime, endTime } = shiftObj;

    const shiftDuration = getShiftDuration(startTime, endTime);
    const idleTime = getIdleTime(startTime, endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const hasMetQuota = metQuota(date, activeTime);

    let lines = fs.readFileSync(textFile, "utf-8").trim().split("\n");
    
    const isDuplicate = lines.some(line => line.includes(driverID) && line.includes(date));
    if (isDuplicate) return {};

    const newRecordObj = {
        driverID, driverName, date, startTime, endTime,
        shiftDuration, idleTime, activeTime,
        metQuota: hasMetQuota,
        hasBonus: false
    };

    const newRecordStr = Object.values(newRecordObj).join(",");

    let lastIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(driverID)) lastIndex = i;
    }

    if (lastIndex !== -1) {
        lines.splice(lastIndex + 1, 0, newRecordStr);
    } else {
        lines.push(newRecordStr);
    }

    fs.writeFileSync(textFile, lines.join("\n") + "\n");

    return newRecordObj;
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(shiftFile, rateFile, bonusCount, driverID, month) {
    const eidStart = new Date("2025-04-10");
    const eidEnd = new Date("2025-04-20");
    const formattedMonth = month.toString().padStart(2, "0");

    const shifts = readShiftRecords(shiftFile).filter(r => r.driverID === driverID);
    if (!shifts.length) {
        return "0:00:00";
    }

    const driverRate = readDriverRates(rateFile).find(r => r.driverID === driverID);
    if (!driverRate) {
        return "0:00:00";
    }

    let requiredSeconds = 0;

    for (const record of shifts) {
        if (record.date.split("-")[1] !== formattedMonth) continue;

        const dateObj = new Date(record.date);
        const dayOfWeek = dateObj.toLocaleString("en-US", { weekday: "long" });

        if (dayOfWeek === driverRate.dayOff) continue;

        let quota = 8 * 3600 + 24 * 60;

        if (dateObj >= eidStart && dateObj <= eidEnd) {
            quota = 6 * 3600;
        }

        requiredSeconds += quota;
    }

    requiredSeconds = Math.max(0, requiredSeconds - bonusCount * 2 * 3600);

    return toHMS(requiredSeconds);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    const driverRate = readDriverRates(rateFile).find(r => r.driverID === driverID);
    if (!driverRate) return 0;

    const basePay = driverRate.basePay;
    const tier = driverRate.tier;

    const actualSec = actualHours.split(":").reduce((acc, time) => (acc * 60) + +time, 0);
    const requiredSec = requiredHours.split(":").reduce((acc, time) => (acc * 60) + +time, 0);

    if (actualSec >= requiredSec) return basePay;

    let missingSeconds = requiredSec - actualSec;
    const allowanceSeconds = getAllowedMissingHours(tier) * 3600;
    let secondsAfterAllowance = missingSeconds - allowanceSeconds;

    if (secondsAfterAllowance <= 0) return basePay;

    const billableMissingHours = Math.floor(secondsAfterAllowance / 3600);
    const deductionRatePerHour = Math.floor(basePay / 185);
    const salaryDeduction = billableMissingHours * deductionRatePerHour;

    return basePay - salaryDeduction;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};

