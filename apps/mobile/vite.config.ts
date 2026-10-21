import { defineConfig } from "vite";
import { one } from "one/vite";

export default defineConfig({
  plugins: [
    one({
      web: {
        defaultRenderMode: "spa",
      },

      native: {
        app: {
          name: "RagChat",
          icon: {
            source: "./public/app-icon.png",
            backgroundColor: "#000000",
          },
          splash: {
            source: "./public/splash.png",
            backgroundColor: "#000000",
            width: 200,
          },
          ios: {
            bundleId: "dev.arberihh.ragchat",
            deploymentTarget: "17.0",
          },
          android: { applicationId: "dev.arberihh.ragchat" },
        },
      },
    }),
  ],
});
