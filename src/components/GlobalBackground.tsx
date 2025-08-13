import React from "react";

type Props = {
  watermark?: boolean;
};

export default function GlobalBackground({ watermark = true }: Props) {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
      // You can swap this to your favorite from /public
      style={{ backgroundImage: `url(/safari-background.jpg)` }}
    >
      {watermark && (
        <div className="absolute inset-0 pointer-events-none flex items-end justify-end p-6 opacity-20">
          <img
            src="/assets/branding/tagnetiq-q-watermark.svg"
            alt=""
            className="h-20 w-auto"
          />
        </div>
      )}
    </div>
  );
}
