const path = require("path");

const { LUCIDE_ANIMATED_MAP } = require("./lucideAnimatedMap.cjs");

function animatedExportName(lucideName) {
  return LUCIDE_ANIMATED_MAP[lucideName] || null;
}

function parseNamedImports(spec) {
  return spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("type ")) return null;
      // strip line comments remnants / newlines
      const clean = part.replace(/\n/g, " ").trim();
      if (!clean) return null;
      const bits = clean.split(/\s+as\s+/);
      if (bits.length === 2) {
        return { imported: bits[0].trim(), local: bits[1].trim() };
      }
      return { imported: clean, local: clean };
    })
    .filter(Boolean);
}

/**
 * Rewrites all `import { … } from "lucide-react"` in a file in one pass.
 * Uses [^}]+ so we never span other imports between brace groups.
 * Dedupes wrapper/animated imports when a file has multiple lucide import lines.
 */
function lucideAnimatedBridgePlugin() {
  const wrapPath = "@/icons/createAnimatedLucideIcon";
  // [^}]+ keeps each match to a single import {...} group (multiline names OK; nested braces are not used by lucide).
  const importRe = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']\s*;?/g;

  return {
    name: "lucide-animated-bridge",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(jsx?|tsx?)$/.test(id)) return null;
      if (id.includes("node_modules")) return null;
      if (id.includes(`${path.sep}src${path.sep}icons${path.sep}`)) return null;

      const matches = [...code.matchAll(importRe)];
      if (!matches.length) return null;

      const animSet = new Set();
      const staticParts = [];
      const bindings = [];
      const seenLocal = new Set();

      for (const match of matches) {
        for (const { imported, local } of parseNamedImports(match[1])) {
          if (seenLocal.has(local)) continue;
          seenLocal.add(local);

          const anim = animatedExportName(imported);
          if (anim) {
            animSet.add(anim);
            staticParts.push(`${imported} as __lr_${local}`);
            bindings.push(
              `const ${local} = createAnimatedLucideIcon(${anim}, __lr_${local}, ${JSON.stringify(imported)});`
            );
          } else {
            staticParts.push(imported === local ? imported : `${imported} as ${local}`);
          }
        }
      }

      let block = `import { createAnimatedLucideIcon } from "${wrapPath}";\n`;
      block += `import { ${staticParts.join(", ")} } from "lucide-react-raw";\n`;
      if (animSet.size) {
        block += `import { ${[...animSet].join(", ")} } from "lucide-animated";\n`;
      }
      if (bindings.length) {
        block += `${bindings.join("\n")}\n`;
      }

      let out = code;
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const m = matches[i];
        const start = m.index;
        const end = start + m[0].length;
        const insertion = i === 0 ? block : "";
        out = out.slice(0, start) + insertion + out.slice(end);
      }

      return { code: out, map: null };
    },
  };
}

module.exports = { lucideAnimatedBridgePlugin };
