'use client';

import { BookingsManagementView } from '@/components/dashboard/bookings/BookingsManagementView';
import { useDashboard } from '@/components/dashboard/DashboardContext';

export default function BookingsPage() {
  const {
    workspace,
    bookings,
    conversations,
    apiState,
    copiedSlug,
    copyBookingLink,
    saveBookings,
    refreshWorkspaceData,
    setActiveNav,
  } = useDashboard();

  return (
    <BookingsManagementView
      workspace={workspace}
      bookings={bookings}
      conversations={conversations}
      userRole={apiState.role}
      isLoading={apiState.loading}
      apiError={apiState.error}
      copiedSlug={copiedSlug}
      onCopyBookingLink={copyBookingLink}
      onCreateBooking={(newBk) => {
        saveBookings([newBk, ...bookings]);
        void fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_booking',
            slug: workspace.slug,
            customerName: newBk.customerName,
            customerPhone: newBk.customerPhone,
            serviceName: newBk.serviceName,
            staffName: newBk.staffName,
            startsAt: newBk.startsAt,
            requireDeposit: newBk.depositKobo > 0,
            priceKobo: newBk.priceKobo,
            depositKobo: newBk.depositKobo,
            notes: newBk.customerNotes,
          }),
        }).then((res) => {
          if (res.ok) refreshWorkspaceData();
        });
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
