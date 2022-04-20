import { Box, useColorModeValue } from "@chakra-ui/react";
import { PropsWithChildren } from "react";

interface SwatchProps {
  color: string;
  isSelected?: boolean;
  onClick: () => void;
}

export function Swatch({
  color,
  isSelected,
  onClick,
  children,
}: PropsWithChildren<SwatchProps>) {
  const border = useColorModeValue("whiteAlpha.800", "blackAlpha.600");

  return (
    <Box
      as="button"
      textAlign="center"
      fontSize="xs"
      fontWeight="bold"
      color="#000"
      textShadow="-0.6px -0.6px 0 #fff, 0.6px -0.6px 0 #fff, -0.6px 0.6px 0 #fff, 1px 1px 0 #fff"
      bg={color}
      h="24px"
      w="24px"
      rounded="sm"
      transition="all 0.1s linear"
      boxShadow={isSelected ? "lg" : "md"}
      borderWidth={3}
      borderColor={isSelected ? color : border}
      _hover={{
        transform: "scale(1.2)",
        borderColor: color,
      }}
      onClick={onClick}
    >
      {children}
    </Box>
  );
}
