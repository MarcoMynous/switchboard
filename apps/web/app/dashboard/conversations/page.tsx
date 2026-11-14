'use client';

import { ConversationsManagementView } from '@/components/dashboard/conversations/ConversationsManagementView';
import { useDashboard } from '@/components/dashboard/DashboardContext';

export default function ConversationsPage() {
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
      onRefresh={refreshWorkspaceData}
      onOpenTestChat={() => setChatDrawerOpen(true)}
      onUpdateConversation={(conversationId, updater) => {
        const prevConv = conversations.find((c) => c.id === conversationId);
        const nextList = conversations.map((c) => (c.id === conversationId ? updater(c) : c));
        saveConversations(nextList);
        const updated = nextList.find((c) => c.id === conversationId);
        if (updated) {
          const prevLen = prevConv?.messages.length ?? 0;
          const lastNewMsg =
            updated.messages.length > prevLen
              ? updated.messages[updated.messages.length - 1]
              : undefined;
          void fetch('/api/dashboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_conversation',
              slug: workspace.slug,
              conversationId,
              status: updated.status,
              replyText: lastNewMsg?.sender === 'staff' ? lastNewMsg.text : undefined,
            }),
          });
        }
      }}
      onUpdateBooking={(bookingId, updater) => {
        const nextList = bookings.map((b) => (b.id === bookingId ? updater(b) : b));
        saveBookings(nextList);
        const updated = nextList.find((b) => b.id === bookingId);
        if (updated) {
          void fetch('/api/dashboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_booking',
              slug: workspace.slug,
              bookingId,
              status: updated.status,
              cancelReason: updated.cancelReason,
              paymentStatus:
                updated.paymentStatus === 'verified' ||
                updated.paymentStatus === 'pending_verification' ||
                updated.paymentStatus === 'refunded'
                  ? updated.paymentStatus
                  : undefined,
            }),
          });
        }
      }}
      onNavigateSection={(sec) => setActiveNav(sec)}
    />
  );
}
