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
      onCreateBooking={(newBk) => saveBookings([newBk, ...bookings])}
      onUpdateBooking={(bookingId, updater) =>
        saveBookings(bookings.map((b) => (b.id === bookingId ? updater(b) : b)))
      }
      onNavigateSection={(sec) => setActiveNav(sec)}
    />
  );
}
