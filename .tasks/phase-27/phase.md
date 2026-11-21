---
phase: 27
title: FirePlan-synchronisatie en radio-identificatie
status: pending
opened: ~
closed: ~
---
## Goal
Hergebruik de FirePlan QR-inventarisroute en bestaande task/SSE-infrastructuur voor radiosynchronisatie, en hergebruik de scannerbediening voor radiozoekopdrachten.

## Exit Criteria
- De huidige FirePlan QR-respons en beschikbare radiotypen worden tegen de bereikbare FirePlan-omgeving gevalideerd; de integratie gebruikt alleen bevestigde velden en meldt eventuele afwijkingen expliciet.
- De synchronisatie leest gepagineerde FirePlan QR-records via de bestaande sessie en clientpatronen, gebruikt een als stabiel bevestigde FirePlan-ID als primaire bronmatchsleutel en bewaart de volledige QR-URL voor scanlookup.
- Kandidaten worden op de bevestigde radiomodelnamen geselecteerd; TEI wordt uit het bevestigde serienummerveld gelezen en aan een lokaal radiomodel gekoppeld via de ingestelde TEI-bereiken.
- Synchronisatie hergebruikt Celery, de bestaande task-ID, django-celery-results, celery-progress, SSE en taakrapportage; er ontstaat geen parallel taak- of resultaatmodel.
- Herhaalde synchronisatie is idempotent, lokale radio's zonder FirePlan-record blijven behouden, en records met ongeldige/ontbrekende TEI, FirePlan-ID of QR-URL worden veilig gerapporteerd.
- Authenticated scanlookup hergebruikt de QR-candidate normalisatie en scannerervaring voor camera en toetsenbordscanner; scannen identificeert een radio en verandert geen abonnement of plaatsing.
- De FirePlan-integratie schrijft geen gegevens naar FirePlan en maakt daar geen nieuwe radio's aan.

## Tasks
