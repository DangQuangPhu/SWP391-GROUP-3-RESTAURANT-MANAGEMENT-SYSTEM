import { motion } from "framer-motion";

export default function CinematicIntro() {
  const text = "Welcome to";

  return (
    <motion.div
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center flex-col"
      exit={{ opacity: 0, transition: { duration: 1 } }}
    >
      <motion.div
        className="text-white text-lg md:text-xl tracking-[0.2em] font-light mb-4 uppercase whitespace-nowrap"
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ delay: 0.3, duration: 1.2, ease: "easeInOut" }}
      >
        Welcome to
      </motion.div>
      
      <motion.h1
        className="text-white text-8xl md:text-[11rem]"
        style={{ fontFamily: "var(--font-script)", lineHeight: 1.2 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1.1 }}
        transition={{ delay: 1.3, duration: 2.5, ease: "easeOut" }}
      >
        Phūrai
      </motion.h1>
    </motion.div>
  );
}
