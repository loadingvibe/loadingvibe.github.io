import { deploymentBuild } from "../lib/deployment-build.mjs";

export function GET() {
  return Response.json(deploymentBuild);
}
