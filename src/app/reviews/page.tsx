import ReviewQueue from '@/components/ReviewQueue';

export default function ReviewsPage() {
  return (
    <main className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Review Queue</h1>
      <ReviewQueue />
    </main>
  );
}
