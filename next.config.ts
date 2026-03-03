import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    TZ: "Asia/Seoul", // 한국 시간대 (UTC+9)
  },
};

// 서버 사이드 환경변수 설정
process.env.TZ = "Asia/Seoul";

export default nextConfig;
