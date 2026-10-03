import { createServerFn } from "@tanstack/react-start";

import { noticeAnalyzerInputSchema } from "./notice-analyzer";

export const analyzeLegalNotice = createServerFn({ method: "POST" })
  .validator(noticeAnalyzerInputSchema)
  .handler(async ({ data }) => {
    const { analyzeLegalNoticeOnServer } = await import("./notice-analyzer.server");
    return analyzeLegalNoticeOnServer(data);
  });
