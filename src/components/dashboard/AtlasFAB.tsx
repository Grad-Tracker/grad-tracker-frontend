"use client";

import { IconButton, Icon } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";
import { useAtlasPanel } from "@/contexts/AtlasPanelContext";

export default function AtlasFAB() {
  const { isOpen, open } = useAtlasPanel();

  return (
    <IconButton
      aria-label="Open Atlas AI Advisor"
      onClick={open}
      display={isOpen ? "none" : "flex"}
      position="fixed"
      bottom="6"
      right="6"
      zIndex="overlay"
      colorPalette="blue"
      size="xl"
      borderRadius="full"
      boxShadow="lg"
    >
      <Icon boxSize="6">
        <LuSparkles />
      </Icon>
    </IconButton>
  );
}
