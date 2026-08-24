
/**
 * Utility for detecting and interacting with the Tauri desktop environment.
 */

export const isTauri = () => {
  return typeof window !== 'undefined' && 
    (window as any).__TAURI__ !== undefined;
};

/**
 * Opens an external URL in the default system browser.
 */
export const openExternalLink = async (url: string) => {
  if (isTauri()) {
    try {
        // We use the custom 'open_link' command defined in Rust
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_link', { url });
    } catch (error) {
        console.error("Failed to open native link:", error);
        window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
};

/**
 * Returns the current application version from the native metadata.
 */
export const getTauriVersion = async () => {
  if (isTauri()) {
    try {
        const { getVersion } = await import('@tauri-apps/api/app');
        return await getVersion();
    } catch (e) {
        console.error("Failed to get Tauri version", e);
        return null;
    }
  }
  return null;
};
