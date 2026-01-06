import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

export function useMedia(filePath: string | null) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Reset state when file changes
    if (!filePath) {
      setThumbnailUrl(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const isVideo = /\.(mp4|mov|mkv|avi|webm)$/i.test(filePath);
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filePath);

    // 2. CASE: IMAGE (Direct Display)
    if (isImage) {
      setIsLoading(false);
      setError(null);
      // Directly convert the source path to an asset URL
      setThumbnailUrl(convertFileSrc(filePath));
      return;
    }

    // 3. CASE: VIDEO (Generate Thumbnail via Rust)
    if (isVideo) {
      let isMounted = true;
      setIsLoading(true);
      setError(null);
      setThumbnailUrl(null); // Clear previous image while loading

      async function fetchThumbnail() {
        try {
          // Ask Rust to run FFmpeg
          const absolutePath = await invoke<string>("generate_thumbnail", {
            path: filePath,
          });

          if (!isMounted) return;

          // Convert the generated thumbnail path to a URL
          const assetUrl = convertFileSrc(absolutePath);
          setThumbnailUrl(assetUrl);
        } catch (err) {
          if (isMounted) {
            console.error("Thumbnail generation failed:", err);
            setError(String(err));
            setThumbnailUrl(null);
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      }

      fetchThumbnail();

      return () => {
        isMounted = false;
      };
    }

    // 4. CASE: OTHER (Documents, etc.)
    setThumbnailUrl(null);
    setIsLoading(false);
  }, [filePath]);

  return { thumbnailUrl, isLoading, error };
}
