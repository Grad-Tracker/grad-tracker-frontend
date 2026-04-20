import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="512"
        height="512"
        viewBox="0 0 512 512"
      >
        {/* Graduation cap */}
        <polygon points="256,32 0,160 256,288 512,160" fill="#1E3A5F" />
        <rect x="232" y="208" width="48" height="160" fill="#1E3A5F" />
        <path
          d="M80,224 v112 q176,112 352,0 v-112"
          fill="none"
          stroke="#1E3A5F"
          strokeWidth="40"
          strokeLinecap="round"
        />
        <circle cx="480" cy="160" r="20" fill="#FBBF24" />
        <line
          x1="480"
          y1="160"
          x2="480"
          y2="384"
          stroke="#FBBF24"
          strokeWidth="24"
        />
        <circle cx="480" cy="408" r="32" fill="#FBBF24" />
      </svg>
    ),
    { ...size }
  );
}
