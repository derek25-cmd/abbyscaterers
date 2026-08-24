"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase-client";
import { validateFile, formatFileSize, type UploadBucket } from "../../utils/upload";

type UploadStatus = "empty" | "dragging" | "uploading" | "complete" | "error";

interface UploadResponse {
  success: boolean;
  data?: { id: string; path: string; url: string | null };
  error?: string;
}

export function FileUpload({
  bucket,
  entityType,
  entityId,
  documentType,
  uploadedBy,
  accept,
  label,
  onUploadComplete,
}: {
  bucket: UploadBucket;
  entityType: "visit" | "company";
  entityId: string;
  documentType: string;
  uploadedBy: string;
  accept: string;
  label: string;
  onUploadComplete?: (result: { path: string; url: string | null }) => void;
}) {
  const [status, setStatus] = useState<UploadStatus>("empty");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    const validation = validateFile(file, bucket);
    if (!validation.valid) {
      setStatus("error");
      setErrorMessage(validation.error ?? "Invalid file");
      return;
    }

    setFileName(file.name);
    setStatus("uploading");
    setProgress(0);
    setErrorMessage("");

    const { data: { session } } = await supabase.auth.getSession();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    formData.append("entityType", entityType);
    formData.append("entityId", entityId);
    formData.append("documentType", documentType);
    formData.append("uploadedBy", uploadedBy);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/marketing/uploads");
    if (session?.access_token) {
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: UploadResponse | undefined;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = undefined;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data) {
        setStatus("complete");
        setProgress(100);
        onUploadComplete?.({ path: body.data.path, url: body.data.url });
      } else {
        setStatus("error");
        setErrorMessage(body?.error ?? `Upload failed (${xhr.status})`);
      }
    };

    xhr.onerror = () => {
      setStatus("error");
      setErrorMessage("Network error during upload");
    };

    xhr.send(formData);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const reset = () => {
    setStatus("empty");
    setProgress(0);
    setErrorMessage("");
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (status === "empty") setStatus("dragging"); }}
      onDragLeave={() => { if (status === "dragging") setStatus("empty"); }}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
        status === "dragging" && "border-primary bg-primary/5",
        status === "error" && "border-destructive bg-destructive/5",
        status === "complete" && "border-success bg-success/5",
        (status === "empty") && "border-muted-foreground/30 hover:border-muted-foreground/50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      {status === "empty" || status === "dragging" ? (
        <>
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Drag and drop, or click to browse</p>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
        </>
      ) : status === "uploading" ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="truncate text-sm font-medium">{fileName}</p>
          <Progress value={progress} className="w-full" />
          <p className="text-xs text-muted-foreground">{progress}%</p>
        </>
      ) : status === "complete" ? (
        <>
          <CheckCircle2 className="h-6 w-6 text-success" />
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">Uploaded</p>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <X className="mr-1 h-3.5 w-3.5" /> Replace
          </Button>
        </>
      ) : (
        <>
          <X className="h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}

export { formatFileSize };
