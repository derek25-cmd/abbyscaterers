// @ts-nocheck
import { attendanceRecords as mockAttendance } from '@/lib/mock-data';

const ATTENDANCE_STORAGE_KEY = 'attendanceRecords';

const initializeAttendance = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(ATTENDANCE_STORAGE_KEY)) {
        localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(mockAttendance));
    }
};

initializeAttendance();


export const getAttendanceRecords = async () => {
    if (typeof window === 'undefined') return [];
    const records = JSON.parse(localStorage.getItem(ATTENDANCE_STORAGE_KEY) || '[]');
    return Promise.resolve(records);
};

export const findAttendanceRecord = async (employeeName, date) => {
    if (typeof window === 'undefined') return null;
    const records = await getAttendanceRecords();
    const record = records.find(r => 
        r.employee === employeeName && 
        r.date === date &&
        r.clockOut === "—"
    );
    return Promise.resolve(record || null);
};


export const addAttendanceRecord = async (record) => {
    if (typeof window === 'undefined') return;
    const records = await getAttendanceRecords();
    const newRecord = { ...record, id: `ATT${Date.now()}` };
    const updatedRecords = [newRecord, ...records];
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(updatedRecords));
    return Promise.resolve(newRecord.id);
};

export const updateAttendanceRecord = async (id, updatedRecord) => {
    if (typeof window === 'undefined') return;
    const records = await getAttendanceRecords();
    const updatedRecords = records.map(record => 
        record.id === id ? { ...record, ...updatedRecord } : record
    );
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(updatedRecords));
    return Promise.resolve();
};
