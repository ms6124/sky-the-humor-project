"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
];

const ACCEPT_TYPES = ALLOWED_TYPES.join(",");

function normalizeCaptions(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];

  const candidates = (payload as { captions?: unknown; data?: unknown }).captions ??
    (payload as { data?: unknown }).data ??
    payload;

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return null;
      const record = item as { caption?: unknown; content?: unknown; text?: unknown };
      return (
        (typeof record.caption === "string" && record.caption) ||
        (typeof record.content === "string" && record.content) ||
        (typeof record.text === "string" && record.text) ||
        null
      );
    })
    .filter((value): value is string => Boolean(value));
}

export default function CaptionPipelineClient() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supportedTypes = useMemo(
    () => ALLOWED_TYPES.map((type) => type.replace("image/", "")).join(", "),
    []
  );

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setCaptions([]);
    setUploadedUrl(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleGenerateCaptions = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Choose an image before generating captions.");
      return;
    }

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setErrorMessage(
        `Unsupported file type. Please use ${supportedTypes.replace(/, ([^,]*)$/, ", or $1")}.`
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage("Requesting an upload URL...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error(sessionError?.message ?? "Missing access token.");
      }

      const presignedResponse = await fetch(
        "https://api.almostcrackd.ai/pipeline/generate-presigned-url",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contentType: selectedFile.type }),
        }
      );

      if (!presignedResponse.ok) {
        const detail = await presignedResponse.text();
        throw new Error(detail || "Failed to generate presigned URL.");
      }

      const { presignedUrl, cdnUrl } = (await presignedResponse.json()) as {
        presignedUrl?: string;
        cdnUrl?: string;
      };

      if (!presignedUrl || !cdnUrl) {
        throw new Error("Presigned URL response was incomplete.");
      }

      setStatusMessage("Uploading image bytes...");
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        const detail = await uploadResponse.text();
        throw new Error(detail || "Failed to upload image bytes.");
      }

      setStatusMessage("Registering the uploaded image...");
      const registerResponse = await fetch(
        "https://api.almostcrackd.ai/pipeline/upload-image-from-url",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
        }
      );

      if (!registerResponse.ok) {
        const detail = await registerResponse.text();
        throw new Error(detail || "Failed to register image with pipeline.");
      }

      const { imageId } = (await registerResponse.json()) as {
        imageId?: string;
      };

      if (!imageId) {
        throw new Error("Image registration response was missing an imageId.");
      }

      setStatusMessage("Generating captions...");
      const captionsResponse = await fetch(
        "https://api.almostcrackd.ai/pipeline/generate-captions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageId }),
        }
      );

      if (!captionsResponse.ok) {
        const detail = await captionsResponse.text();
        throw new Error(detail || "Failed to generate captions.");
      }

      const captionsPayload = await captionsResponse.json();
      const nextCaptions = normalizeCaptions(captionsPayload);

      setUploadedUrl(cdnUrl);
      setCaptions(nextCaptions);
      setStatusMessage(nextCaptions.length ? "Captions ready." : "No captions returned.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="card uploadCard">
      <div className="cardHeader">
        <span>Caption pipeline</span>
        <span className="pill">Upload + generate</span>
      </div>
      <p className="subtitle">
        Upload an image, then let the staging pipeline generate fresh caption ideas.
      </p>
      <form className="uploadForm" onSubmit={handleGenerateCaptions}>
        <div className="uploadField">
          <label className="uploadLabel" htmlFor="caption-upload">
            Image file
          </label>
          <input
            id="caption-upload"
            className="fileInput"
            type="file"
            accept={ACCEPT_TYPES}
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <span className="uploadHint">Supported: {supportedTypes}</span>
        </div>
        <button className="button" type="submit" disabled={isLoading}>
          {isLoading ? "Working..." : "Generate captions"}
        </button>
      </form>
      <div className="statusRow">
        {statusMessage ? <span className="statusText">{statusMessage}</span> : null}
        {errorMessage ? <span className="formError">{errorMessage}</span> : null}
      </div>
      {uploadedUrl || previewUrl ? (
        <div className="imagePreview">
          <img
            src={uploadedUrl ?? previewUrl ?? ""}
            alt="Uploaded preview"
            className="previewImage"
          />
          {uploadedUrl ? (
            <span className="uploadUrl">CDN: {uploadedUrl}</span>
          ) : null}
        </div>
      ) : null}
      {captions.length ? (
        <div className="captionResults">
          <span className="captionResultsLabel">Generated captions</span>
          <ul className="captionResultList">
            {captions.map((caption, index) => (
              <li className="captionResult" key={`${caption}-${index}`}>
                {caption}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
