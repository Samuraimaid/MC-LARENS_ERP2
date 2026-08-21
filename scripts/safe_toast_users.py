import re

with open("frontend/src/pages/UsersAdminPage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add getErrorMessage function if not present
if "const getErrorMessage =" not in content:
    helper = """const getErrorMessage = (error, fallback = "Ocurrió un error inesperado") => {
  const detail = error?.response?.data?.detail ?? error?.message;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    return detail.message || detail.error || JSON.stringify(detail);
  }
  return fallback;
};

"""
    # Insert before export function UsersAdminPage
    content = content.replace("export function UsersAdminPage() {", helper + "export function UsersAdminPage() {")

# Replace pattern: toast.error(error.response?.data?.detail || "FALLBACK");
# or toast.error(error.response?.data?.detail || 'FALLBACK');
pattern = r'toast\.error\(\s*error\.response\?\.data\?\.detail\s*\|\|\s*(["\'][^"\']+["\'])\s*\)'

def repl(m):
    fallback = m.group(1)
    return f'toast.error(getErrorMessage(error, {fallback}))'

content_new = re.sub(pattern, repl, content)

with open("frontend/src/pages/UsersAdminPage.jsx", "w", encoding="utf-8") as f:
    f.write(content_new)

print("Updated UsersAdminPage.jsx with safe error message handling!")
