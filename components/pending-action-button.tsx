"use client";

import type { ButtonHTMLAttributes,ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingActionButtonProps=Omit<ButtonHTMLAttributes<HTMLButtonElement>,"children"> & {
  children:ReactNode;
  pendingLabel?:ReactNode;
};

export function PendingActionButton({
  children,
  pendingLabel="Working…",
  disabled,
  type="submit",
  ...props
}:PendingActionButtonProps){
  const{pending}=useFormStatus();
  const blocked=Boolean(disabled||pending);
  return <button
    {...props}
    type={type}
    disabled={blocked}
    aria-busy={pending||undefined}
    data-loading={pending?"true":undefined}
  >{pending?pendingLabel:children}</button>;
}
