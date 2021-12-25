import { motion } from "framer-motion";
import LinearGradients from "./LinearGradients";
import { streamlineHorizontal } from "../../utils/streamline";

const streamlineGenerator = streamlineHorizontal();

export default function Streamline({ link, opacity }) {
  const d = streamlineGenerator(link.path);
  return (
    <motion.path
      id={link.id}
      className="streamline"
      fill={LinearGradients.fill(link)}
      initial={{ opacity: 0 }}
      animate={{ opacity, d }}
      transition={{ bounce: 0, duration: 0.2 }}
      exit={{ opacity: 0 }}
    />
  );
}
