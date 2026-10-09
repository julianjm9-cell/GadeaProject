"""Delete only this deployer's completed backup directories older than 30 days."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
import shutil


def prune(root: Path, now: datetime | None = None) -> int:
    root = root.resolve()
    if not root.is_dir():
        return 0
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=30)
    count = 0
    for candidate in root.iterdir():
        match = re.fullmatch(r"deploy-(\d{8}T\d{6}Z)-[A-Za-z0-9]{6}", candidate.name)
        if not match or candidate.is_symlink() or not candidate.is_dir():
            continue
        target = candidate.resolve()
        if target.parent != root:
            raise RuntimeError("Backup outside the expected directory")
        created = datetime.strptime(match[1], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        if created >= cutoff or not (target / "database.dump").is_file() or not (target / "environment.env").is_file():
            continue
        shutil.rmtree(target)
        count += 1
    return count


if __name__ == "__main__":
    print(f"Copias caducadas eliminadas: {prune(Path(__file__).resolve().parents[1] / 'backups')}")
