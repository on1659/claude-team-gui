import { useRef, useCallback, useEffect } from 'react';

interface ChunkEntry {
  seq: number;
  text: string;
}

interface ChunkBufferHandle {
  /** Queue a chunk for rAF-batched dispatch */
  push: (agentId: string, seq: number, chunk: string) => void;
  /** Immediately flush any pending chunks for a specific agent (call before DONE) */
  flushAgent: (agentId: string) => void;
}

/**
 * rAF-based chunk buffer for streaming debounce.
 * Collects chunks per agent and flushes at next animation frame (~16ms).
 * Ensures seq ordering and batch dispatch.
 */
export function useChunkBuffer(
  onFlush: (agentId: string, text: string, lastSeq: number) => void,
): ChunkBufferHandle {
  const pendingChunks = useRef<Map<string, ChunkEntry[]>>(new Map());
  const flushRef = useRef<number | null>(null);

  // Cancel pending rAF on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (flushRef.current !== null) {
        cancelAnimationFrame(flushRef.current);
        flushRef.current = null;
      }
    };
  }, []);

  /** Flush all pending agents via rAF */
  const scheduleFlush = useCallback(() => {
    if (flushRef.current !== null) cancelAnimationFrame(flushRef.current);
    flushRef.current = requestAnimationFrame(() => {
      const agentCount = pendingChunks.current.size;
      if (agentCount > 0) {
        console.log(`[ChunkBuffer] rAF flush — ${agentCount} agents`);
      }
      for (const [id, chunks] of pendingChunks.current) {
        chunks.sort((a, b) => a.seq - b.seq);
        const text = chunks.map(c => c.text).join('');
        const lastSeq = chunks[chunks.length - 1].seq;
        console.log(`[ChunkBuffer] rAF agent=${id} chunks=${chunks.length} textLen=${text.length} lastSeq=${lastSeq}`);
        onFlush(id, text, lastSeq);
      }
      pendingChunks.current.clear();
      flushRef.current = null;
    });
  }, [onFlush]);

  const push = useCallback(
    (agentId: string, seq: number, chunk: string) => {
      const q = pendingChunks.current.get(agentId) ?? [];
      q.push({ seq, text: chunk });
      pendingChunks.current.set(agentId, q);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  /** Immediately flush pending chunks for one agent (synchronous). */
  const flushAgent = useCallback(
    (agentId: string) => {
      const chunks = pendingChunks.current.get(agentId);
      if (chunks && chunks.length > 0) {
        chunks.sort((a, b) => a.seq - b.seq);
        const text = chunks.map(c => c.text).join('');
        const lastSeq = chunks[chunks.length - 1].seq;
        console.log(`[ChunkBuffer] flushAgent(${agentId}) — sync ${chunks.length} chunks, textLen=${text.length}`);
        onFlush(agentId, text, lastSeq);
        pendingChunks.current.delete(agentId);
      } else {
        console.log(`[ChunkBuffer] flushAgent(${agentId}) — nothing pending`);
      }
    },
    [onFlush],
  );

  return { push, flushAgent };
}
