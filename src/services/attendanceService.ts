
import { supabase } from '@/lib/supabase-client';

export const getAttendanceRecords = async () => {
    const { data, error } = await supabase.from('attendance').select('*');
    if (error) {
        console.error('Error fetching attendance records:', error);
        return [];
    }
    return data;
};

export const findAttendanceRecord = async (employeeName: string, date: string) => {
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee', employeeName)
        .eq('date', date)
        .eq('clockOut', '—')
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
        console.error('Error finding attendance record:', error);
    }
    return data;
};

export const addAttendanceRecord = async (record: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('attendance').insert([record]).select();
    if (error) {
        console.error('Error adding attendance record:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updateAttendanceRecord = async (id: string, updatedRecord: Partial<any>) => {
    const { error } = await supabase.from('attendance').update(updatedRecord).eq('id', id);
    if (error) {
        console.error('Error updating attendance record:', error);
    }
    return !error;
};
