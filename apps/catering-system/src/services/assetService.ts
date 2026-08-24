
import { supabase } from '@/lib/supabase-client';
import { Asset, Branch } from '@/types';

export const getAssets = async (): Promise<Asset[]> => {
    const { data, error } = await supabase.from('assets').select('*');
    if (error) {
        console.error('Error fetching assets:', error);
        return [];
    }
    return data as Asset[];
};

export const addAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset | null> => {
    const { data, error } = await supabase.from('assets').insert([asset]).select();
    if (error) {
        console.error('Error adding asset:', error);
        return null;
    }
    return data?.[0] as Asset;
};

export const updateAsset = async (id: string, updatedAsset: Partial<Asset>): Promise<boolean> => {
    const { error } = await supabase.from('assets').update(updatedAsset).eq('id', id);
    if (error) {
        console.error('Error updating asset:', error);
    }
    return !error;
};

export const transferAsset = async (
    { assetId, quantity, fromBranch, toBranch }: { assetId: string, quantity: number, fromBranch: Branch, toBranch: Branch }
): Promise<boolean> => {
    const { data: sourceAsset, error: sourceError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single();

    if (sourceError || !sourceAsset) {
        console.error('Source asset not found for transfer:', sourceError);
        return false;
    }
    
    if(sourceAsset.quantity < quantity) {
        console.error('Not enough quantity to transfer');
        return false;
    }
    
    const { error: updateSourceError } = await supabase
        .from('assets')
        .update({ quantity: sourceAsset.quantity - quantity })
        .eq('id', assetId);

    if (updateSourceError) {
        console.error('Error updating source asset quantity:', updateSourceError);
        return false;
    }

    const { data: destinationAsset, error: destError } = await supabase
        .from('assets')
        .select('*')
        .eq('name', sourceAsset.name)
        .eq('type', sourceAsset.type)
        .eq('branch', toBranch)
        .single();
    
    if (destinationAsset) {
        // Update existing asset at destination
        const { error: updateDestError } = await supabase
            .from('assets')
            .update({ quantity: destinationAsset.quantity + quantity })
            .eq('id', destinationAsset.id);
        if (updateDestError) {
            console.error('Error updating destination asset quantity:', updateDestError);
            // Revert source asset quantity
             await supabase.from('assets').update({ quantity: sourceAsset.quantity }).eq('id', assetId);
            return false;
        }
    } else {
        // Create new asset at destination
        const { id, createdAt, updatedAt, ...newAssetData } = sourceAsset;
        const { error: insertDestError } = await supabase
            .from('assets')
            .insert([{ ...newAssetData, quantity: quantity, branch: toBranch }]);
        
        if (insertDestError) {
            console.error('Error creating new asset at destination:', insertDestError);
             // Revert source asset quantity
            await supabase.from('assets').update({ quantity: sourceAsset.quantity }).eq('id', assetId);
            return false;
        }
    }
    
    return true;
}
