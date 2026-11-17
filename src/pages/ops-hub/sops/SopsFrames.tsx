import { useState, type ComponentProps } from "react";
import "../clients/clientsDesign.css";
import "./sopModalsDesign.css";
import { ImageRedactorModal } from "../../../components/sop/ImageRedactorModal";
import { VideoSopStudioModal } from "../../../components/sop/VideoSopStudioModal";

/*
 * Thin wrappers around the existing modals. Logic and props are unchanged; the only thing these add
 * is a `.mrgc.sop-host` element so the light skin in clientsDesign.css (scoped under .mrgc) reaches
 * them. Both modals still render their own full-screen overlay.
 */

/** Same props as ImageRedactorModal. Portals into a `.mrgc` host instead of document.body. */
export function RedactorFrame(props: Omit<ComponentProps<typeof ImageRedactorModal>, "portalContainer">) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div className="mrgc sop-host" ref={setHost}>
      {host ? <ImageRedactorModal {...props} portalContainer={host} /> : null}
    </div>
  );
}

/**
 * Same props as VideoSopStudioModal. The parent that owns the studio (today ClientsApp) should render
 * this instead of the bare modal so the studio, and the redactor it opens, get the light skin. The
 * floating recording bar is left dark, as drawn in the design.
 */
export function SopVideoStudioFrame(props: Omit<ComponentProps<typeof VideoSopStudioModal>, "portalContainer">) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div className="mrgc sop-host" ref={setHost}>
      <VideoSopStudioModal {...props} portalContainer={host} />
    </div>
  );
}
