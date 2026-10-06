"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionState } from "@/app/actions/types";

/**
 * Wraps a server action for use with a plain onSubmit handler. Unlike <form action>,
 * React does not reset the form after submission, so inputs survive validation errors.
 */
export function useServerForm(action: (prev: ActionState, form: FormData) => Promise<ActionState>) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      setState(await action({}, data));
    });
  };
  return { state, pending, onSubmit };
}
