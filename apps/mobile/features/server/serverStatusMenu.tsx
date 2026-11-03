import { Stack } from "one";
import { serverUrl } from "./config";
import { statusColor, statusLabel, statusSymbol } from "./ServerStatus";
import type { ServerStatus } from "./useServerStatus";

const checkAgain = "Check again";

// The iOS header button for the server status, with a menu to check again. A function, not a
// component: Stack.Toolbar reads its children by type, so the menu must be the element itself
export function serverStatusMenu(status: ServerStatus, retry: () => void) {
  return (
    <Stack.Toolbar.Menu
      title={`${statusLabel[status]} · ${serverUrl}`}
      icon={statusSymbol[status]}
      tintColor={statusColor[status]}
      accessibilityLabel={`Server ${statusLabel[status]}`}
    >
      <Stack.Toolbar.MenuAction icon="arrow.clockwise" onPress={retry}>
        {checkAgain}
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );
}
