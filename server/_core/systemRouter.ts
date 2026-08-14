import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(z.object({ timestamp: z.number().min(0) }))
    .query(() => ({ ok: true })),

  notifyOwner: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Notification via Forge is optional — only works if BUILT_IN_FORGE_API_URL is set
      if (!process.env.BUILT_IN_FORGE_API_URL) {
        console.log(`[Notify] ${input.title}: ${input.content}`);
        return { success: false, reason: "Forge API not configured" };
      }
      try {
        const { notifyOwner } = await import("./notification");
        const delivered = await notifyOwner(input);
        return { success: delivered };
      } catch (e) {
        console.error("[Notify] Failed:", e);
        return { success: false };
      }
    }),
});
