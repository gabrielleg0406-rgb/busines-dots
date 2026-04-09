"use client";

import React, {
    useEffect,
    useRef,
    useState,
    useCallback,
    forwardRef,
    useImperativeHandle,
    useMemo,
    type ReactNode,
    type MouseEvent as ReactMouseEvent,
    type SVGProps,
} from 'react';
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent,
    useInView,
    type Transition,
    type VariantLabels,
    type Target,
    type AnimationControls,
    type TargetAndTransition,
    type Variants,
} from 'framer-motion';

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── RotatingText ───────────────────────────────────────────────────────────

interface RotatingTextRef {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

interface RotatingTextProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof motion.span>,
    "children" | "transition" | "initial" | "animate" | "exit"
  > {
  texts: string[];
  transition?: Transition;
  initial?: boolean | Target | VariantLabels;
  animate?: boolean | VariantLabels | AnimationControls | TargetAndTransition;
  exit?: Target | VariantLabels;
  animatePresenceMode?: "sync" | "wait";
  animatePresenceInitial?: boolean;
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | "random" | number;
  loop?: boolean;
  auto?: boolean;
  splitBy?: "characters" | "words" | "lines" | string;
  onNext?: (index: number) => void;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
}

const RotatingText = forwardRef<RotatingTextRef, RotatingTextProps>(
  (
    {
      texts,
      transition = { type: "spring", damping: 25, stiffness: 300 },
      initial = { y: "100%", opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: "-120%", opacity: 0 },
      animatePresenceMode = "wait",
      animatePresenceInitial = false,
      rotationInterval = 2200,
      staggerDuration = 0.01,
      staggerFrom = "last",
      loop = true,
      auto = true,
      splitBy = "characters",
      onNext,
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      ...rest
    },
    ref
  ) => {
    const [currentTextIndex, setCurrentTextIndex] = useState<number>(0);

    const splitIntoCharacters = (text: string): string[] => {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        try {
          const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
          return Array.from(segmenter.segment(text), (segment) => segment.segment);
        } catch {
          return text.split('');
        }
      }
      return text.split('');
    };

    const elements = useMemo(() => {
      const currentText: string = texts[currentTextIndex] ?? '';
      if (splitBy === "characters") {
        const words = currentText.split(/(\s+)/);
        let charCount = 0;
        return words.filter(part => part.length > 0).map((part) => {
          const isSpace = /^\s+$/.test(part);
          const chars = isSpace ? [part] : splitIntoCharacters(part);
          const startIndex = charCount;
          charCount += chars.length;
          return { characters: chars, isSpace, startIndex };
        });
      }
      if (splitBy === "words") {
        return currentText.split(/(\s+)/).filter(w => w.length > 0).map((word, i) => ({
          characters: [word], isSpace: /^\s+$/.test(word), startIndex: i
        }));
      }
      return currentText.split('\n').map((line, i) => ({
        characters: [line], isSpace: false, startIndex: i
      }));
    }, [texts, currentTextIndex, splitBy]);

    const totalElements = useMemo(() => elements.reduce((sum, el) => sum + el.characters.length, 0), [elements]);

    const getStaggerDelay = useCallback((index: number, total: number): number => {
      if (total <= 1 || !staggerDuration) return 0;
      switch (staggerFrom) {
        case "first": return index * staggerDuration;
        case "last": return (total - 1 - index) * staggerDuration;
        case "center": return Math.abs((total - 1) / 2 - index) * staggerDuration;
        case "random": return Math.random() * (total - 1) * staggerDuration;
        default:
          if (typeof staggerFrom === 'number') {
            return Math.abs(Math.max(0, Math.min(staggerFrom, total - 1)) - index) * staggerDuration;
          }
          return index * staggerDuration;
      }
    }, [staggerFrom, staggerDuration]);

    const handleIndexChange = useCallback((newIndex: number) => {
      setCurrentTextIndex(newIndex);
      onNext?.(newIndex);
    }, [onNext]);

    const next = useCallback(() => {
      const nextIndex = currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
      if (nextIndex !== currentTextIndex) handleIndexChange(nextIndex);
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const previous = useCallback(() => {
      const prevIndex = currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1;
      if (prevIndex !== currentTextIndex) handleIndexChange(prevIndex);
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const jumpTo = useCallback((index: number) => {
      const validIndex = Math.max(0, Math.min(index, texts.length - 1));
      if (validIndex !== currentTextIndex) handleIndexChange(validIndex);
    }, [texts.length, currentTextIndex, handleIndexChange]);

    const reset = useCallback(() => {
      if (currentTextIndex !== 0) handleIndexChange(0);
    }, [currentTextIndex, handleIndexChange]);

    useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [next, previous, jumpTo, reset]);

    useEffect(() => {
      if (!auto || texts.length <= 1) return;
      const id = setInterval(next, rotationInterval);
      return () => clearInterval(id);
    }, [next, rotationInterval, auto, texts.length]);

    return (
      <motion.span
        className={cn("inline-flex flex-wrap whitespace-pre-wrap relative align-bottom pb-[10px]", mainClassName)}
        {...rest}
        layout
      >
        <span className="sr-only">{texts[currentTextIndex]}</span>
        <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
          <motion.div
            key={currentTextIndex}
            className="inline-flex flex-wrap relative flex-row items-baseline"
            layout aria-hidden="true"
            initial="initial" animate="animate" exit="exit"
          >
            {elements.map((elementObj, elementIndex) => (
              <span key={elementIndex} className={cn("inline-flex", splitLevelClassName)} style={{ whiteSpace: 'pre' }}>
                {elementObj.characters.map((char, charIndex) => {
                  const globalIndex = elementObj.startIndex + charIndex;
                  return (
                    <motion.span
                      key={`${char}-${charIndex}`}
                      initial={initial} animate={animate} exit={exit}
                      transition={{ ...transition, delay: getStaggerDelay(globalIndex, totalElements) }}
                      className={cn("inline-block leading-none tracking-tight", elementLevelClassName)}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </motion.span>
                  );
                })}
              </span>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.span>
    );
  }
);
RotatingText.displayName = "RotatingText";

// ─── Icons ──────────────────────────────────────────────────────────────────

const MenuIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const CloseIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const ChevronRightIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

// ─── Nav ────────────────────────────────────────────────────────────────────

interface NavLinkProps {
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
}

const NavLink: React.FC<NavLinkProps> = ({ href = "#", children, className = "", onClick }) => (
  <motion.a
    href={href} onClick={onClick}
    className={cn("relative group text-sm font-medium text-gray-300 hover:text-white transition-colors duration-200 flex items-center py-1", className)}
    whileHover="hover"
  >
    {children}
    <motion.div
      className="absolute bottom-[-2px] left-0 right-0 h-[1px] bg-[#0CF2A0]"
      variants={{ initial: { scaleX: 0 }, hover: { scaleX: 1 } }}
      initial="initial"
      transition={{ duration: 0.3, ease: "easeOut" }}
    />
  </motion.a>
);

// ─── Dot canvas ─────────────────────────────────────────────────────────────

interface Dot {
  x: number; y: number; baseColor: string;
  targetOpacity: number; currentOpacity: number; opacitySpeed: number;
  baseRadius: number; currentRadius: number;
}

const DotCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const gridRef = useRef<Record<string, number[]>>({});
  const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const mousePositionRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });

  const DOT_SPACING = 25;
  const BASE_OPACITY_MIN = 0.35;
  const BASE_OPACITY_MAX = 0.50;
  const BASE_RADIUS = 1;
  const INTERACTION_RADIUS = 150;
  const INTERACTION_RADIUS_SQ = INTERACTION_RADIUS * INTERACTION_RADIUS;
  const OPACITY_BOOST = 0.6;
  const RADIUS_BOOST = 2.5;
  const GRID_CELL_SIZE = Math.max(50, Math.floor(INTERACTION_RADIUS / 1.5));

  const handleMouseMove = useCallback((event: globalThis.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) { mousePositionRef.current = { x: null, y: null }; return; }
    const rect = canvas.getBoundingClientRect();
    mousePositionRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const createDots = useCallback(() => {
    const { width, height } = canvasSizeRef.current;
    if (width === 0 || height === 0) return;
    const newDots: Dot[] = [];
    const newGrid: Record<string, number[]> = {};
    const cols = Math.ceil(width / DOT_SPACING);
    const rows = Math.ceil(height / DOT_SPACING);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * DOT_SPACING + DOT_SPACING / 2;
        const y = j * DOT_SPACING + DOT_SPACING / 2;
        const cellKey = `${Math.floor(x / GRID_CELL_SIZE)}_${Math.floor(y / GRID_CELL_SIZE)}`;
        if (!newGrid[cellKey]) newGrid[cellKey] = [];
        newGrid[cellKey].push(newDots.length);
        const baseOpacity = Math.random() * (BASE_OPACITY_MAX - BASE_OPACITY_MIN) + BASE_OPACITY_MIN;
        newDots.push({ x, y, baseColor: `rgba(87, 220, 205, ${BASE_OPACITY_MAX})`, targetOpacity: baseOpacity, currentOpacity: baseOpacity, opacitySpeed: (Math.random() * 0.005) + 0.002, baseRadius: BASE_RADIUS, currentRadius: BASE_RADIUS });
      }
    }
    dotsRef.current = newDots;
    gridRef.current = newGrid;
  }, [DOT_SPACING, GRID_CELL_SIZE, BASE_OPACITY_MIN, BASE_OPACITY_MAX, BASE_RADIUS]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
      canvasSizeRef.current = { width, height };
      createDots();
    }
  }, [createDots]);

  const animateDots = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const dots = dotsRef.current;
    const grid = gridRef.current;
    const { width, height } = canvasSizeRef.current;
    const { x: mouseX, y: mouseY } = mousePositionRef.current;
    if (!ctx || !dots || width === 0 || height === 0) { animationFrameId.current = requestAnimationFrame(animateDots); return; }
    ctx.clearRect(0, 0, width, height);
    const activeDotIndices = new Set<number>();
    if (mouseX !== null && mouseY !== null) {
      const mouseCellX = Math.floor(mouseX / GRID_CELL_SIZE);
      const mouseCellY = Math.floor(mouseY / GRID_CELL_SIZE);
      const searchRadius = Math.ceil(INTERACTION_RADIUS / GRID_CELL_SIZE);
      for (let i = -searchRadius; i <= searchRadius; i++)
        for (let j = -searchRadius; j <= searchRadius; j++) {
          const cellKey = `${mouseCellX + i}_${mouseCellY + j}`;
          if (grid[cellKey]) grid[cellKey].forEach(idx => activeDotIndices.add(idx));
        }
    }
    dots.forEach((dot, index) => {
      dot.currentOpacity += dot.opacitySpeed;
      if (dot.currentOpacity >= dot.targetOpacity || dot.currentOpacity <= BASE_OPACITY_MIN) {
        dot.opacitySpeed = -dot.opacitySpeed;
        dot.currentOpacity = Math.max(BASE_OPACITY_MIN, Math.min(dot.currentOpacity, BASE_OPACITY_MAX));
        dot.targetOpacity = Math.random() * (BASE_OPACITY_MAX - BASE_OPACITY_MIN) + BASE_OPACITY_MIN;
      }
      let interactionFactor = 0;
      if (mouseX !== null && mouseY !== null && activeDotIndices.has(index)) {
        const dx = dot.x - mouseX, dy = dot.y - mouseY;
        const distSq = dx * dx + dy * dy;
        if (distSq < INTERACTION_RADIUS_SQ) {
          const d = Math.sqrt(distSq);
          interactionFactor = Math.max(0, 1 - d / INTERACTION_RADIUS);
          interactionFactor = interactionFactor * interactionFactor;
        }
      }
      const finalOpacity = Math.min(1, dot.currentOpacity + interactionFactor * OPACITY_BOOST);
      dot.currentRadius = dot.baseRadius + interactionFactor * RADIUS_BOOST;
      const m = dot.baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const r = m ? m[1] : '87', g = m ? m[2] : '220', b = m ? m[3] : '205';
      ctx.beginPath();
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity.toFixed(3)})`;
      ctx.arc(dot.x, dot.y, dot.currentRadius, 0, Math.PI * 2);
      ctx.fill();
    });
    animationFrameId.current = requestAnimationFrame(animateDots);
  }, [GRID_CELL_SIZE, INTERACTION_RADIUS, INTERACTION_RADIUS_SQ, OPACITY_BOOST, RADIUS_BOOST, BASE_OPACITY_MIN, BASE_OPACITY_MAX, BASE_RADIUS]);

  useEffect(() => {
    handleResize();
    const handleMouseLeave = () => { mousePositionRef.current = { x: null, y: null }; };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    animationFrameId.current = requestAnimationFrame(animateDots);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [handleResize, handleMouseMove, animateDots]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-70" />;
};

// ─── Section fade-in wrapper ─────────────────────────────────────────────────

const FadeInSection: React.FC<{ children: ReactNode; className?: string; delay?: number }> = ({ children, className, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ─── Pillar Card ─────────────────────────────────────────────────────────────

interface PillarCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  items: string[];
  delay: number;
  accent: string;
}

const PillarCard: React.FC<PillarCardProps> = ({ icon, title, description, items, delay, accent }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative bg-[#161616] border border-gray-800/60 rounded-xl p-6 flex flex-col gap-4 overflow-hidden group cursor-default"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
        style={{ background: `radial-gradient(ellipse at top left, ${accent}08 0%, transparent 60%)` }}
      />
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl`}
        style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
      <ul className="flex flex-col gap-2 mt-auto pt-2 border-t border-gray-800/60">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: accent }} />
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

// ─── Step Card ───────────────────────────────────────────────────────────────

interface StepCardProps {
  step: number;
  title: string;
  description: string;
  delay: number;
  isLast?: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ step, title, description, delay, isLast }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="flex gap-5 items-start"
    >
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#0CF2A0]/10 border border-[#0CF2A0]/30 flex items-center justify-center text-[#0CF2A0] font-bold text-sm">
          {step}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-[#0CF2A0]/30 to-transparent mt-2 min-h-[40px]" />}
      </div>
      <div className="pb-8">
        <h4 className="text-white font-semibold mb-1">{title}</h4>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
};

// ─── Product Badge ────────────────────────────────────────────────────────────

interface ProductBadgeProps {
  name: string;
  tag: string;
  delay: number;
}

const ProductBadge: React.FC<ProductBadgeProps> = ({ name, tag, delay }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
      className="bg-[#161616] border border-gray-800/60 rounded-xl p-5 flex flex-col gap-2 cursor-default group"
    >
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold">{name}</span>
        <span className="text-[10px] text-[#0CF2A0] border border-[#0CF2A0]/30 rounded-full px-2 py-0.5 bg-[#0CF2A0]/5">{tag}</span>
      </div>
      <div className="w-full h-px bg-gray-800/60 group-hover:bg-[#0CF2A0]/20 transition-colors duration-300" />
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const AGLabsPage: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => setIsScrolled(latest > 10));

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const headerVariants: Variants = {
    top: { backgroundColor: "rgba(15,15,15,0.7)", borderBottomColor: "rgba(55,65,81,0.4)", boxShadow: 'none' },
    scrolled: { backgroundColor: "rgba(15,15,15,0.97)", borderBottomColor: "rgba(75,85,99,0.6)", boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
  };

  const mobileMenuVariants: Variants = {
    hidden: { opacity: 0, y: -16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
    exit: { opacity: 0, y: -16, transition: { duration: 0.15 } }
  };

  const contentDelay = 0.2;

  const pillarCards = [
    {
      icon: "🧩",
      title: "Infraestrutura de IA",
      description: "Construímos a base sólida para que sua empresa opere com IA de ponta a ponta.",
      items: ["Arquitetura de sistemas", "Banco de dados vetorial", "Orquestração de modelos"],
      delay: 0,
      accent: "#0CF2A0",
    },
    {
      icon: "🤖",
      title: "Agentes Inteligentes",
      description: "Agentes autônomos treinados para operar 24/7 em qualquer canal de comunicação.",
      items: ["Atendimento ao cliente", "Prospecção e vendas", "Suporte técnico"],
      delay: 0.1,
      accent: "#38BDF8",
    },
    {
      icon: "⚙️",
      title: "Automação",
      description: "Eliminamos retrabalho e integramos sistemas para que seu time foque no que importa.",
      items: ["Processos internos", "Integração de sistemas", "Fluxos inteligentes"],
      delay: 0.2,
      accent: "#A78BFA",
    },
    {
      icon: "📈",
      title: "Produtos & SaaS",
      description: "Soluções proprietárias desenvolvidas para mercados específicos com IA embutida.",
      items: ["Barber PRO", "APP AG LABS (mídia generativa)", "Agentes de IA · LPs & Sites"],
      delay: 0.3,
      accent: "#FB923C",
    },
  ];

  const steps = [
    {
      step: 1,
      title: "Diagnóstico do Negócio",
      description: "Mapeamos seus processos, gargalos e oportunidades para entender onde a IA gera mais valor.",
    },
    {
      step: 2,
      title: "Arquitetura da Solução",
      description: "Desenhamos a infraestrutura ideal: modelos, dados, integrações e agentes — sem over-engineering.",
    },
    {
      step: 3,
      title: "Implementação",
      description: "Desenvolvemos e entregamos a solução em produção com deploys rápidos e iterativos.",
    },
    {
      step: 4,
      title: "Operação e Evolução",
      description: "Monitoramos, refinamos e evoluímos continuamente. Sua IA aprende e escala com o negócio.",
    },
  ];

  const products = [
    { name: "Barber PRO", tag: "SaaS", delay: 0 },
    { name: "APP AG LABS", tag: "Mídia Generativa", delay: 0.1 },
    { name: "Agentes de IA", tag: "Produto", delay: 0.2 },
    { name: "LPs & Sites", tag: "Web", delay: 0.3 },
  ];

  return (
    <div className="relative bg-[#0F0F0F] text-gray-300 min-h-screen flex flex-col overflow-x-hidden">

      {/* ─── Navbar ─────────────────────────────────────────────────────── */}
      <motion.header
        variants={headerVariants}
        initial="top"
        animate={isScrolled ? "scrolled" : "top"}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="px-6 w-full md:px-10 lg:px-16 fixed top-0 z-30 backdrop-blur-md border-b"
      >
        <nav className="flex justify-between items-center max-w-screen-xl mx-auto h-[68px]">
          <a href="#" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-[#0CF2A0]/15 border border-[#0CF2A0]/40 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#0CF2A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#0CF2A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#0CF2A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">AG <span className="text-[#0CF2A0]">LABS</span></span>
          </a>

          <div className="hidden md:flex items-center justify-center flex-grow space-x-7 px-4">
            {["Infraestrutura", "Agentes", "Automação", "Produtos", "Como funciona"].map((item) => (
              <NavLink key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}>{item}</NavLink>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <motion.a
              href="#contato"
              className="hidden md:flex bg-[#0CF2A0] text-[#0F0F0F] px-4 py-[7px] rounded-md text-sm font-semibold hover:bg-[#0CF2A0]/90 transition-colors duration-200 whitespace-nowrap"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              Falar com a equipe
            </motion.a>
            <motion.button
              className="md:hidden text-gray-300 hover:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            >
              {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </motion.button>
          </div>
        </nav>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              variants={mobileMenuVariants} initial="hidden" animate="visible" exit="exit"
              className="md:hidden absolute top-full left-0 right-0 bg-[#0F0F0F]/97 backdrop-blur-sm shadow-lg py-5 border-t border-gray-800/50"
            >
              <div className="flex flex-col items-center gap-4 px-6">
                {["Infraestrutura", "Agentes", "Automação", "Produtos", "Como funciona"].map((item) => (
                  <NavLink key={item} href={`#${item.toLowerCase()}`} onClick={() => setIsMobileMenuOpen(false)}>{item}</NavLink>
                ))}
                <a href="#contato" onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-2 bg-[#0CF2A0] text-[#0F0F0F] px-5 py-2 rounded-md text-sm font-semibold">
                  Falar com a equipe
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pt-[120px] pb-24 flex flex-col items-center text-center px-4 overflow-hidden min-h-screen justify-center">
        <DotCanvas />
        <div className="absolute inset-0 z-[1] pointer-events-none" style={{
          background: 'linear-gradient(to bottom, transparent 30%, #0F0F0F 95%), radial-gradient(ellipse at center, transparent 30%, #0F0F0F 90%)'
        }} />

        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: contentDelay }}
            className="mb-6"
          >
            <span className="bg-[#161616] border border-[#0CF2A0]/20 text-[#0CF2A0] px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium">
              Agência especializada em Inteligência Artificial
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: contentDelay + 0.1 }}
            className="text-4xl sm:text-5xl lg:text-[68px] font-bold text-white leading-[1.1] max-w-4xl mb-5 tracking-tight"
          >
            Transformamos negócios com{" "}
            <span className="inline-block overflow-hidden align-bottom" style={{ height: "1.15em" }}>
              <RotatingText
                texts={["Agentes de IA", "Automação", "Infraestrutura", "Produtos SaaS"]}
                mainClassName="text-[#0CF2A0]"
                staggerFrom="last"
                initial={{ y: "-100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "110%", opacity: 0 }}
                staggerDuration={0.012}
                transition={{ type: "spring", damping: 18, stiffness: 250 }}
                rotationInterval={2400}
                splitBy="characters"
                auto loop
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: contentDelay + 0.25 }}
            className="text-base sm:text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Da infraestrutura ao produto final — criamos soluções de IA que operam, escalam e evoluem com o seu negócio.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: contentDelay + 0.35 }}
            className="flex flex-col sm:flex-row gap-3 items-center justify-center"
          >
            <motion.a
              href="#contato"
              className="bg-[#0CF2A0] text-[#0F0F0F] px-7 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-[#0CF2A0]/10"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              Começar agora <ChevronRightIcon />
            </motion.a>
            <motion.a
              href="#como-funciona"
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-7 py-3 rounded-lg text-sm font-medium transition-colors duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              Como funciona
            </motion.a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: contentDelay + 0.5 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500"
          >
            {["Infraestrutura de IA", "Agentes 24/7", "Automação inteligente", "Produtos SaaS"].map((tag, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#0CF2A0]" />
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── 4 Pilares ──────────────────────────────────────────────────── */}
      <section id="infraestrutura" className="relative py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-screen-xl mx-auto">
          <FadeInSection className="text-center mb-14">
            <span className="text-[#0CF2A0] text-xs font-semibold uppercase tracking-widest mb-3 block">Nossos Pilares</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              4 pilares que sustentam<br className="hidden sm:block" /> a sua transformação
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-base leading-relaxed">
              Cada pilar é uma área de especialização profunda. Juntos, formam um ecossistema completo de IA para o seu negócio.
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pillarCards.map((card) => (
              <PillarCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Como Funciona ──────────────────────────────────────────────── */}
      <section id="como-funciona" className="relative py-24 px-4 sm:px-6 lg:px-10">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 70% 50%, rgba(12,242,160,0.03) 0%, transparent 60%)'
        }} />
        <div className="max-w-screen-xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <FadeInSection>
              <span className="text-[#0CF2A0] text-xs font-semibold uppercase tracking-widest mb-3 block">Processo</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
                Do diagnóstico<br />à operação
              </h2>
              <p className="text-gray-400 text-base leading-relaxed mb-8">
                Um processo estruturado, sem surpresas. Trabalhamos lado a lado com seu time em cada etapa para garantir que a IA entregue resultado real.
              </p>
              <motion.a
                href="#contato"
                className="inline-flex items-center gap-2 bg-[#0CF2A0] text-[#0F0F0F] px-6 py-3 rounded-lg text-sm font-semibold"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                Agendar diagnóstico <ChevronRightIcon />
              </motion.a>
            </FadeInSection>

            <FadeInSection delay={0.15} className="flex flex-col pt-2">
              {steps.map((step, i) => (
                <StepCard key={step.step} {...step} delay={i * 0.1} isLast={i === steps.length - 1} />
              ))}
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ─── Produtos ───────────────────────────────────────────────────── */}
      <section id="produtos" className="relative py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-screen-xl mx-auto">
          <FadeInSection className="text-center mb-14">
            <span className="text-[#0CF2A0] text-xs font-semibold uppercase tracking-widest mb-3 block">Portfólio</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Produtos & SaaS
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-base leading-relaxed">
              Soluções proprietárias desenvolvidas pela AG LABS com IA embutida para mercados específicos.
            </p>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductBadge key={p.name} {...p} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Final ──────────────────────────────────────────────────── */}
      <section id="contato" className="relative py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-screen-xl mx-auto">
          <FadeInSection>
            <div className="relative bg-[#161616] border border-[#0CF2A0]/15 rounded-2xl p-10 sm:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 50% 0%, rgba(12,242,160,0.07) 0%, transparent 60%)'
              }} />
              <span className="text-[#0CF2A0] text-xs font-semibold uppercase tracking-widest mb-4 block">Pronto para começar?</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5 tracking-tight">
                Vamos construir sua<br />IA juntos
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto mb-8 text-base leading-relaxed">
                Fale com nossa equipe e descubra como a AG LABS pode transformar seus processos, produtos e resultados com IA.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                <motion.a
                  href="mailto:contato@aglabs.ai"
                  className="bg-[#0CF2A0] text-[#0F0F0F] px-8 py-3.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-[#0CF2A0]/15"
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  Falar com a equipe <ChevronRightIcon />
                </motion.a>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800/60 py-8 px-6 lg:px-16">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#0CF2A0]/10 border border-[#0CF2A0]/30 flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#0CF2A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#0CF2A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#0CF2A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-white">AG <span className="text-[#0CF2A0]">LABS</span></span>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} AG LABS. Todos os direitos reservados.</p>
          <div className="flex gap-5 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Termos</a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default AGLabsPage;
