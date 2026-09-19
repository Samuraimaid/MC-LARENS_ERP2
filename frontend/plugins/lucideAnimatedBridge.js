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
 * Animated imports are always aliased as __la_<local> so names like
 * `Link as LinkIcon` never collide with lucide-animated's `LinkIcon` export.
 */
function lucideAnimatedBridgePlugin() {
  const wrapPath = "@/icons/createAnimatedLucideIcon";
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

      // animExport -> Set of __la_<local> aliases that need it
      const animImportAliases = []; // { exportName, alias }
      const seenAnimAlias = new Set();
      const staticParts = [];
      const bindings = [];
      const seenLocal = new Set();

      for (const match of matches) {
        for (const { imported, local } of parseNamedImports(match[1])) {
          if (seenLocal.has(local)) continue;
          seenLocal.add(local);

          const anim = animatedExportName(imported);
          if (anim) {
            const laAlias = `__la_${local}`;
            if (!seenAnimAlias.has(laAlias)) {
              seenAnimAlias.add(laAlias);
              animImportAliases.push({ exportName: anim, alias: laAlias });
            }
            staticParts.push(`${imported} as __lr_${local}`);
            bindings.push(
              `const ${local} = createAnimatedLucideIcon(${laAlias}, __lr_${local}, ${JSON.stringify(imported)});`
            );
          } else {
            staticParts.push(imported === local ? imported : `${imported} as ${local}`);
          }
        }
      }

      let block = `import { createAnimatedLucideIcon } from "${wrapPath}";\n`;
      block += `import { ${staticParts.join(", ")} } from "lucide-react-raw";\n`;
      if (animImportAliases.length) {
        const animClause = animImportAliases
          .map(({ exportName, alias }) =>
            exportName === alias ? exportName : `${exportName} as ${alias}`
          )
          .join(", ");
        block += `import { ${animClause} } from "lucide-animated";\n`;
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
