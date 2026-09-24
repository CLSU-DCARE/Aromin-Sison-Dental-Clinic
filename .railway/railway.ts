import { defineRailway, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "asdc-api";

export default defineRailway(() => {
  const asdc_api = service("asdc-api", {
    healthcheck: "/health",
    healthcheckTimeout: 100,
    replicas: 1,
    // dockerfilePath from CaC: "Dockerfile"
    // builder from CaC: "DOCKERFILE"
  });
  return project("asdc-v2", {
    resources: [asdc_api],
  });
});
