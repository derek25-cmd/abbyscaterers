
"use client";

import React, { useState, useRef, ChangeEvent, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStorage, AppSettings } from "@/hooks/use-settings-storage";
import { uploadFile } from "@/services/storageService";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Loader2, UploadCloud, Hash, RefreshCw, FileType, Trash2 } from "lucide-react";
import { getLatestOrderNumber } from "@/services/orderService";
import { getLatestProformaNumber } from "@/services/proformaInvoiceService";
import { getLatestInvoiceNumber } from "@/services/invoiceService";
import { Slider } from "@/components/ui/slider";

type ImageKey = 'loginImageUrl' | 'headerUrl' | 'footerUrl' | 'signatureUrl';
type SequenceKey = 'nextOrderNumber' | 'nextProformaNumber' | 'nextInvoiceNumber';

export function SettingsPageComponent() {
    const { settings, updateSettings, isLoading: settingsLoading } = useSettingsStorage();
    const { toast } = useToast();
    const [uploading, setUploading] = useState<Partial<Record<ImageKey, boolean>>>({});
    const [syncing, setSyncing] = useState<Partial<Record<SequenceKey, boolean>>>({});
    const [localSettings, setLocalSettings] = useState<AppSettings>({});

    useEffect(() => {
        if (!settingsLoading) {
            setLocalSettings(settings);
        }
    }, [settings, settingsLoading]);


    const fileInputRefs = {
        loginImageUrl: useRef<HTMLInputElement>(null),
        headerUrl: useRef<HTMLInputElement>(null),
        footerUrl: useRef<HTMLInputElement>(null),
        signatureUrl: useRef<HTMLInputElement>(null),
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, imageKey: ImageKey) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(prev => ({ ...prev, [imageKey]: true }));

        try {
            const fileName = `${imageKey}-${Date.now()}-${file.name}`;
            const publicUrl = await uploadFile('abbys catersmart', file, fileName);

            if (publicUrl) {
                updateSettings({ [imageKey]: publicUrl });
                toast({
                    title: "Upload Successful",
                    description: `The ${imageKey.replace('Url', '')} image has been updated.`,
                });
            } else {
                throw new Error("Failed to get public URL.");
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: "There was an error uploading your image. Please try again.",
            });
        } finally {
            setUploading(prev => ({ ...prev, [imageKey]: false }));
        }
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numValue = parseInt(value, 10);
        if(!isNaN(numValue)){
            setLocalSettings(prev => ({...prev, [name]: numValue}))
        }
    }
    
    const handleSaveSequences = () => {
        updateSettings({ 
            nextOrderNumber: localSettings.nextOrderNumber,
            nextProformaNumber: localSettings.nextProformaNumber,
            nextInvoiceNumber: localSettings.nextInvoiceNumber,
        });
        toast({ title: "Settings Saved", description: "Numbering sequences have been updated." });
    };

    const handleSync = async (sequenceKey: SequenceKey) => {
        setSyncing(prev => ({ ...prev, [sequenceKey]: true }));
        try {
            let nextNumber: number | undefined;
            if (sequenceKey === 'nextOrderNumber') {
                nextNumber = await getLatestOrderNumber();
            } else if (sequenceKey === 'nextProformaNumber') {
                nextNumber = await getLatestProformaNumber();
            } else if (sequenceKey === 'nextInvoiceNumber') {
                nextNumber = await getLatestInvoiceNumber();
            }
            
            if (nextNumber !== undefined) {
                updateSettings({ [sequenceKey]: nextNumber });
                setLocalSettings(prev => ({...prev, [sequenceKey]: nextNumber}));
                toast({ title: "Sync Successful", description: `${sequenceKey} has been updated to ${nextNumber}.` });
            } else {
                throw new Error("Could not determine next number.");
            }

        } catch (error) {
            console.error("Sync error:", error);
            toast({
                variant: "destructive",
                title: "Sync Failed",
                description: "Could not sync with the database. Please try again.",
            });
        } finally {
            setSyncing(prev => ({ ...prev, [sequenceKey]: false }));
        }
    }

    const handleRemoveImage = (imageKey: ImageKey) => {
        updateSettings({ [imageKey]: null });
        toast({
            title: "Image Removed",
            description: `The ${imageKey.replace('Url', '')} image has been cleared.`,
        });
    };

    const ImageUploader = ({ imageKey, label }: { imageKey: ImageKey, label: string }) => (
        <div className="space-y-2">
            <Label htmlFor={imageKey}>{label}</Label>
            <div className="flex items-center gap-4">
                <div className="w-32 h-20 rounded-md border flex items-center justify-center bg-muted/50 overflow-hidden relative group">
                    {settings[imageKey] ? (
                        <>
                            <Image src={settings[imageKey]!} alt={`${label} preview`} width={128} height={80} className="object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button 
                                    size="icon" 
                                    variant="destructive" 
                                    className="h-8 w-8 rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveImage(imageKey);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </>
                    ) : (
                        <span className="text-xs text-muted-foreground">No Image</span>
                    )}
                </div>
                <Input
                    id={imageKey}
                    type="file"
                    accept="image/*"
                    ref={fileInputRefs[imageKey]}
                    onChange={(e) => handleFileChange(e, imageKey)}
                    className="hidden"
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRefs[imageKey]?.current?.click()}
                    disabled={uploading[imageKey]}
                >
                    {uploading[imageKey] ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <UploadCloud className="mr-2 h-4 w-4" />
                    )}
                    {uploading[imageKey] ? "Uploading..." : settings[imageKey] ? "Change" : "Upload"}
                </Button>
            </div>
        </div>
    );

    const SequenceInput = ({ seqKey, label, helpText }: { seqKey: SequenceKey, label: string, helpText: string}) => (
        <div className="space-y-2">
            <Label htmlFor={seqKey} className="flex items-center"><Hash className="w-4 h-4 mr-2"/>{label}</Label>
             <div className="flex items-center gap-2">
                <Input
                    id={seqKey}
                    name={seqKey}
                    type="number"
                    value={localSettings[seqKey] || 1}
                    onChange={handleNumberChange}
                    min="1"
                />
                <Button variant="outline" size="icon" onClick={() => handleSync(seqKey)} disabled={syncing[seqKey]}>
                    {syncing[seqKey] ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="sr-only">Sync with database</span>
                </Button>
            </div>
             <p className="text-xs text-muted-foreground">{helpText}{String(localSettings[seqKey] || 1).padStart(5, '0')}</p>
        </div>
    )


    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Application Settings
            </h1>

            <Card>
                <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Customize the look of your application, including the login screen and invoice templates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ImageUploader imageKey="loginImageUrl" label="Login Screen Image" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Invoice & Proforma Customization</CardTitle>
                    <CardDescription>Upload images to be displayed on your generated PDF documents.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ImageUploader imageKey="headerUrl" label="Header Image" />
                    <ImageUploader imageKey="footerUrl" label="Footer Image" />
                    <ImageUploader imageKey="signatureUrl" label="Signature Image" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileType className="h-5 w-5"/>PDF Generation Settings</CardTitle>
                    <CardDescription>Adjust the scaling of generated PDF documents to ensure contents fit the page perfectly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <Label>Content Scale Factor</Label>
                            <span className="text-sm font-mono font-bold text-primary">{(localSettings.pdfScale || 2.0).toFixed(1)}x</span>
                        </div>
                        <Slider 
                            value={[localSettings.pdfScale || 2.0]} 
                            min={1.0} 
                            max={4.0} 
                            step={0.1} 
                            onValueChange={([val]) => setLocalSettings(prev => ({...prev, pdfScale: val}))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Higher values increase resolution but might make content overflow. Lower values make content smaller to fit more on one page. (Default: 2.0)
                        </p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={() => {
                        updateSettings({ pdfScale: localSettings.pdfScale });
                        toast({ title: "Settings Saved", description: "PDF scaling settings updated." });
                    }}>Save PDF Settings</Button>
                </CardFooter>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Numbering Sequences</CardTitle>
                    <CardDescription>
                        Set the starting number for automatically generated IDs. Use the sync button to fetch the latest number from the database.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                     <SequenceInput seqKey="nextOrderNumber" label="Next Order Number" helpText="The next order created will be assigned ID: ORD-" />
                     <SequenceInput seqKey="nextProformaNumber" label="Next Proforma Number" helpText="The next proforma created will be assigned ID: " />
                     <SequenceInput seqKey="nextInvoiceNumber" label="Next Invoice Number" helpText="The next invoice created will be assigned ID: " />
                </CardContent>
                 <CardFooter>
                    <Button onClick={handleSaveSequences}>Save Sequences</Button>
                </CardFooter>
            </Card>
        </div>
    )
}
