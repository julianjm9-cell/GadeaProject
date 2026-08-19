from __future__ import annotations

from adult_app_launcher import AdultAppConfig, run


CONFIG = AdultAppConfig(
    app_name="Acceso Universidad Adultos",
    html_file="apps/universidad-25/index.html",
    data_dir_name="UniversidadAdultos_Data",
    client_app="universidad_adultos",
    license_label="UNIVERSIDAD_ADULTOS",
)


if __name__ == "__main__":
    raise SystemExit(run(CONFIG))
