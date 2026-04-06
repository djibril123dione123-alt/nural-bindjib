import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function BackButton() {
  const navigate = useNavigate();
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => navigate(-1)}
      className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full glass border border-accent/30 flex items-center justify-center"
      style={{ color: "#F59E0B" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </motion.button>
  );
}
