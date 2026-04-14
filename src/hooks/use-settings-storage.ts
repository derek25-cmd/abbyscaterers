
'use client';

import { useState, useEffect, useCallback } from 'react';

const SETTINGS_STORAGE_KEY = 'caterSmartAppSettings';

export interface AppSettings {
    loginImageUrl?: string;
    headerUrl?: string;
    footerUrl?: string;
    signatureUrl?: string;
    nextOrderNumber?: number;
    nextProformaNumber?: number;
    nextInvoiceNumber?: number;
    pdfScale?: number; // Added for PDF fitting
}

const defaultSettings: AppSettings = {
    loginImageUrl: "https://picsum.photos/seed/catering/1200/1800",
    headerUrl: "",
    footerUrl: "",
    signatureUrl: "",
    nextOrderNumber: 1,
    nextProformaNumber: 1,
    nextInvoiceNumber: 1,
    pdfScale: 2.0,
}

export function useSettingsStorage() {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
                if (storedSettings) {
                    const parsedSettings = JSON.parse(storedSettings);
                    // Ensure defaults are applied for any missing keys
                    setSettings({ ...defaultSettings, ...parsedSettings });
                } else {
                    setSettings(defaultSettings);
                }
            } catch (error) {
                console.error("Failed to parse settings from localStorage", error);
                setSettings(defaultSettings);
            }
            setIsLoading(false);
        }
    }, []);

    const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
        if (typeof window !== "undefined") {
            setSettings(prevSettings => {
                const updated = { ...prevSettings, ...newSettings };
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
                return updated;
            });
        }
    }, []);

    return { settings, isLoading, updateSettings };
}
