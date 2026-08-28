import os
import json
import re
from PIL import Image
from pathlib import Path

def clean_name(txt):
    txt = txt.lower()
    txt = re.sub(r'[^a-z0-9]+', '_', txt)
    return txt.strip('_')

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    models_dir = Path("frontend/public/vehicles/models")
    
    with open("scripts/incoming_grok/ocr_results_all.json", "r", encoding="utf-8") as f:
        records = json.load(f)

    # Let's map each record carefully
    # We will define a structured parsing dictionary based on the 114 files
    mapping = {
        # HAVAL
        "BZS85.jpg": ("haval", "haval_h6_2020_present_lat.png", ["haval_h6_3ra_gen_2020_present_lat.png", "haval_h6_2020_2026_lat.png"]),
        "WTV6A.jpg": ("haval", "haval_h6_2020_present_top.png", ["haval_h6_3ra_gen_2020_present_top.png", "haval_h6_2020_2026_top.png"]),
        "Rt5Br.jpg": ("haval", "haval_jolion_2021_present_lat.png", ["haval_jolion_2021_2026_lat.png"]),
        "AY3X1.jpg": ("haval", "haval_jolion_2021_present_top.png", ["haval_jolion_2021_2026_top.png"]),
        "4YMIa.jpg": ("haval", "haval_dargo_2021_present_lat.png", ["haval_big_dog_2021_present_lat.png", "haval_dargo_2021_2026_lat.png"]),
        "sjUH6.jpg": ("haval", "haval_dargo_2021_present_top.png", ["haval_big_dog_2021_present_top.png", "haval_dargo_2021_2026_top.png"]),
        "Qe8Eb.jpg": ("haval", "haval_h7_2024_present_lat.png", ["haval_h7_2024_2026_lat.png"]),
        "yxxnl.jpg": ("haval", "haval_h7_2024_present_top.png", ["haval_h7_2024_2026_top.png"]),

        # GEELY
        "K5vyN.jpg": ("geely", "geely_coolray_2018_present_lat.png", ["geely_coolray_2018_2026_lat.png"]),
        "SCUA7.jpg": ("geely", "geely_coolray_2018_present_top.png", ["geely_coolray_2018_2026_top.png"]),
        "S9TA2.jpg": ("geely", "geely_gx3_pro_2017_present_lat.png", ["geely_gx3_pro_2017_2026_lat.png"]),
        "FJvLH.jpg": ("geely", "geely_gx3_pro_2017_present_top.png", ["geely_gx3_pro_2017_2026_top.png"]),

        # CHANGAN
        "eHNNh.jpg": ("changan", "changan_alsvin_plus_2021_present_lat.png", ["changan_alsvin_plus_2021_2026_lat.png"]),
        "BmQJG.jpg": ("changan", "changan_alsvin_plus_2021_present_top.png", ["changan_alsvin_plus_2021_2026_top.png"]),
        "zYl1w.jpg": ("changan", "changan_cs15_plus_2019_present_lat.png", ["changan_cs15_plus_2019_2026_lat.png", "changan_cs15_2019_present_lat.png"]),
        "Iea2G.jpg": ("changan", "changan_cs15_plus_2019_present_top.png", ["changan_cs15_plus_2019_2026_top.png", "changan_cs15_2019_present_top.png"]),
        "H8TfC.jpg": ("changan", "changan_cs55_plus_2021_present_lat.png", ["changan_cs55_plus_2021_2026_lat.png", "changan_cs55_2021_present_lat.png"]),
        "1Boaz.jpg": ("changan", "changan_cs55_plus_2021_present_top.png", ["changan_cs55_plus_2021_2026_top.png", "changan_cs55_2021_present_top.png"]),
        "gKnoX.jpg": ("changan", "changan_x7_plus_2020_present_lat.png", ["changan_x7_plus_2020_2026_lat.png", "changan_x7_2020_present_lat.png"]),
        "iwHBy.jpg": ("changan", "changan_x7_plus_2020_present_top.png", ["changan_x7_plus_2020_2026_top.png", "changan_x7_2020_present_top.png"]),
        "pk8EN.jpg": ("changan", "changan_uni_t_2020_present_lat.png", ["changan_unit_2020_present_lat.png", "changan_uni_t_2020_2026_lat.png"]),
        "vwW86.jpg": ("changan", "changan_uni_t_2020_present_top.png", ["changan_unit_2020_present_top.png", "changan_uni_t_2020_2026_top.png"]),
        "1Px2u.jpg": ("changan", "changan_uni_k_2021_present_lat.png", ["changan_unik_2021_present_lat.png", "changan_uni_k_2021_2026_lat.png"]),
        "LGmol.jpg": ("changan", "changan_uni_k_2021_present_top.png", ["changan_unik_2021_present_top.png", "changan_uni_k_2021_2026_top.png"]),
        "rQKhB.jpg": ("changan", "changan_cs75_plus_2019_present_lat.png", ["changan_cs75_plus_2019_2026_lat.png", "changan_cs75_2019_present_lat.png"]),
        "k2e05.jpg": ("changan", "changan_cs75_plus_2019_present_top.png", ["changan_cs75_plus_2019_2026_top.png", "changan_cs75_2019_present_top.png"]),
        "zuMbs.jpg": ("changan", "changan_cm5_panel_2020_present_lat.png", ["changan_cm5_panel_2020_2026_lat.png", "changan_star_panel_2020_present_lat.png"]),
        "15Tgt.jpg": ("changan", "changan_cm5_panel_2020_present_top.png", ["changan_cm5_panel_2020_2026_top.png", "changan_star_panel_2020_present_top.png"]),
        "jbowP.jpg": ("changan", "changan_star_truck_2020_present_lat.png", ["changan_star_truck_2020_2026_lat.png", "changan_star_pickup_2020_present_lat.png"]),
        "KLers.jpg": ("changan", "changan_star_truck_2020_present_top.png", ["changan_star_truck_2020_2026_top.png", "changan_star_pickup_2020_present_top.png"]),
        "SzzRh.jpg": ("changan", "changan_cm5_cargo_2020_present_lat.png", ["changan_cm5_cargo_2020_2026_lat.png", "changan_cm5_pickup_2020_present_lat.png"]),
        "at6Ah.jpg": ("changan", "changan_cm5_cargo_2020_present_top.png", ["changan_cm5_cargo_2020_2026_top.png", "changan_cm5_pickup_2020_present_top.png"]),
        "nwx43.jpg": ("changan", "changan_cm5_box_2020_present_lat.png", ["changan_cm5_box_2020_2026_lat.png", "changan_cm5_furgo_2020_present_lat.png"]),
        "wWeWs.jpg": ("changan", "changan_cm5_box_2020_present_top.png", ["changan_cm5_box_2020_2026_top.png", "changan_cm5_furgo_2020_present_top.png"]),
        "EqyJZ.jpg": ("changan", "changan_alsvin_2018_present_lat.png", ["changan_alsvin_sedan_2018_present_lat.png", "changan_alsvin_2018_2026_lat.png"]),
        "X4bsN.jpg": ("changan", "changan_alsvin_2018_present_top.png", ["changan_alsvin_sedan_2018_present_top.png", "changan_alsvin_2018_2026_top.png"]),

        # GWM / TANK
        "Jy84D.jpg": ("greatwall", "gwm_tank300_2021_present_lat.png", ["tank_300_2021_present_lat.png", "greatwall_tank300_2021_present_lat.png", "gwm_tank300_2021_2026_lat.png"]),
        "S4h7J.jpg": ("greatwall", "gwm_tank300_2021_present_top.png", ["tank_300_2021_present_top.png", "greatwall_tank300_2021_present_top.png", "gwm_tank300_2021_2026_top.png"]),
        "SJdd6.jpg": ("greatwall", "greatwall_wingle7_2018_present_lat.png", ["gwm_wingle7_2018_present_lat.png", "greatwall_wingle7_2018_2026_lat.png"]),
        "LusJ0.jpg": ("greatwall", "greatwall_wingle7_2018_present_top.png", ["gwm_wingle7_2018_present_top.png", "greatwall_wingle7_2018_2026_top.png"]),

        # GAC MOTOR
        "q9Hjs.jpg": ("gac", "gac_emzoom_2023_present_lat.png", ["gac_emzoom_2023_2026_lat.png", "gac_gs3_emzoom_2023_present_lat.png"]),
        "148FT.jpg": ("gac", "gac_emzoom_2023_present_top.png", ["gac_emzoom_2023_2026_top.png", "gac_gs3_emzoom_2023_present_top.png"]),
        "b4Lxy.jpg": ("gac", "gac_gs8_2021_present_lat.png", ["gac_gs8_2021_2026_lat.png", "gac_gs8_7plazas_2021_present_lat.png"]),
        "UletV.jpg": ("gac", "gac_gs8_2021_present_top.png", ["gac_gs8_2021_2026_top.png", "gac_gs8_7plazas_2021_present_top.png"]),
        "ePLsF.jpg": ("gac", "gac_m6_pro_2021_present_lat.png", ["gac_m6_pro_2021_2026_lat.png", "gac_m6pro_2021_present_lat.png", "gac_gn6_2021_present_lat.png"]),
        "7k7Am.jpg": ("gac", "gac_m6_pro_2021_present_top.png", ["gac_m6_pro_2021_2026_top.png", "gac_m6pro_2021_present_top.png", "gac_gn6_2021_present_top.png"]),
        "8LPpo.jpg": ("gac", "gac_gs4_max_2023_present_lat.png", ["gac_gs4_max_2023_2026_lat.png", "gac_gs4max_2023_present_lat.png"]),
        "TsAzB.jpg": ("gac", "gac_gs4_max_2023_present_top.png", ["gac_gs4_max_2023_2026_top.png", "gac_gs4max_2023_present_top.png"]),
        "9Fy6Z.jpg": ("gac", "gac_emkoo_2022_present_lat.png", ["gac_emkoo_2022_2026_lat.png"]),
        "E5eix.jpg": ("gac", "gac_emkoo_2022_present_top.png", ["gac_emkoo_2022_2026_top.png"]),
        "2ii22.jpg": ("gac", "gac_s7_hybrid_2025_present_lat.png", ["gac_s7_2025_present_lat.png", "gac_s7_hybrid_2025_2026_lat.png"]),
        "4WLmb.jpg": ("gac", "gac_s7_hybrid_2025_present_top.png", ["gac_s7_2025_present_top.png", "gac_s7_hybrid_2025_2026_top.png"]),
        "xgy29.jpg": ("gac", "gac_e8_hybrid_2023_present_lat.png", ["gac_e8_2023_present_lat.png", "gac_e8_hybrid_2023_2026_lat.png"]),
        "XdXJm.jpg": ("gac", "gac_e8_hybrid_2023_present_top.png", ["gac_e8_2023_present_top.png", "gac_e8_hybrid_2023_2026_top.png"]),

        # JAC
        "BqxfW.jpg": ("jac", "jac_js2_2021_present_lat.png", ["jac_js2_2021_2026_lat.png", "jac_s2_2021_present_lat.png"]),
        "5GxGd.jpg": ("jac", "jac_js2_2021_present_top.png", ["jac_js2_2021_2026_top.png", "jac_s2_2021_present_top.png"]),
        "jYotB.jpg": ("jac", "jac_js4_2020_present_lat.png", ["jac_js4_2020_2026_lat.png", "jac_s4_2020_present_lat.png"]),
        "b949S.jpg": ("jac", "jac_js4_2020_present_top.png", ["jac_js4_2020_2026_top.png", "jac_s4_2020_present_top.png"]),
        "y9QUX.jpg": ("jac", "jac_t8_2018_present_lat.png", ["jac_t8_pickup_2018_present_lat.png", "jac_t8_pro_2018_present_lat.png", "jac_t8_2018_2026_lat.png"]),
        "yElRy.jpg": ("jac", "jac_t8_2018_present_top.png", ["jac_t8_pickup_2018_present_top.png", "jac_t8_pro_2018_present_top.png", "jac_t8_2018_2026_top.png"]),
        "aXG1z.jpg": ("jac", "jac_js6_2022_present_lat.png", ["jac_js6_2022_2026_lat.png", "jac_s6_2022_present_lat.png"]),
        "ileaF.jpg": ("jac", "jac_js6_2022_present_top.png", ["jac_js6_2022_2026_top.png", "jac_s6_2022_present_top.png"]),
        "nVVYF.jpg": ("jac", "jac_t9_2023_present_lat.png", ["jac_t9_pickup_2023_present_lat.png", "jac_t9_hunter_2023_present_lat.png", "jac_t9_2023_2026_lat.png"]),
        "EUKKE.jpg": ("jac", "jac_t9_2023_present_top.png", ["jac_t9_pickup_2023_present_top.png", "jac_t9_hunter_2023_present_top.png", "jac_t9_2023_2026_top.png"]),
        "saFy9.jpg": ("jac", "jac_x200_2015_present_lat.png", ["jac_x200_camion_2015_present_lat.png", "jac_x200_2015_2026_lat.png"]),
        "lB6Fi.jpg": ("jac", "jac_x200_2015_present_top.png", ["jac_x200_camion_2015_present_top.png", "jac_x200_2015_2026_top.png"]),
        "oX31n.jpg": ("jac", "jac_1042kn_2010_present_lat.png", ["jac_hfc1042_2010_present_lat.png", "jac_1042kn_2010_2026_lat.png", "jac_camion_3.5t_2010_present_lat.png"]),
        "5YTdb.jpg": ("jac", "jac_1042kn_2010_present_top.png", ["jac_hfc1042_2010_present_top.png", "jac_1042kn_2010_2026_top.png", "jac_camion_3.5t_2010_present_top.png"]),
        "0Y9Q2.jpg": ("jac", "jac_n90_pro_2018_present_lat.png", ["jac_n90pro_2018_present_lat.png", "jac_n90_2018_present_lat.png", "jac_n90_pro_2018_2026_lat.png"]),
        "RnoFF.jpg": ("jac", "jac_n90_pro_2018_present_top.png", ["jac_n90pro_2018_present_top.png", "jac_n90_2018_present_top.png", "jac_n90_pro_2018_2026_top.png"]),

        # DFSK
        "VAAUY.jpg": ("dfsk", "dfsk_glory_500_2019_present_lat.png", ["dfsk_glory500_2019_present_lat.png", "dfsk_500_2019_present_lat.png", "dfsk_glory_500_2019_2026_lat.png"]),
        "tlCY8.jpg": ("dfsk", "dfsk_glory_500_2019_present_top.png", ["dfsk_glory500_2019_present_top.png", "dfsk_500_2019_present_top.png", "dfsk_glory_500_2019_2026_top.png"]),
        "Xiy5v.jpg": ("dfsk", "dfsk_glory_560_2018_present_lat.png", ["dfsk_glory560_2018_present_lat.png", "dfsk_560_2018_present_lat.png", "dfsk_glory_560_2018_2026_lat.png"]),
        "Eamw2.jpg": ("dfsk", "dfsk_glory_560_2018_present_top.png", ["dfsk_glory560_2018_present_top.png", "dfsk_560_2018_present_top.png", "dfsk_glory_560_2018_2026_top.png"]),
        "iVHn8.jpg": ("dfsk", "dfsk_c32_2015_present_lat.png", ["dfsk_c32_pickup_2015_present_lat.png", "dfsk_c32_2015_2026_lat.png"]),
        "mfiCq.jpg": ("dfsk", "dfsk_c32_2015_present_top.png", ["dfsk_c32_pickup_2015_present_top.png", "dfsk_c32_2015_2026_top.png"]),
        "Xeycz.jpg": ("dfsk", "dfsk_c31_2015_present_lat.png", ["dfsk_c31_pickup_2015_present_lat.png", "dfsk_c31_2015_2026_lat.png"]),
        "OS76N.jpg": ("dfsk", "dfsk_c31_2015_present_top.png", ["dfsk_c31_pickup_2015_present_top.png", "dfsk_c31_2015_2026_top.png"]),
        "9bvt9.jpg": ("dfsk", "dfsk_c35_2015_present_lat.png", ["dfsk_c35_van_2015_present_lat.png", "dfsk_c35_panel_2015_present_lat.png", "dfsk_c35_2015_2026_lat.png"]),
        "bSy6N.jpg": ("dfsk", "dfsk_c35_2015_present_top.png", ["dfsk_c35_van_2015_present_top.png", "dfsk_c35_panel_2015_present_top.png", "dfsk_c35_2015_2026_top.png"]),
        "UhNDb.jpg": ("dfsk", "dfsk_c37_2015_present_lat.png", ["dfsk_c37_van_2015_present_lat.png", "dfsk_c37_pasajeros_2015_present_lat.png", "dfsk_c37_2015_2026_lat.png"]),
        "ajoWr.jpg": ("dfsk", "dfsk_c37_2015_present_top.png", ["dfsk_c37_van_2015_present_top.png", "dfsk_c37_pasajeros_2015_present_top.png", "dfsk_c37_2015_2026_top.png"]),
        "G5sgN.jpg": ("dfsk", "dfsk_k05s_2015_present_lat.png", ["dfsk_k05s_minitruck_2015_present_lat.png", "dfsk_k05s_2015_2026_lat.png"]),
        "jDPZU.jpg": ("dfsk", "dfsk_k05s_2015_present_top.png", ["dfsk_k05s_minitruck_2015_present_top.png", "dfsk_k05s_2015_2026_top.png"]),

        # BYD
        "6s5Hl.jpg": ("byd", "byd_f3_2005_present_lat.png", ["byd_f3_sedan_2005_present_lat.png", "byd_f3_2005_2026_lat.png"]),
        "7yKv1.jpg": ("byd", "byd_f3_2005_present_top.png", ["byd_f3_sedan_2005_present_top.png", "byd_f3_2005_2026_top.png"]),
        "ix78y.jpg": ("byd", "byd_s6_2011_present_lat.png", ["byd_s6_suv_2011_present_lat.png", "byd_s6_2011_2026_lat.png"]),
        "P1E1a.jpg": ("byd", "byd_s6_2011_present_top.png", ["byd_s6_suv_2011_present_top.png", "byd_s6_2011_2026_top.png"]),
        "DvtqE.jpg": ("byd", "byd_f0_2008_2015_lat.png", ["byd_f0_hatchback_2008_2015_lat.png", "byd_f0_2008_2026_lat.png"]),
        "0TvHg.jpg": ("byd", "byd_f0_2008_2015_top.png", ["byd_f0_hatchback_2008_2015_top.png", "byd_f0_2008_2026_top.png"]),
        "3SuTs.jpg": ("byd", "byd_m6_2010_2017_lat.png", ["byd_m6_minivan_2010_2017_lat.png", "byd_m6_2010_2026_lat.png"]),
        "iTTg1.jpg": ("byd", "byd_m6_2010_2017_top.png", ["byd_m6_minivan_2010_2017_top.png", "byd_m6_2010_2026_top.png"]),
        "5Xcwa.jpg": ("byd", "byd_f3_classic_2005_2018_lat.png", ["byd_f3_2005_2018_lat.png"]),
        "xgyY8.jpg": ("byd", "byd_f3_classic_2005_2018_top.png", ["byd_f3_2005_2018_top.png"]),

        # CHANGHE
        "QnNlD.jpg": ("changhe", "changhe_panel_2010_present_lat.png", ["changhe_panel_van_2010_present_lat.png", "changhe_panel_2010_2026_lat.png"]),
        "pcEHg.jpg": ("changhe", "changhe_panel_2010_present_top.png", ["changhe_panel_van_2010_present_top.png", "changhe_panel_2010_2026_top.png"]),
        "dMrNc.jpg": ("changhe", "changhe_1_cabina_2010_present_lat.png", ["changhe_pickup_sencilla_2010_present_lat.png", "changhe_1_cabina_2010_2026_lat.png"]),
        "KE796.jpg": ("changhe", "changhe_1_cabina_2010_present_top.png", ["changhe_pickup_sencilla_2010_present_top.png", "changhe_1_cabina_2010_2026_top.png"]),

        # FOTON
        "fdcTc.jpg": ("foton", "foton_gratour_2014_present_lat.png", ["foton_gratour_pickup_2014_present_lat.png", "foton_gratour_2014_2026_lat.png"]),
        "bpwr5.jpg": ("foton", "foton_gratour_2014_present_top.png", ["foton_gratour_pickup_2014_present_top.png", "foton_gratour_2014_2026_top.png"]),
        "zebCa.jpg": ("foton", "foton_tm2_pro_2018_present_lat.png", ["foton_tm2_2.5t_2018_present_lat.png", "foton_tm2_pro_2018_2026_lat.png"]),
        "AkQ4C.jpg": ("foton", "foton_tm2_pro_2018_present_top.png", ["foton_tm2_2.5t_2018_present_top.png", "foton_tm2_pro_2018_2026_top.png"]),
        "Ihuow.jpg": ("foton", "foton_camion_3t_2012_present_lat.png", ["foton_aumark_3t_2012_present_lat.png", "foton_camion_3t_2012_2026_lat.png"]),
        "brNYw.jpg": ("foton", "foton_camion_3t_2012_present_top.png", ["foton_aumark_3t_2012_present_top.png", "foton_camion_3t_2012_2026_top.png"]),
        "DAvLP.jpg": ("foton", "foton_camion_4t_2012_present_lat.png", ["foton_aumark_4t_2012_present_lat.png", "foton_camion_4t_2012_2026_lat.png"]),
        "52KB2.jpg": ("foton", "foton_camion_4t_2012_present_top.png", ["foton_aumark_4t_2012_present_top.png", "foton_camion_4t_2012_2026_top.png"]),
        "vcRpt.jpg": ("foton", "foton_camion_6t_2012_present_lat.png", ["foton_aumark_6t_2012_present_lat.png", "foton_camion_6t_2012_2026_lat.png"]),
        "paW0v.jpg": ("foton", "foton_camion_6t_2012_present_top.png", ["foton_aumark_6t_2012_present_top.png", "foton_camion_6t_2012_2026_top.png"]),

        # BAIC
        "PWBhF.jpg": ("baic", "baic_x35_2016_present_lat.png", ["baic_x35_suv_2016_present_lat.png", "baic_x35_2016_2026_lat.png"]),
        "lowgw.jpg": ("baic", "baic_x35_2016_present_top.png", ["baic_x35_suv_2016_present_top.png", "baic_x35_2016_2026_top.png"]),
        "IKNpR.jpg": ("baic", "baic_x55_2016_present_lat.png", ["baic_x55_suv_2016_present_lat.png", "baic_x55_2016_2026_lat.png"]),
        "mEaMn.jpg": ("baic", "baic_x55_2016_present_top.png", ["baic_x55_suv_2016_present_top.png", "baic_x55_2016_2026_top.png"]),
        "m7OVG.jpg": ("baic", "baic_bj40_2014_present_lat.png", ["baic_bj40_4x4_2014_present_lat.png", "baic_bj40_2014_2026_lat.png"]),
        "q1Ykf.jpg": ("baic", "baic_bj40_2014_present_top.png", ["baic_bj40_4x4_2014_present_top.png", "baic_bj40_2014_2026_top.png"]),
    }

    count_ingested = 0
    brands_updated = set()

    for src_name, (brand, dest_name, aliases) in mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"[MISSING] {src_path}")
            continue
            
        target_dir = models_dir / brand
        target_dir.mkdir(parents=True, exist_ok=True)
        dest_path = target_dir / dest_name
        
        im = Image.open(src_path)
        im.save(dest_path, "PNG", optimize=True)
        count_ingested += 1
        brands_updated.add(brand)
        print(f"[OK] {brand.upper():<10} | {src_name} -> {dest_name} ({im.size})")

        for alias in aliases:
            alias_path = target_dir / alias
            im.save(alias_path, "PNG", optimize=True)
            print(f"     [ALIAS] {alias}")

    print(f"\nSuccessfully ingested {count_ingested} blueprints across {len(brands_updated)} brands: {', '.join(sorted(brands_updated))}")

if __name__ == "__main__":
    main()
