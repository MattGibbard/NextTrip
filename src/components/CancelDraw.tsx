import type { Idea, Round } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";

/**
 * Cancels a drawn round, for the organiser. A winner you haven't been on yet goes back to Next
 * with its trip plan cleared; one already saved to Been stays put.
 */
export function CancelDraw({ round, winner, onCancelled, className = "link danger" }: { round: Round; winner?: Idea; onCancelled?: () => void; className?: string }) {
  const { reload, isOwner } = useData();
  if (!isOwner) return null;
  const won = winner?.status === "won";
  const cancel = async () => {
    const back = won ? ` ${winner.title} goes back into Next and its trip plan is deleted.` : "";
    if (!confirm(`Cancel the ${round.name} draw and clear everyone's points for it?${back}`)) return;
    await api.deleteRound(round.id);
    await reload(["rounds", "ideas"]);
    onCancelled?.();
  };
  return (
    <button className={className} onClick={cancel}>
      {won ? "Cancel this draw" : "Delete this draw"}
    </button>
  );
}
