export type WaitingStage = "reserved" | "settling" | "soon";
export function waitingStage(remainingMs: number): WaitingStage {
  return remainingMs <= 60000
    ? "soon"
    : remainingMs <= 5 * 60000
      ? "settling"
      : "reserved";
}
// Future video adapters will implement these states. No camera/microphone is requested by the phone demo.
export type VideoRoomState =
  | "permission-needed"
  | "checking-device"
  | "waiting"
  | "admitted"
  | "connecting"
  | "connected"
  | "ended"
  | "reconnecting"
  | "failed";
export interface VideoRoomAdapter {
  requestPermissions(): Promise<{ camera: boolean; microphone: boolean }>;
  joinWaitingRoom(bookingId: string): Promise<void>;
  enter(admissionToken: string): Promise<void>;
  leave(): Promise<void>;
  onState(listener: (state: VideoRoomState) => void): () => void;
}
