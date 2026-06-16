"use client";

import { useTransition, useState } from "react";
import { LinkIcon, Check, Copy } from "lucide-react";
import { generateInviteAction } from "@/app/actions/classes";
import { ButtonLoader } from "@/components/ui/AppLoader";

export default function InviteButton({ classId }: { classId: string }) {
  const [isPending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = () => {
    setErrorMsg(null);
    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setErrorMsg("Informe o e-mail do professor convidado.");
      return;
    }

    startTransition(async () => {
      const result = await generateInviteAction(classId, normalizedEmail);
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
        <div className="flex flex-col gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="email do professor"
            className="h-9 w-full border-2 border-foreground bg-background px-2 text-[10px] font-black uppercase tracking-widest outline-none placeholder:text-foreground/30 focus:bg-surface"
          />
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/60 hover:text-es-orange transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPending ? <ButtonLoader size="sm" label="Gerando convite" /> : <LinkIcon className="w-3 h-3" />}
            {isPending ? "Gerando..." : "Gerar Link de Convite"}
          </button>
        </div>
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
