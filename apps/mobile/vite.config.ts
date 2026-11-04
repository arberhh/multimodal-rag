import { defineConfig } from "vite";
import { one } from "one/vite";

export default defineConfig({
  plugins: [
    one({
      web: {
        defaultRenderMode: "spa",
      },

      // ragchat:///chat?id=… opens that screen, for links and for driving the app in a check
      router: { linking: { scheme: "ragchat" } },

      native: {
        app: {
          name: "RagChat",
          scheme: "ragchat",
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
