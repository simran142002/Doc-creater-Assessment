import { EditorSkeleton } from "./document-view";

export default function Loading() {
  return (
    <div className="ed">
      <div className="ed-head"><div className="ed-top" /><div className="ed-toolbar-wrap"><div className="ed-toolbar" /></div></div>
      <div className="ed-body"><div className="ed-stage"><EditorSkeleton /></div></div>
    </div>
  );
}
