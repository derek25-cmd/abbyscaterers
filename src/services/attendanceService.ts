
import { supabase } from '@/lib/supabase-client';
import { Attendance } from '@/types';

export const getAttendanceRecords = async (): Promise<Attendance[]> => {
    const { data, error } = await supabase.from('attendance').select('*').order('date', { ascending: false });
    if (error) {
        console.error('Error fetching attendance records:', error);
        return [];
    }
    return data as Attendance[];
};

export const getAttendanceByDate = async (date: string): Promise<Attendance[]> => {
    const { data, error } = await supabase.from('attendance').select('*').eq('date', date);
    if (error) {
        console.error('Error fetching attendance by date:', error);
        return [];
    }
    return data as Attendance[];
};

export const findAttendanceRecord = async (employeeId: string, date: string): Promise<Attendance | null> => {
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
        console.error('Error finding attendance record:', error);
    }
    return data as Attendance | null;
};

export const upsertAttendanceRecord = async (record: Partial<Attendance>): Promise<Attendance | null> => {
    const { data, error } = await supabase
        .from('attendance')
        .upsert([{
            ...record,
            updatedAt: new Date().toISOString()
        }], { 
            onConflict: 'employee_id,date' 
        })
        .select();

    if (error) {
        console.error('Error upserting attendance record:', error);
        return null;
    }
    return data?.[0] as Attendance;
};

export const upsertAttendanceRecords = async (records: Partial<Attendance>[]): Promise<Attendance[] | null> => {
    const { data, error } = await supabase
        .from('attendance')
        .upsert(records.map(r => ({
            ...r,
            updatedAt: new Date().toISOString()
        })), { 
            onConflict: 'employee_id,date' 
        })
        .select();

    if (error) {
        console.error('Error upserting attendance records:', error);
        return null;
    }
    return data as Attendance[];
};

export const deleteAttendanceRecord = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) {
        console.error('Error deleting attendance record:', error);
    }
    return !error;
};
