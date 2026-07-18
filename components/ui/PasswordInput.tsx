"use client";

import {
  forwardRef,
  useId,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  passwordInputClass,
  passwordToggleClass,
  textInputClass,
} from "@/components/ui/design-system";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  visibilityLabel?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      className = textInputClass,
      disabled,
      id,
      visibilityLabel = "senha",
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [isVisible, setIsVisible] = useState(false);
    const toggleLabel = isVisible
      ? `Ocultar ${visibilityLabel}`
      : `Mostrar ${visibilityLabel}`;

    return (
      <div className="relative w-full">
        <input
          {...props}
          ref={ref}
          id={inputId}
          type={isVisible ? "text" : "password"}
          disabled={disabled}
          className={`${className} ${passwordInputClass}`}
        />
        <button
          type="button"
          disabled={disabled}
          aria-controls={inputId}
          aria-label={toggleLabel}
          aria-pressed={isVisible}
          title={toggleLabel}
          className={passwordToggleClass}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" className="h-5 w-5 stroke-[3]" />
          ) : (
            <Eye aria-hidden="true" className="h-5 w-5 stroke-[3]" />
          )}
        </button>
      </div>
    );
  },
);
