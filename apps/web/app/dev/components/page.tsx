import { notFound } from 'next/navigation';
import { HoldBandWorkbench } from './HoldBandWorkbench';

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <HoldBandWorkbench />;
}
