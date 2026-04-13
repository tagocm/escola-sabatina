"use client";

import { useTransition, useState } from "react";
import { LinkIcon, Check, Copy, Loader2 } from "lucide-react";
import { generateInviteAction } from "@/app/actions/classes";

export default function InviteButton({ classId }: { classId: string }) {
  const [isPending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await generateInviteAction(classId);
      if ("token" in result && result.token) {
        const url = `${window.location.origin}/convite/${result.token}`;
        setInviteUrl(url);
      } else if ("error" in result && result.error) {
        setInviteUrl(null);
        setErrorMsg(result.error);
      }
    });
  };

  const copyToClipboard = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {errorMsg && (
        <p className="text-[10px] font-black uppercase tracking-widest text-es-orange">
          {errorMsg}
        </p>
      )}
      {!inviteUrl ? (
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/60 hover:text-es-orange transition-colors cursor-pointer disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
          {isPending ? "Gerando..." : "Gerar Link de Convite"}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 bg-es-green text-foreground text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 border-foreground shadow-editorial-sm hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado!" : "Copiar Link"}
          </button>
          <button 
            onClick={() => setInviteUrl(null)}
            className="text-[10px] font-black uppercase text-foreground/40 hover:text-foreground transition-colors underline underline-offset-2 cursor-pointer"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
