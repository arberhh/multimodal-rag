import type { ServerStatus } from "~/features/server/useServerStatus";
import type { Destination } from "./content";

export type HomeViewProps = {
  status: ServerStatus;
  retry: () => void;
  open: (destination: Destination) => void;
};
