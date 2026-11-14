'use client';

import { ConversationsManagementView } from '@/components/dashboard/conversations/ConversationsManagementView';
import { useDashboard } from '@/components/dashboard/DashboardContext';

export default function NeedsAttentionPage() {
  const {
    workspace,
    conversations,
    bookings,
    apiState,
    refreshWorkspaceData,
    setChatDrawerOpen,
    saveConversations,
    saveBookings,
    setActiveNav,
  } = useDashboard();

  return (
    <ConversationsManagementView
      workspace={workspace}
      conversations={conversations}
      bookings={bookings}
      userRole={apiState.role}
      operatorName={apiState.ownerName}
      whatsappConnected={apiState.whatsappConnected}
      isLoading={apiState.loading}
      apiError={apiState.error}
      initialNeedsHumanOnly
      onRefresh={refreshWorkspaceData}
      onOpenTestChat={() => setChatDrawerOpen(true)}
      onUpdateConversation={(conversationId, updater) =>
        saveConversations(conversations.map((c) => (c.id === conversationId ? updater(c) : c)))
      }
      onUpdateBooking={(bookingId, updater) =>
        saveBookings(bookings.map((b) => (b.id === bookingId ? updater(b) : b)))
      }
      onNavigateSection={(sec) => setActiveNav(sec)}
    />
  );
}
