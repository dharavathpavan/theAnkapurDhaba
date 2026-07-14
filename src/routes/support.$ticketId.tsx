import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Paperclip, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { addSupportTicketMessage, getSupportTicket, uploadCatalogFile } from "@/services/api";

export const Route = createFileRoute("/support/$ticketId")({
  head: () => ({ meta: [{ title: "Support Ticket - The Ankapure Dhaba" }] }),
  component: TicketPage,
});

function TicketPage() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const { data: ticket, isLoading } = useQuery({ queryKey: ["support-ticket", ticketId], queryFn: () => getSupportTicket(ticketId) });
  const send = useMutation({
    mutationFn: () => addSupportTicketMessage(ticketId, { message: message.trim() || "Attached media", media }),
    onSuccess: () => {
      setMessage("");
      setMedia([]);
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to send message"),
  });

  const uploadMedia = async (files: FileList | null) => {
    const selected = Array.from(files ?? []).slice(0, 6 - media.length);
    if (selected.length === 0) return;
    setUploadingMedia(true);
    try {
      const uploaded = await Promise.all(selected.map((file) => uploadCatalogFile(file)));
      setMedia((current) => [...current, ...uploaded.map((file) => file.url)].slice(0, 6));
      toast.success("Media attached");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Media upload failed");
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (url: string) => setMedia((current) => current.filter((item) => item !== url));

  if (isLoading) return <div className="px-4 py-20 text-center font-black">Loading ticket...</div>;
  if (!ticket) return <div className="px-4 py-20 text-center"><h1 className="text-3xl font-black">Ticket not found</h1><Link to="/support" className="mt-4 inline-flex rounded-2xl bg-red-600 px-4 py-3 font-black text-white">Back to support</Link></div>;
  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-5 md:px-6 md:py-8">
      <Link to="/support" className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black ring-1 ring-zinc-100"><ArrowLeft className="h-4 w-4" /> Support</Link>
      <section className="mt-4 rounded-[34px] bg-zinc-950 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">Ticket #{ticket.id.slice(0, 8)}</p>
            <h1 className="mt-1 text-3xl font-black">{ticket.subject}</h1>
            <p className="mt-2 text-sm font-semibold text-white/65">{ticket.category} · Priority {ticket.priority}</p>
          </div>
          <span className="rounded-2xl bg-white px-4 py-2 text-sm font-black capitalize text-zinc-950">{ticket.status.replace(/_/g, " ")}</span>
        </div>
        {ticket.resolution && <p className="mt-5 rounded-2xl bg-emerald-500/15 p-4 text-sm font-semibold text-emerald-100">{ticket.resolution}</p>}
      </section>

      <section className="mt-5 space-y-3">
        {ticket.messages.map((item) => (
          <div key={item.id} className={`flex ${item.sender === "admin" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[82%] rounded-[24px] p-4 shadow-sm ${item.sender === "admin" ? "bg-white text-zinc-950 ring-1 ring-zinc-100" : "bg-red-600 text-white"}`}>
              <div className="text-xs font-black uppercase tracking-widest opacity-60">{item.sender === "admin" ? "Support team" : "You"}</div>
              <p className="mt-1 text-sm font-semibold leading-6">{item.message}</p>
              {item.media?.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {item.media.map((url) => <SupportMediaPreview key={url} url={url} />)}
                </div>
              )}
              <div className="mt-2 text-[11px] font-bold opacity-60">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        {closed ? (
          <p className="rounded-2xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">This ticket is {ticket.status}. Create a new ticket if you need more help.</p>
        ) : (
          <div className="space-y-3">
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((url) => (
                  <div key={url} className="relative overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200">
                    {isVideoMedia(url) ? <video src={url} className="h-20 w-full object-cover" muted playsInline /> : <img src={url} alt="Attached support media" className="h-20 w-full object-cover" />}
                    <button type="button" onClick={() => removeMedia(url)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <label className={`grid min-h-13 w-14 cursor-pointer place-items-center rounded-2xl bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 ${uploadingMedia ? "opacity-60" : ""}`} title="Attach media">
                <Paperclip className="h-5 w-5" />
                <input type="file" accept="image/*,video/*" multiple disabled={uploadingMedia || media.length >= 6} onChange={(event) => uploadMedia(event.target.files)} className="hidden" />
              </label>
              <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={uploadingMedia ? "Uploading media..." : "Type your reply..."} className="min-h-13 min-w-0 flex-1 rounded-2xl bg-zinc-50 px-4 font-semibold outline-none ring-1 ring-zinc-200" />
              <button onClick={() => send.mutate()} disabled={send.isPending || uploadingMedia || (!message.trim() && media.length === 0)} className="grid min-h-13 w-14 place-items-center rounded-2xl bg-red-600 text-white disabled:opacity-50"><Send className="h-5 w-5" /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SupportMediaPreview({ url }: { url: string }) {
  if (isVideoMedia(url)) {
    return <video src={url} controls playsInline className="max-h-52 w-full rounded-2xl bg-black object-cover" />;
  }
  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url)) {
    return <img src={url} alt="Support attachment" className="max-h-52 w-full rounded-2xl object-cover" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex min-h-20 items-center justify-center gap-2 rounded-2xl bg-white/15 px-3 text-sm font-black underline">
      Open file <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function isVideoMedia(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}
