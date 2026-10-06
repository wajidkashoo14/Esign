import type { IssuedLink } from "@/lib/server/agreements";

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
  links?: IssuedLink[];
  data?: Record<string, string>;
}
