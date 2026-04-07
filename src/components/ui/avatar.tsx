import {
  Avatar as ChakraAvatar,
  AvatarGroup as ChakraAvatarGroup,
} from "@chakra-ui/react";
import * as React from "react";

type ImageProps = React.ComponentProps<typeof ChakraAvatar.Image>;

export interface AvatarProps extends ChakraAvatar.RootProps {
  name?: string;
  src?: string | null;
  srcSet?: string;
  loading?: React.ImgHTMLAttributes<HTMLImageElement>["loading"];
  icon?: React.ReactElement;
  fallback?: React.ReactNode;
  imageProps?: Omit<ImageProps, "src" | "srcSet" | "loading" | "alt">;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  function Avatar(props, ref) {
    const {
      name,
      src,
      srcSet,
      loading,
      icon,
      fallback,
      children,
      imageProps,
      ...rest
    } = props;

    const hasImage = Boolean(src && src.trim().length > 0);

    return (
      <ChakraAvatar.Root ref={ref} {...rest}>
        <ChakraAvatar.Fallback name={name}>
          {icon || fallback}
        </ChakraAvatar.Fallback>

        {hasImage ? (
          <ChakraAvatar.Image
            src={src ?? undefined}
            srcSet={srcSet}
            loading={loading}
            alt={name || "Profile picture"}
            {...imageProps}
          />
        ) : null}

        {children}
      </ChakraAvatar.Root>
    );
  }
);

export const AvatarGroup = ChakraAvatarGroup;