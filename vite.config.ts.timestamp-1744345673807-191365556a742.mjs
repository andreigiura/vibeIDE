// vite.config.ts
import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from "file:///Users/giuraandrei/devrel/vibechain/bolt.diy/node_modules/.pnpm/@remix-run+dev@2.16.3_@remix-run+react@2.16.3_react-dom@18.3.1_react@18.3.1__react@18.3.1_typ_56tyhioi4fkoibvrjndu6yshyi/node_modules/@remix-run/dev/dist/index.js";
import UnoCSS from "file:///Users/giuraandrei/devrel/vibechain/bolt.diy/node_modules/.pnpm/unocss@0.61.9_postcss@8.5.3_rollup@4.38.0_vite@5.4.15_@types+node@22.13.14_sass-embedded@1.86.0_/node_modules/unocss/dist/vite.mjs";
import { defineConfig } from "file:///Users/giuraandrei/devrel/vibechain/bolt.diy/node_modules/.pnpm/vite@5.4.15_@types+node@22.13.14_sass-embedded@1.86.0/node_modules/vite/dist/node/index.js";
import { nodePolyfills } from "file:///Users/giuraandrei/devrel/vibechain/bolt.diy/node_modules/.pnpm/vite-plugin-node-polyfills@0.22.0_rollup@4.38.0_vite@5.4.15_@types+node@22.13.14_sass-embedded@1.86.0_/node_modules/vite-plugin-node-polyfills/dist/index.js";
import { optimizeCssModules } from "file:///Users/giuraandrei/devrel/vibechain/bolt.diy/node_modules/.pnpm/vite-plugin-optimize-css-modules@1.2.0_vite@5.4.15_@types+node@22.13.14_sass-embedded@1.86.0_/node_modules/vite-plugin-optimize-css-modules/dist/index.mjs";
import tsconfigPaths from "file:///Users/giuraandrei/devrel/vibechain/bolt.diy/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_typescript@5.8.2_vite@5.4.15_@types+node@22.13.14_sass-embedded@1.86.0_/node_modules/vite-tsconfig-paths/dist/index.mjs";
import * as dotenv from "file:///Users/giuraandrei/devrel/vibechain/bolt.diy/node_modules/.pnpm/dotenv@16.4.7/node_modules/dotenv/lib/main.js";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
dotenv.config();
var getGitInfo = () => {
  try {
    return {
      commitHash: execSync("git rev-parse --short HEAD").toString().trim(),
      branch: execSync("git rev-parse --abbrev-ref HEAD").toString().trim(),
      commitTime: execSync("git log -1 --format=%cd").toString().trim(),
      author: execSync("git log -1 --format=%an").toString().trim(),
      email: execSync("git log -1 --format=%ae").toString().trim(),
      remoteUrl: execSync("git config --get remote.origin.url").toString().trim(),
      repoName: execSync("git config --get remote.origin.url").toString().trim().replace(/^.*github.com[:/]/, "").replace(/\.git$/, "")
    };
  } catch {
    return {
      commitHash: "no-git-info",
      branch: "unknown",
      commitTime: "unknown",
      author: "unknown",
      email: "unknown",
      remoteUrl: "unknown",
      repoName: "unknown"
    };
  }
};
var getPackageJson = () => {
  try {
    const pkgPath = join(process.cwd(), "package.json");
    const pkg2 = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return {
      name: pkg2.name,
      description: pkg2.description,
      license: pkg2.license,
      dependencies: pkg2.dependencies || {},
      devDependencies: pkg2.devDependencies || {},
      peerDependencies: pkg2.peerDependencies || {},
      optionalDependencies: pkg2.optionalDependencies || {}
    };
  } catch {
    return {
      name: "bolt.diy",
      description: "A DIY LLM interface",
      license: "MIT",
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {}
    };
  }
};
var pkg = getPackageJson();
var gitInfo = getGitInfo();
var vite_config_default = defineConfig((config2) => {
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(gitInfo.commitHash),
      __GIT_BRANCH: JSON.stringify(gitInfo.branch),
      __GIT_COMMIT_TIME: JSON.stringify(gitInfo.commitTime),
      __GIT_AUTHOR: JSON.stringify(gitInfo.author),
      __GIT_EMAIL: JSON.stringify(gitInfo.email),
      __GIT_REMOTE_URL: JSON.stringify(gitInfo.remoteUrl),
      __GIT_REPO_NAME: JSON.stringify(gitInfo.repoName),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
      __PKG_NAME: JSON.stringify(pkg.name),
      __PKG_DESCRIPTION: JSON.stringify(pkg.description),
      __PKG_LICENSE: JSON.stringify(pkg.license),
      __PKG_DEPENDENCIES: JSON.stringify(pkg.dependencies),
      __PKG_DEV_DEPENDENCIES: JSON.stringify(pkg.devDependencies),
      __PKG_PEER_DEPENDENCIES: JSON.stringify(pkg.peerDependencies),
      __PKG_OPTIONAL_DEPENDENCIES: JSON.stringify(pkg.optionalDependencies),
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
    },
    build: {
      target: "esnext"
    },
    plugins: [
      nodePolyfills({
        include: ["buffer", "process", "util", "stream"],
        globals: {
          Buffer: true,
          process: true,
          global: true
        },
        protocolImports: true,
        exclude: ["child_process", "fs", "path"]
      }),
      {
        name: "buffer-polyfill",
        transform(code, id) {
          if (id.includes("env.mjs")) {
            return {
              code: `import { Buffer } from 'buffer';
${code}`,
              map: null
            };
          }
          return null;
        }
      },
      config2.mode !== "test" && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true
        }
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config2.mode === "production" && optimizeCssModules({ apply: "build" })
    ],
    envPrefix: [
      "VITE_",
      "OPENAI_LIKE_API_BASE_URL",
      "OLLAMA_API_BASE_URL",
      "LMSTUDIO_API_BASE_URL",
      "TOGETHER_API_BASE_URL"
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler"
        }
      }
    }
  };
});
function chrome129IssuePlugin() {
  return {
    name: "chrome129IssuePlugin",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers["user-agent"]?.match(/Chrom(e|ium)\/([0-9]+)\./);
        if (raw) {
          const version = parseInt(raw[2], 10);
          if (version === 129) {
            res.setHeader("content-type", "text/html");
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>'
            );
            return;
          }
        }
        next();
      });
    }
  };
}
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZ2l1cmFhbmRyZWkvZGV2cmVsL3ZpYmVjaGFpbi9ib2x0LmRpeVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2dpdXJhYW5kcmVpL2RldnJlbC92aWJlY2hhaW4vYm9sdC5kaXkvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2dpdXJhYW5kcmVpL2RldnJlbC92aWJlY2hhaW4vYm9sdC5kaXkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBjbG91ZGZsYXJlRGV2UHJveHlWaXRlUGx1Z2luIGFzIHJlbWl4Q2xvdWRmbGFyZURldlByb3h5LCB2aXRlUGx1Z2luIGFzIHJlbWl4Vml0ZVBsdWdpbiB9IGZyb20gJ0ByZW1peC1ydW4vZGV2JztcbmltcG9ydCBVbm9DU1MgZnJvbSAndW5vY3NzL3ZpdGUnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnLCB0eXBlIFZpdGVEZXZTZXJ2ZXIgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscyc7XG5pbXBvcnQgeyBvcHRpbWl6ZUNzc01vZHVsZXMgfSBmcm9tICd2aXRlLXBsdWdpbi1vcHRpbWl6ZS1jc3MtbW9kdWxlcyc7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJztcbmltcG9ydCAqIGFzIGRvdGVudiBmcm9tICdkb3RlbnYnO1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcblxuZG90ZW52LmNvbmZpZygpO1xuXG4vLyBHZXQgZGV0YWlsZWQgZ2l0IGluZm8gd2l0aCBmYWxsYmFja3NcbmNvbnN0IGdldEdpdEluZm8gPSAoKSA9PiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1pdEhhc2g6IGV4ZWNTeW5jKCdnaXQgcmV2LXBhcnNlIC0tc2hvcnQgSEVBRCcpLnRvU3RyaW5nKCkudHJpbSgpLFxuICAgICAgYnJhbmNoOiBleGVjU3luYygnZ2l0IHJldi1wYXJzZSAtLWFiYnJldi1yZWYgSEVBRCcpLnRvU3RyaW5nKCkudHJpbSgpLFxuICAgICAgY29tbWl0VGltZTogZXhlY1N5bmMoJ2dpdCBsb2cgLTEgLS1mb3JtYXQ9JWNkJykudG9TdHJpbmcoKS50cmltKCksXG4gICAgICBhdXRob3I6IGV4ZWNTeW5jKCdnaXQgbG9nIC0xIC0tZm9ybWF0PSVhbicpLnRvU3RyaW5nKCkudHJpbSgpLFxuICAgICAgZW1haWw6IGV4ZWNTeW5jKCdnaXQgbG9nIC0xIC0tZm9ybWF0PSVhZScpLnRvU3RyaW5nKCkudHJpbSgpLFxuICAgICAgcmVtb3RlVXJsOiBleGVjU3luYygnZ2l0IGNvbmZpZyAtLWdldCByZW1vdGUub3JpZ2luLnVybCcpLnRvU3RyaW5nKCkudHJpbSgpLFxuICAgICAgcmVwb05hbWU6IGV4ZWNTeW5jKCdnaXQgY29uZmlnIC0tZ2V0IHJlbW90ZS5vcmlnaW4udXJsJylcbiAgICAgICAgLnRvU3RyaW5nKClcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAucmVwbGFjZSgvXi4qZ2l0aHViLmNvbVs6L10vLCAnJylcbiAgICAgICAgLnJlcGxhY2UoL1xcLmdpdCQvLCAnJyksXG4gICAgfTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1pdEhhc2g6ICduby1naXQtaW5mbycsXG4gICAgICBicmFuY2g6ICd1bmtub3duJyxcbiAgICAgIGNvbW1pdFRpbWU6ICd1bmtub3duJyxcbiAgICAgIGF1dGhvcjogJ3Vua25vd24nLFxuICAgICAgZW1haWw6ICd1bmtub3duJyxcbiAgICAgIHJlbW90ZVVybDogJ3Vua25vd24nLFxuICAgICAgcmVwb05hbWU6ICd1bmtub3duJyxcbiAgICB9O1xuICB9XG59O1xuXG4vLyBSZWFkIHBhY2thZ2UuanNvbiB3aXRoIGRldGFpbGVkIGRlcGVuZGVuY3kgaW5mb1xuY29uc3QgZ2V0UGFja2FnZUpzb24gPSAoKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgcGtnUGF0aCA9IGpvaW4ocHJvY2Vzcy5jd2QoKSwgJ3BhY2thZ2UuanNvbicpO1xuICAgIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKHBrZ1BhdGgsICd1dGYtOCcpKTtcblxuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiBwa2cubmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBwa2cuZGVzY3JpcHRpb24sXG4gICAgICBsaWNlbnNlOiBwa2cubGljZW5zZSxcbiAgICAgIGRlcGVuZGVuY2llczogcGtnLmRlcGVuZGVuY2llcyB8fCB7fSxcbiAgICAgIGRldkRlcGVuZGVuY2llczogcGtnLmRldkRlcGVuZGVuY2llcyB8fCB7fSxcbiAgICAgIHBlZXJEZXBlbmRlbmNpZXM6IHBrZy5wZWVyRGVwZW5kZW5jaWVzIHx8IHt9LFxuICAgICAgb3B0aW9uYWxEZXBlbmRlbmNpZXM6IHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyB8fCB7fSxcbiAgICB9O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogJ2JvbHQuZGl5JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQSBESVkgTExNIGludGVyZmFjZScsXG4gICAgICBsaWNlbnNlOiAnTUlUJyxcbiAgICAgIGRlcGVuZGVuY2llczoge30sXG4gICAgICBkZXZEZXBlbmRlbmNpZXM6IHt9LFxuICAgICAgcGVlckRlcGVuZGVuY2llczoge30sXG4gICAgICBvcHRpb25hbERlcGVuZGVuY2llczoge30sXG4gICAgfTtcbiAgfVxufTtcblxuY29uc3QgcGtnID0gZ2V0UGFja2FnZUpzb24oKTtcbmNvbnN0IGdpdEluZm8gPSBnZXRHaXRJbmZvKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoY29uZmlnKSA9PiB7XG4gIHJldHVybiB7XG4gICAgZGVmaW5lOiB7XG4gICAgICBfX0NPTU1JVF9IQVNIOiBKU09OLnN0cmluZ2lmeShnaXRJbmZvLmNvbW1pdEhhc2gpLFxuICAgICAgX19HSVRfQlJBTkNIOiBKU09OLnN0cmluZ2lmeShnaXRJbmZvLmJyYW5jaCksXG4gICAgICBfX0dJVF9DT01NSVRfVElNRTogSlNPTi5zdHJpbmdpZnkoZ2l0SW5mby5jb21taXRUaW1lKSxcbiAgICAgIF9fR0lUX0FVVEhPUjogSlNPTi5zdHJpbmdpZnkoZ2l0SW5mby5hdXRob3IpLFxuICAgICAgX19HSVRfRU1BSUw6IEpTT04uc3RyaW5naWZ5KGdpdEluZm8uZW1haWwpLFxuICAgICAgX19HSVRfUkVNT1RFX1VSTDogSlNPTi5zdHJpbmdpZnkoZ2l0SW5mby5yZW1vdGVVcmwpLFxuICAgICAgX19HSVRfUkVQT19OQU1FOiBKU09OLnN0cmluZ2lmeShnaXRJbmZvLnJlcG9OYW1lKSxcbiAgICAgIF9fQVBQX1ZFUlNJT046IEpTT04uc3RyaW5naWZ5KHByb2Nlc3MuZW52Lm5wbV9wYWNrYWdlX3ZlcnNpb24pLFxuICAgICAgX19QS0dfTkFNRTogSlNPTi5zdHJpbmdpZnkocGtnLm5hbWUpLFxuICAgICAgX19QS0dfREVTQ1JJUFRJT046IEpTT04uc3RyaW5naWZ5KHBrZy5kZXNjcmlwdGlvbiksXG4gICAgICBfX1BLR19MSUNFTlNFOiBKU09OLnN0cmluZ2lmeShwa2cubGljZW5zZSksXG4gICAgICBfX1BLR19ERVBFTkRFTkNJRVM6IEpTT04uc3RyaW5naWZ5KHBrZy5kZXBlbmRlbmNpZXMpLFxuICAgICAgX19QS0dfREVWX0RFUEVOREVOQ0lFUzogSlNPTi5zdHJpbmdpZnkocGtnLmRldkRlcGVuZGVuY2llcyksXG4gICAgICBfX1BLR19QRUVSX0RFUEVOREVOQ0lFUzogSlNPTi5zdHJpbmdpZnkocGtnLnBlZXJEZXBlbmRlbmNpZXMpLFxuICAgICAgX19QS0dfT1BUSU9OQUxfREVQRU5ERU5DSUVTOiBKU09OLnN0cmluZ2lmeShwa2cub3B0aW9uYWxEZXBlbmRlbmNpZXMpLFxuICAgICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYuTk9ERV9FTlYpLFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIHRhcmdldDogJ2VzbmV4dCcsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBub2RlUG9seWZpbGxzKHtcbiAgICAgICAgaW5jbHVkZTogWydidWZmZXInLCAncHJvY2VzcycsICd1dGlsJywgJ3N0cmVhbSddLFxuICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgQnVmZmVyOiB0cnVlLFxuICAgICAgICAgIHByb2Nlc3M6IHRydWUsXG4gICAgICAgICAgZ2xvYmFsOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBwcm90b2NvbEltcG9ydHM6IHRydWUsXG4gICAgICAgIGV4Y2x1ZGU6IFsnY2hpbGRfcHJvY2VzcycsICdmcycsICdwYXRoJ10sXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ2J1ZmZlci1wb2x5ZmlsbCcsXG4gICAgICAgIHRyYW5zZm9ybShjb2RlLCBpZCkge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZW52Lm1qcycpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb2RlOiBgaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSAnYnVmZmVyJztcXG4ke2NvZGV9YCxcbiAgICAgICAgICAgICAgbWFwOiBudWxsLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjb25maWcubW9kZSAhPT0gJ3Rlc3QnICYmIHJlbWl4Q2xvdWRmbGFyZURldlByb3h5KCksXG4gICAgICByZW1peFZpdGVQbHVnaW4oe1xuICAgICAgICBmdXR1cmU6IHtcbiAgICAgICAgICB2M19mZXRjaGVyUGVyc2lzdDogdHJ1ZSxcbiAgICAgICAgICB2M19yZWxhdGl2ZVNwbGF0UGF0aDogdHJ1ZSxcbiAgICAgICAgICB2M190aHJvd0Fib3J0UmVhc29uOiB0cnVlLFxuICAgICAgICAgIHYzX2xhenlSb3V0ZURpc2NvdmVyeTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgVW5vQ1NTKCksXG4gICAgICB0c2NvbmZpZ1BhdGhzKCksXG4gICAgICBjaHJvbWUxMjlJc3N1ZVBsdWdpbigpLFxuICAgICAgY29uZmlnLm1vZGUgPT09ICdwcm9kdWN0aW9uJyAmJiBvcHRpbWl6ZUNzc01vZHVsZXMoeyBhcHBseTogJ2J1aWxkJyB9KSxcbiAgICBdLFxuICAgIGVudlByZWZpeDogW1xuICAgICAgJ1ZJVEVfJyxcbiAgICAgICdPUEVOQUlfTElLRV9BUElfQkFTRV9VUkwnLFxuICAgICAgJ09MTEFNQV9BUElfQkFTRV9VUkwnLFxuICAgICAgJ0xNU1RVRElPX0FQSV9CQVNFX1VSTCcsXG4gICAgICAnVE9HRVRIRVJfQVBJX0JBU0VfVVJMJyxcbiAgICBdLFxuICAgIGNzczoge1xuICAgICAgcHJlcHJvY2Vzc29yT3B0aW9uczoge1xuICAgICAgICBzY3NzOiB7XG4gICAgICAgICAgYXBpOiAnbW9kZXJuLWNvbXBpbGVyJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuXG5mdW5jdGlvbiBjaHJvbWUxMjlJc3N1ZVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnY2hyb21lMTI5SXNzdWVQbHVnaW4nLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJhdyA9IHJlcS5oZWFkZXJzWyd1c2VyLWFnZW50J10/Lm1hdGNoKC9DaHJvbShlfGl1bSlcXC8oWzAtOV0rKVxcLi8pO1xuXG4gICAgICAgIGlmIChyYXcpIHtcbiAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gcGFyc2VJbnQocmF3WzJdLCAxMCk7XG5cbiAgICAgICAgICBpZiAodmVyc2lvbiA9PT0gMTI5KSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdjb250ZW50LXR5cGUnLCAndGV4dC9odG1sJyk7XG4gICAgICAgICAgICByZXMuZW5kKFxuICAgICAgICAgICAgICAnPGJvZHk+PGgxPlBsZWFzZSB1c2UgQ2hyb21lIENhbmFyeSBmb3IgdGVzdGluZy48L2gxPjxwPkNocm9tZSAxMjkgaGFzIGFuIGlzc3VlIHdpdGggSmF2YVNjcmlwdCBtb2R1bGVzICYgVml0ZSBsb2NhbCBkZXZlbG9wbWVudCwgc2VlIDxhIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vc3RhY2tibGl0ei9ib2x0Lm5ldy9pc3N1ZXMvODYjaXNzdWVjb21tZW50LTIzOTU1MTkyNThcIj5mb3IgbW9yZSBpbmZvcm1hdGlvbi48L2E+PC9wPjxwPjxiPk5vdGU6PC9iPiBUaGlzIG9ubHkgaW1wYWN0cyA8dT5sb2NhbCBkZXZlbG9wbWVudDwvdT4uIGBwbnBtIHJ1biBidWlsZGAgYW5kIGBwbnBtIHJ1biBzdGFydGAgd2lsbCB3b3JrIGZpbmUgaW4gdGhpcyBicm93c2VyLjwvcD48L2JvZHk+JyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzVCxTQUFTLGdDQUFnQyx5QkFBeUIsY0FBYyx1QkFBdUI7QUFDN1osT0FBTyxZQUFZO0FBQ25CLFNBQVMsb0JBQXdDO0FBQ2pELFNBQVMscUJBQXFC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
