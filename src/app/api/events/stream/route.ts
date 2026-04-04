import { eventStore } from '@/lib/event-store';
import { startDemo } from '@/lib/demo-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Start demo mode on first SSE connection (always on for MVP)
  startDemo();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initData = {
        agents: eventStore.getSnapshots(),
        recentEvents: eventStore.getEvents(50),
      };
      controller.enqueue(
        encoder.encode(`event: init\ndata: ${JSON.stringify(initData)}\n\n`)
      );

      // Listen for new events
      const onEvent = (payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: activity\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // Client disconnected
          eventStore.emitter.removeListener('event', onEvent);
        }
      };

      eventStore.emitter.on('event', onEvent);

      // Keepalive every 15s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        eventStore.emitter.removeListener('event', onEvent);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
