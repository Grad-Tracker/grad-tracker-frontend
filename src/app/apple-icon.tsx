import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="180"
        height="180"
        viewBox="0 0 512 512"
      >
        {/* White background for iOS */}
        <rect width="512" height="512" rx="96" fill="#ffffff" />
        {/* Graduation cap */}
        <polygon points="256,72 40,180 256,288 472,180" fill="#1E3A5F" />
        <rect x="236" y="218" width="40" height="130" fill="#1E3A5F" />
        <path
          d="M100,230 v90 q156,90 312,0 v-90"
          fill="none"
          stroke="#1E3A5F"
          strokeWidth="32"
          strokeLinecap="round"
        />
        <circle cx="442" cy="180" r="16" fill="#FBBF24" />
        <line
          x1="442"
          y1="180"
          x2="442"
          y2="360"
          stroke="#FBBF24"
          strokeWidth="18"
        />
        <circle cx="442" cy="380" r="24" fill="#FBBF24" />
      </svg>
    ),
    { ...size }
  );
}
