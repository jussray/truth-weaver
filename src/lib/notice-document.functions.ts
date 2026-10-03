import { createServerFn } from "@tanstack/react-start";

import { imageExtractionInputSchema } from "./notice-document";

export const transcribeNoticeImage = createServerFn({ method: "POST" })
  .validator(imageExtractionInputSchema)
  .handler(async ({ data }) => {
    const { transcribeNoticeImageOnServer } = await import("./notice-document.server");
    return transcribeNoticeImageOnServer(data);
  });
