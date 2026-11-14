"""Prueba el importador con el Excel real (se saltea si el Excel no está, por ejemplo en GitHub).
Uso:  python tools/test_importar.py
"""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import importar_excel as imp  # noqa: E402


@unittest.skipUnless(imp.EXCEL.exists(), "no está el Excel")
class TestImportar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.datos, cls.informe = imp.importar(imp.EXCEL, hoy=date(2026, 11, 13), ahora_ms=1)
        cls.dias = cls.datos["dias"]

    def test_inicio_y_hoy(self):
        self.assertEqual(self.dias["2026-03-02"]["peso"], 108.5)
        self.assertFalse(self.dias["2026-03-02"]["estimado"])
        self.assertEqual(self.dias["2026-11-13"]["peso"], 95.5)

    def test_relleno_marcado_como_estimado(self):
        self.assertTrue(self.dias["2025-10-01"]["estimado"])
        self.assertIsNone(self.dias["2025-10-01"]["comida"])
        self.assertEqual(self.dias["2025-09-09"]["peso"], 91.5)  # venía escrito "91,5"

    def test_colores(self):
        self.assertEqual(self.dias["2025-08-06"]["comida"], "plato")
        self.assertEqual(self.dias["2026-04-11"]["comida"], "justificado")
        self.assertEqual(self.dias["2025-03-22"]["comida"], "tentacion")
        self.assertTrue(self.dias["2025-06-03"]["ejercicio"])
        self.assertEqual(self.dias["2026-03-03"]["comida"], "bien")

    def test_semanas_dieta_2026(self):
        self.assertEqual(imp.contar_semanas(self.datos["marcasSemana"], "2026-03-02", "9999"), (19, 17))
        self.assertNotIn("2026-11-09", self.datos["marcasSemana"])  # semana en curso: la calcula la app

    def test_etapas(self):
        nombres = [e["nombre"] for e in self.datos["etapas"]]
        self.assertEqual(nombres, ["Dieta 2025", "Dieta 2026"])
        metas = self.datos["etapas"][1]["metas"]
        self.assertEqual([(m["peso"], m["fecha"]) for m in metas], [(83.6, None), (75, None)])

    def test_cuerpo(self):
        medidas = self.datos["medidas"]
        self.assertEqual(sorted(medidas), ["2026-03-02", "2026-04-27", "2026-05-14", "2026-08-04"])
        self.assertEqual(medidas["2026-04-27"]["bicepContraido"], 43.5)
        self.assertEqual(medidas["2026-05-14"]["grasa"], 37.1)
        self.assertEqual(self.datos["perfil"]["altura"], 167)


if __name__ == "__main__":
    unittest.main()
