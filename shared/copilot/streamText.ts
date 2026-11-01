/**
 * The in-progress reply while the agent works. Each model round streams its own words; after a tool step the next round's
 * words replace the last round's, so a line the model repeats before every tool call shows once, not stacked.
 */
export type StreamText = { text: string; fresh: boolean };

export const streamStart: StreamText = { text: "", fresh: false };

export function streamPiece(state: StreamText, piece: string): StreamText {
  return { text: state.fresh ? piece : state.text + piece, fresh: false };
}

export function streamStep(state: StreamText): StreamText {
  return { text: state.text, fresh: true };
}
