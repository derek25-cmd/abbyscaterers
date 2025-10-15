
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
import { Loader2, UploadCloud, Hash, RefreshCw } from "lucide-react";

type ImageKey = 'loginImageUrl' | 'headerUrl' | 'footerUrl' | 'signatureUrl';

export function SettingsPageComponent() {
    const { settings, updateSettings, isLoading: settingsLoading } = useSettingsStorage();
    const { toast } = useToast();
    const [uploading, setUploading] = useState<Partial<Record<ImageKey, boolean>>>({});
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

    const ImageUploader = ({ imageKey, label }: { imageKey: ImageKey, label: string }) => (
        <div className="space-y-2">
            <Label htmlFor={imageKey}>{label}</Label>
            <div className="flex items-center gap-4">
                <div className="w-32 h-20 rounded-md border flex items-center justify-center bg-muted/50 overflow-hidden">
                    {settings[imageKey] ? (
                        <Image src={settings[imageKey]!} alt={`${label} preview`} width={128} height={80} className="object-contain" />
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
                    {uploading[imageKey] ? "Uploading..." : "Change"}
                </Button>
            </div>
        </div>
    );

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
        </div>
    )
}
