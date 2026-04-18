"use client";
import { Video, ImageIcon } from "lucide-react";

export function VideoThumb({
  url,
  imageUrl,
}: {
  url: string | null;
  imageUrl?: string | null;
}) {
  if (url) {
    return (
      <div className="aspect-[9/16] bg-muted/40 grid place-items-center overflow-hidden">
        <video
          src={url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          onMouseEnter={(e) => {
            const v = e.currentTarget as HTMLVideoElement;
            v.play().catch(() => {});
          }}
          onMouseLeave={(e) => {
            const v = e.currentTarget as HTMLVideoElement;
            v.pause();
            v.currentTime = 0;
          }}
        />
      </div>
    );
  }
  if (imageUrl) {
    return (
      <div className="aspect-[9/16] bg-muted/40 grid place-items-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Ad hero" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="aspect-[9/16] bg-muted/40 grid place-items-center overflow-hidden">
      <Video className="size-8 text-foreground" />
      <span className="sr-only">
        <ImageIcon />
      </span>
    </div>
  );
}
