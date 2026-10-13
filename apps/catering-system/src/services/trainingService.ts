
import { supabase } from '@/lib/supabase-client';
import { TrainingSession, TrainingEvaluation } from '@/types';
import { getEmployeeDirectory } from '@/services/employeeService';

export const getTrainingSessions = async (): Promise<TrainingSession[]> => {
    const { data, error } = await supabase.from('positions').select('*');
    if (error) {
        console.error('Error fetching training sessions:', error);
        return [];
    }
    return data as TrainingSession[];
};

export const addTrainingSession = async (session: Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<TrainingSession | null> => {
    const newSession = {
        ...session,
        id: `TRN-${Date.now().toString().slice(-6)}`
    };
    const { data, error } = await supabase.from('positions').insert([newSession]).select();
    if (error) {
        console.error('Error adding training session:', error);
        return null;
    }
    return data?.[0] as TrainingSession;
};

export const updateTrainingSession = async (id: string, updatedSession: Partial<TrainingSession>): Promise<boolean> => {
    const { error } = await supabase.from('positions').update(updatedSession).eq('id', id);
    if (error) {
        console.error('Error updating training session:', error);
    }
    return !error;
};

// Participant Management
export const getTrainingParticipants = async (trainingId: string): Promise<any[]> => {
    // Names come from the employee directory rather than an embedded
    // employees(...) join: plain staff have no SELECT on employees (it holds
    // salary/ID data), so the embed would silently return null names.
    const [{ data, error }, directory] = await Promise.all([
        supabase.from('training_participants').select('*').eq('training_id', trainingId),
        getEmployeeDirectory(),
    ]);

    if (error) {
        console.error('Error fetching training participants:', error);
        return [];
    }

    const names = new Map(directory.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
    return (data ?? []).map(p => ({
        ...p,
        employee_name: names.get(p.employee_id) ?? 'Unknown employee'
    }));
};

export const addTrainingParticipants = async (trainingId: string, employeeIds: string[]): Promise<boolean> => {
    const records = employeeIds.map(empId => ({
        training_id: trainingId,
        employee_id: empId,
        status: 'Enrolled'
    }));

    const { error } = await supabase.from('training_participants').upsert(records, { onConflict: 'training_id,employee_id' });
    
    if (error) {
        console.error('Error adding training participants:', error);
        return false;
    }

    // positions.applicants is maintained by the sync_training_applicants DB trigger.
    
    return true;
};

export const updateParticipantStatus = async (id: string, updates: any): Promise<boolean> => {
    const { error } = await supabase.from('training_participants').update(updates).eq('id', id);
    if (error) {
        console.error('Error updating participant status:', error);
    }
    return !error;
};

export const deleteParticipant = async (id: string, trainingId: string): Promise<boolean> => {
    const { error } = await supabase.from('training_participants').delete().eq('id', id);
    if (error) {
        console.error('Error deleting participant:', error);
        return false;
    }

    // positions.applicants is maintained by the sync_training_applicants DB trigger.

    return true;
};

// ===== EVALUATION MANAGEMENT =====

export const addTraineeEvaluation = async (evaluation: Omit<TrainingEvaluation, 'id' | 'created_at' | 'updated_at'>): Promise<TrainingEvaluation | null> => {
    const { data, error } = await supabase
        .from('training_evaluations')
        .insert([evaluation])
        .select()
        .single();

    if (error) {
        console.error('Error adding trainee evaluation:', error);
        return null;
    }
    return data as TrainingEvaluation;
};

export const addBulkEvaluations = async (evaluations: Omit<TrainingEvaluation, 'id' | 'created_at' | 'updated_at'>[]): Promise<boolean> => {
    const { error } = await supabase
        .from('training_evaluations')
        .insert(evaluations);

    if (error) {
        console.error('Error adding bulk evaluations:', error);
        return false;
    }
    return true;
};

export const getTraineeEvaluations = async (participantId: string): Promise<TrainingEvaluation[]> => {
    const { data, error } = await supabase
        .from('training_evaluations')
        .select('*')
        .eq('participant_id', participantId)
        .order('evaluation_date', { ascending: true });

    if (error) {
        console.error('Error fetching trainee evaluations:', error);
        return [];
    }
    return data as TrainingEvaluation[];
};

export const getEvaluationsBySession = async (trainingId: string): Promise<TrainingEvaluation[]> => {
    const { data, error } = await supabase
        .from('training_evaluations')
        .select('*')
        .eq('training_id', trainingId)
        .order('evaluation_date', { ascending: true });

    if (error) {
        console.error('Error fetching session evaluations:', error);
        return [];
    }
    return data as TrainingEvaluation[];
};

export const updateSessionStatus = async (id: string, status: 'Upcoming' | 'In Progress' | 'Completed'): Promise<boolean> => {
    const { error } = await supabase
        .from('positions')
        .update({ session_status: status })
        .eq('id', id);

    if (error) {
        console.error('Error updating session status:', error);
    }
    return !error;
};

export const getEvaluationsByDate = async (date: string): Promise<any[]> => {
    const [{ data, error }, directory] = await Promise.all([
        supabase
            .from('training_evaluations')
            .select(`
                *,
                training_participants:participant_id (employee_id),
                positions:training_id (title)
            `)
            .eq('evaluation_date', date)
            .order('created_at', { ascending: false }),
        getEmployeeDirectory(),
    ]);

    if (error) {
        console.error('Error fetching daily evaluations:', error);
        return [];
    }

    // Names from the directory, not an embedded employees(...) join — see getTrainingParticipants.
    const names = new Map(directory.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
    return (data ?? []).map(e => ({
        ...e,
        trainee_name: names.get(e.training_participants?.employee_id) ?? 'Unknown employee',
        training_title: e.positions?.title
    }));
};
