
import { supabase } from '@/lib/supabase-client';

export const uploadFile = async (bucket: string, file: File, fileName: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
        });
    
    if (error) {
        console.error('Error uploading file:', error.message);
        return null;
    }

    const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
};

export const getPublicUrl = (bucket: string, fileName: string): string => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
}
