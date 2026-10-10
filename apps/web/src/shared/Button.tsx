import type { ButtonHTMLAttributes } from "react";
export function Button({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={type} className={"button " + className} />;
}
