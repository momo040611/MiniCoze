// Workflow canvas API entry. Node, edge, run, debug, and persistence
// APIs that belong to the editor surface should be exported from here.
export interface WorkflowCanvasData {
  nodes: unknown[];
  edges: unknown[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}
