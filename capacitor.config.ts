import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "the.Ankapur.dhaba",
  appName: "The Ankapure Dhaba",
  webDir: "capacitor-www",
  server: {
    url: "https://theankapurdhaba.com",
    androidScheme: "https",
  },
};

export default config;
