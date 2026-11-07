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
COPY apps/cambridge/assets/games /app/app/static/assets/cambridge-games
COPY apps/cambridge/assets/listening /app/app/static/assets/listening
COPY apps/u25/index.html /app/app/static/universidad-adultos.html
COPY apps/e25/index.html /app/app/static/eso-adultos.html
COPY apps/e25/assets/eso-final.css /app/app/static/assets/eso-final.css
COPY apps/e25/assets/eso-math-scenes.css /app/app/static/assets/eso-math-scenes.css
COPY apps/e25/assets/eso-english-mission-scenes.css /app/app/static/assets/eso-english-mission-scenes.css
COPY apps/e25/assets/eso-mission-boards.css /app/app/static/assets/eso-mission-boards.css
COPY apps/e25/assets/eso-games.js /app/app/static/assets/eso-games.js
COPY apps/e25/assets/eso-state-recovery.js /app/app/static/assets/eso-state-recovery.js
COPY apps/e25/assets/eso-english-missions.js /app/app/static/assets/eso-english-missions.js
COPY apps/e25/assets/eso-math-missions.js /app/app/static/assets/eso-math-missions.js
COPY apps/e25/assets/eso-language-missions.js /app/app/static/assets/eso-language-missions.js
COPY apps/e25/assets/eso-geography-missions.js /app/app/static/assets/eso-geography-missions.js
COPY apps/e25/assets/eso-history-missions.js /app/app/static/assets/eso-history-missions.js
COPY apps/e25/assets/eso-science-missions.js /app/app/static/assets/eso-science-missions.js
COPY apps/e25/assets/eso-external-games.js /app/app/static/assets/eso-external-games.js
COPY apps/e25/assets/subjects /app/app/static/assets/subjects
COPY apps/ocr/index.html /app/app/static/ocr-facturas-app.html
COPY apps/profesor/index.html /app/app/static/profesor-particular.html
COPY apps/profesor/*.js /app/app/static/assets/
COPY apps/profesor/assets /app/app/static/assets
COPY apps/e25/assets/desk /app/app/static/assets/desk
COPY marketing/app_landings_demo /app/app/static/marketing

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
