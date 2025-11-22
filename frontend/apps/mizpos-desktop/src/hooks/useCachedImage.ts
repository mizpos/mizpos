import { useEffect, useState } from "react";
import { getCachedImage } from "../lib/db";

export function useCachedImage(url: string | undefined): string | undefined {
  const [imageUrl, setImageUrl] = useState<string | undefined>(url);

  useEffect(() => {
    if (!url) {
      setImageUrl(undefined);
      return;
    }

    let objectUrl: string | undefined;
    let isMounted = true;

    const loadImage = async () => {
      try {
        const cached = await getCachedImage(url);
        if (cached && isMounted) {
          objectUrl = URL.createObjectURL(cached);
          setImageUrl(objectUrl);
        } else if (isMounted) {
          // キャッシュがない場合は元のURLを使用
          setImageUrl(url);
        }
      } catch (error) {
        console.error("Failed to load cached image:", error);
        if (isMounted) {
          setImageUrl(url);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      // Object URLをクリーンアップ
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return imageUrl;
}
