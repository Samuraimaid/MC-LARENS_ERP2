const path = require("path");

// Inline map load (CJS) — generated from lucideAnimatedMap.js
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
      const bits = part.split(/\s+as\s+/);
      if (bits.length === 2) {
        return { imported: bits[0].trim(), local: bits[1].trim() };
      }
      return { imported: part, local: part };
    })
    .filter(Boolean);
}

function lucideAnimatedBridgePlugin() {
  const wrapPath = "@/icons/createAnimatedLucideIcon";

  return {
    name: "lucide-animated-bridge",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(jsx?|tsx?)$/.test(id)) return null;
      if (id.includes("node_modules")) return null;
      if (id.includes(`${path.sep}src${path.sep}icons${path.sep}`)) return null;

      const importRe = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']\s*;?/g;
      let matched = false;

      const out = code.replace(importRe, (full, spec) => {
        const names = parseNamedImports(spec);
        if (!names.length) return full;
        matched = true;

        const animSet = new Set();
        const staticParts = [];
        const bindings = [];

        names.forEach(({ imported, local }) => {
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
        });

        let block = `import { createAnimatedLucideIcon } from "${wrapPath}";\n`;
        block += `import { ${staticParts.join(", ")} } from "lucide-react-raw";\n`;
        if (animSet.size) {
          block += `import { ${[...animSet].join(", ")} } from "lucide-animated";\n`;
        }
        if (bindings.length) {
          block += `${bindings.join("\n")}\n`;
        }
        return block;
      });

      if (!matched) return null;
      return { code: out, map: null };
    },
  };
}

module.exports = { lucideAnimatedBridgePlugin };
