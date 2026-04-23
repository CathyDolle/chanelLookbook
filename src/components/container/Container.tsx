import type { ElementType, ReactNode } from "react";
import clsx from "clsx";

interface ContainerProps {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
}

export const Container = ({
  as: Tag = "div",
  children,
  className,
}: ContainerProps) => {
  return <Tag className={clsx("grid-container", className)}>{children}</Tag>;
};