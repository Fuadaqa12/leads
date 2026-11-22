"""
Демо-сайты для портфолио Fuad.studio (вымышленные бизнесы, без отзывов и рейтингов).
Кнопки WhatsApp ведут к Фуаду — кто нажмёт, тот пишет прямо тебе.
Запуск: python portfolio_demos.py  → docs/sites/demo-*/index.html
"""
import os
from demo_site import render_demo

HERE = os.path.dirname(os.path.abspath(__file__))
WA = "994555032748"
WEEK = [[600, 1260]] * 6 + [[660, 1200]]

DEMOS = [
    dict(slug="demo-usta-barber", name="Usta Barber", kind="barber", district="Насими",
         address="Nizami küç., Bakı", loc=[40.3777, 49.8460], hours=WEEK,
         amen=["card", "parking", "kids"]),
    dict(slug="demo-lale-beauty", name="Lale Beauty", kind="beauty", district="Ясамал",
         address="Şərifzadə küç., Bakı", loc=[40.3893, 49.8166], hours=[[600, 1200]] * 7,
         amen=["card", "kids"]),
    dict(slug="demo-aqua-detailing", name="Aqua Detailing", kind="carwash", district="Хатаи",
         address="Babək pr., Bakı", loc=[40.3870, 49.9390], hours=[[0, 1440]] * 7,
         amen=["card", "parking"]),
    dict(slug="demo-smile-dental", name="Smile Dental", kind="dental", district="Нариманов",
         address="Təbriz küç., Bakı", loc=[40.4040, 49.8700], hours=[[540, 1140]] * 6 + [[600, 960]],
         amen=["card", "parking", "wheelchair"]),
]


def main():
    for d in DEMOS:
        lead = dict(d, wa=WA, phone="+994 55 503 27 48", city="Bakı")
        out = os.path.join(HERE, "docs", "sites", d["slug"])
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
            f.write(render_demo(lead))
        print("ok", out)


if __name__ == "__main__":
    main()
