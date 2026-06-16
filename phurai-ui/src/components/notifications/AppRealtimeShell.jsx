import { Toaster } from "react-hot-toast";
import { SocketProvider } from "@/core/socket/SocketContext.jsx";
import { useTableSession } from "@/features/table-session";
import { APP_TOASTER_OPTIONS } from "@/core/notifications/appToast.js";
import CustomerNotificationListener from "@/components/notifications/CustomerNotificationListener.jsx";

/**
 * Wraps the app with Socket.IO and global toast listeners.
 * Must live inside TableSessionProvider so session rooms can be joined.
 */
export default function AppRealtimeShell({
  children,
  currentUser,
  isAuthenticated,
}) {
  const { session } = useTableSession();

  return (
    <SocketProvider user={currentUser} sessionId={session?.session_id}>
      <Toaster {...APP_TOASTER_OPTIONS} />
      <CustomerNotificationListener
        user={currentUser}
        isAuthenticated={isAuthenticated}
      />
      {children}
    </SocketProvider>
  );
}
