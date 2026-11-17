export { SopsHubApp } from "./SopsHubApp";
export type { SopsHubAppProps } from "./SopsHubApp";
// Thin wrappers for the parent: render SopVideoStudioFrame instead of the bare VideoSopStudioModal so the
// studio (and the redactor it opens) pick up the light ops-hub skin. Props are identical.
export { SopVideoStudioFrame, RedactorFrame } from "./SopsFrames";
