from backend.domains.search.product_search_soft import (
    build_product_search_or_clauses,
    expand_search_terms,
    expand_search_token,
    normalize_search_input,
)


def test_normalize_ds18_spaced_forms():
    assert normalize_search_input("DS 18") == "ds18"
    assert normalize_search_input("DSS-18") == "ds18"
    assert normalize_search_input("  DLLA  ") == "dlla"


def test_expand_brand_aliases():
    assert "dlaa" in expand_search_token("dlla")
    assert "ds18" in expand_search_token("dss18")
    assert "fox" in expand_search_token("foox")


def test_expand_search_terms_includes_aliases():
    terms = expand_search_terms("DLLA")
    assert "dlla" in terms and "dlaa" in terms
    terms2 = expand_search_terms("DS 18")
    assert "ds18" in terms2


def test_build_or_clauses_escape_and_alias():
    clauses = build_product_search_or_clauses("DLLA")
    brands = [c["brand"]["$regex"] for c in clauses if "brand" in c]
    assert "dlla" in brands
    assert "dlaa" in brands
    # metacharacters escaped
    clauses2 = build_product_search_or_clauses("A+B")
    assert any(c.get("sku", {}).get("$regex") == r"a\+b" for c in clauses2)


def test_empty_returns_empty():
    assert build_product_search_or_clauses("") == []
    assert build_product_search_or_clauses("   ") == []
