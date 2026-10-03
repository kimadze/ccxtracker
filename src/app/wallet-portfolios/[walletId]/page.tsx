import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { walletService } from "@/server/services/wallet";
import { AccessError } from "@/server/services/portfolio";
import { WalletWorkspace } from "@/components/wallet-workspace";
export const maxDuration = 60;
export default async function WalletPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const user = await requireUser();
  const { walletId } = await params;
  const wallet = await walletService(getDb(), user.id)
    .owned(walletId)
    .catch((e) => {
      if (e instanceof AccessError || e instanceof ZodError) notFound();
      throw e;
    });
  return (
    <WalletWorkspace
      wallet={{
        id: wallet.id,
        name: wallet.name,
        network: wallet.network,
        addresses: wallet.config.addresses,
        snapshot: wallet.snapshot,
        lastError: wallet.lastError,
      }}
    />
  );
}
