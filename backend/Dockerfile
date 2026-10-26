FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app
COPY apps/ocr/index.html /app/app/ocr_engine/aliot-suite.html
COPY apps/diplomator/index.html /app/app/static/student.html
COPY apps/diplomator/assets/diplomator-refresh.css /app/app/static/assets/diplomator-refresh.css
COPY apps/cambridge/index.html /app/app/static/cambridge.html
COPY apps/u25/index.html /app/app/static/universidad-adultos.html
COPY apps/e25/index.html /app/app/static/eso-adultos.html
COPY apps/e25/assets/eso-final.css /app/app/static/assets/eso-final.css
COPY apps/e25/assets/eso-games.js /app/app/static/assets/eso-games.js
COPY apps/ocr/index.html /app/app/static/ocr-facturas-app.html
COPY apps/profesor/index.html /app/app/static/profesor-particular.html
COPY apps/profesor/profesor-temario.js /app/app/static/assets/profesor-temario.js
COPY apps/profesor/temario-presentation.js /app/app/static/assets/temario-presentation.js
COPY apps/profesor/profesor-temario-depth.js /app/app/static/assets/profesor-temario-depth.js
COPY apps/profesor/profesor-spanish.js /app/app/static/assets/profesor-spanish.js
COPY apps/profesor/profesor-temario-revision.js /app/app/static/assets/profesor-temario-revision.js
COPY apps/profesor/profesor-support.js /app/app/static/assets/profesor-support.js
COPY apps/profesor/profesor-uploaded-topics.js /app/app/static/assets/profesor-uploaded-topics.js
COPY apps/profesor/profesor-activity-play.js /app/app/static/assets/profesor-activity-play.js
COPY apps/profesor/profesor-generator.js /app/app/static/assets/profesor-generator.js
COPY apps/profesor/profesor-rich-text.js /app/app/static/assets/profesor-rich-text.js
COPY apps/profesor/profesor-access.js /app/app/static/assets/profesor-access.js
COPY apps/profesor/profesor-sentence-board.js /app/app/static/assets/profesor-sentence-board.js
COPY apps/profesor/profesor-puzzle-boards.js /app/app/static/assets/profesor-puzzle-boards.js
COPY apps/profesor/profesor-challenge-games.js /app/app/static/assets/profesor-challenge-games.js
COPY apps/profesor/profesor-notifications.js /app/app/static/assets/profesor-notifications.js
COPY apps/profesor/profesor-subjects.js /app/app/static/assets/profesor-subjects.js
COPY apps/profesor/profesor-profile.js /app/app/static/assets/profesor-profile.js
COPY apps/profesor/profesor-public-games-extra.js /app/app/static/assets/profesor-public-games-extra.js
COPY apps/profesor/profesor-mini-games.js /app/app/static/assets/profesor-mini-games.js
COPY apps/profesor/profesor-live-sync.js /app/app/static/assets/profesor-live-sync.js
COPY apps/profesor/profesor-live.js /app/app/static/assets/profesor-live.js
COPY apps/profesor/profesor-state-history.js /app/app/static/assets/profesor-state-history.js
COPY apps/profesor/profesor-editor-recovery.js /app/app/static/assets/profesor-editor-recovery.js
COPY apps/profesor/assets /app/app/static/assets
COPY apps/e25/assets/desk /app/app/static/assets/desk
COPY marketing/app_landings_demo /app/app/static/marketing

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
